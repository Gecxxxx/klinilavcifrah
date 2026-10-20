"""Isolated Telegram updates and fake senders only; never sends real messages."""
from concurrent.futures import ThreadPoolExecutor
from dataclasses import replace
import io
import json
from pathlib import Path
import tempfile
import time
import unittest
from unittest.mock import patch
import uuid

from backend.app import Application, Config, validated
from backend.notify import DeliveryError, drain
from backend.test_leads import fixture


def update(command='/start', chat=101, message=1, stamp=1760000000, **extra):
    return {'update_id': message, 'message': {'message_id': message, 'date': stamp,
        'chat': {'id': chat, 'type': 'private'}, 'from': {'id': chat, 'is_bot': False},
        'text': command, **extra}}


class BotTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(); self.addCleanup(self.temp.cleanup)
        self.config = Config(Path(self.temp.name) / 'leads.sqlite3', 'x' * 64, 'fake-token',
            recipient_mode='subscribers', webhook_secret='s' * 64)
        self.app = Application(self.config); self.store = self.app.store

    def call(self, value=None, secret=None, method='POST', content_type='application/json', raw=None):
        body = json.dumps(update() if value is None else value).encode() if raw is None else raw
        env = {'REQUEST_METHOD': method, 'PATH_INFO': '/api/telegram/webhook',
               'CONTENT_TYPE': content_type, 'CONTENT_LENGTH': str(len(body)), 'wsgi.input': io.BytesIO(body),
               'HTTP_X_TELEGRAM_BOT_API_SECRET_TOKEN': self.config.webhook_secret if secret is None else secret}
        response = {}
        data = b''.join(self.app(env, lambda status, headers: response.update(status=int(status.split()[0]))))
        return response['status'], json.loads(data)

    def save(self):
        lead, request, _ = validated(fixture(requestId=str(uuid.uuid4())))
        return self.store.save(lead, request, 'hashed-ip', 'test-policy')[0]

    def active(self, chat=101):
        return self.store.bot_command(str(chat), 'status', 0, 0)

    def test_authenticated_start_status_stop_and_restart_persistence(self):
        with patch('urllib.request.urlopen', side_effect=AssertionError('No network in webhook')):
            status, reply = self.call()
            self.assertEqual(status, 200); self.assertEqual(reply['method'], 'sendMessage')
            self.assertEqual(reply['chat_id'], 101); self.assertTrue(self.active())
            self.call(update('/start deep-link-payload', message=2))
            self.assertTrue(self.active())
            self.app = Application(self.config); self.store = self.app.store
            self.assertTrue(self.active())
            self.assertIn('Вы подписаны', self.call(update('/status', message=3))[1]['text'])
            self.call(update('/stop', message=4))
            self.assertFalse(self.active())
            self.assertIn('не подписаны', self.call(update('/status', message=5))[1]['text'])
            self.call(update('/start', message=6)); self.assertTrue(self.active())
            with self.store.connection() as con:
                self.assertEqual(con.execute('SELECT count(*) FROM telegram_subscribers').fetchone()[0], 1)

    def test_secret_required_and_webhook_closed_in_fixed_mode(self):
        for secret in ['', 'wrong', 's' * 63]:
            self.assertEqual(self.call(secret=secret)[0], 403)
        self.assertFalse(self.active())
        self.assertEqual(self.call(method='GET')[0], 404)
        self.app = Application(replace(self.config, recipient_mode='fixed'))
        self.assertEqual(self.call()[0], 404)

    def test_group_channel_edited_bot_and_malformed_messages_do_not_subscribe(self):
        samples = [[], {}, {'edited_message': update()['message']}, update(chat=-100),
            update(chat=True), update(text='hi'), update(text='/startled'),
            update(chat={'id': 101}), update(**{'from': {'id': 999, 'is_bot': False}}),
            update(**{'from': {'id': 101, 'is_bot': True}}), update(message=0), update(date=0),
            update(business_connection_id='other-bot'), update(text=None)]
        for kind in ['group', 'supergroup', 'channel']:
            value = update(); value['message']['chat']['type'] = kind; samples.append(value)
        for value in samples:
            with self.subTest(value=value): self.assertEqual(self.call(value)[0], 200)
        self.assertFalse(self.active())
        self.assertEqual(self.call(raw=b'broken')[0], 400)
        self.assertEqual(self.call(raw=b'x' * 32769)[0], 413)
        self.assertEqual(self.call(content_type='text/plain')[0], 415)

    def test_duplicate_and_delayed_start_cannot_undo_stop(self):
        self.call(update()); self.call(update('/stop', message=3))
        self.call(update()); self.call(update('/start', message=2))
        self.assertFalse(self.active())
        self.call(update('/start', message=4)); self.assertTrue(self.active())
        self.call(update('/stop', message=3)); self.assertTrue(self.active())
        # Telegram update IDs may restart after a quiet week. Order by message date/id.
        later = update('/stop', message=1, stamp=1761000000); later['update_id'] = 1
        self.call(later); self.assertFalse(self.active())

    def test_concurrent_duplicate_start_is_one_subscription(self):
        with ThreadPoolExecutor(8) as pool:
            list(pool.map(lambda _: self.store.bot_command('101', 'start', 1760000000, 1), range(16)))
        with self.store.connection() as con:
            rows = con.execute('SELECT * FROM telegram_subscribers').fetchall()
        self.assertEqual(len(rows), 1); self.assertEqual(rows[0]['generation'], 1)

    def test_no_subscribers_keeps_saved_lead_without_exhausting_retries(self):
        lead_id = self.save(); now = int(time.time())
        for _ in range(20):
            drain(self.config, send=lambda *_: self.fail('No recipients'), now=now)
            now += 120
        with self.store.connection() as con:
            job = con.execute('SELECT * FROM outbox').fetchone()
        self.assertEqual(job['last_error'], 'waiting_subscribers'); self.assertEqual(job['attempts'], 0)
        self.assertEqual(self.store.stats(), {'leads': 1, 'notifications': {'retry': 1}})
        self.call(); sent = []
        drain(self.config, send=lambda _, chat, text: sent.append((chat, text)) or 1, now=now)
        self.assertEqual([x[0] for x in sent], ['101']); self.assertIn(lead_id, sent[0][1])
        self.assertEqual(self.store.stats()['notifications'], {'delivered': 1})

    def test_broadcast_partial_retry_and_new_subscriber_gets_only_new_jobs(self):
        self.call(); self.call(update(chat=202)); first = self.save(); now = int(time.time())
        def partial(_, chat, text):
            if chat == '202': raise DeliveryError('transport_error')
            return 1
        drain(self.config, send=partial, now=now)
        self.call(update(chat=303))
        calls = []
        drain(self.config, send=lambda _, chat, text: calls.append((chat, text)) or 2, now=now + 31)
        self.assertEqual([x[0] for x in calls], ['202']); self.assertIn(first, calls[0][1])
        self.save(); calls.clear()
        drain(self.config, send=lambda _, chat, text: calls.append((chat, text)) or 3, now=now + 32)
        self.assertEqual([x[0] for x in calls], ['101', '202', '303'])

    def test_stop_and_restart_does_not_resume_old_notification(self):
        self.call(); self.save(); now = int(time.time())
        def failed(*_): raise DeliveryError('transport_error')
        drain(self.config, send=failed, now=now)
        self.call(update('/stop', message=2)); self.call(update('/start', message=3))
        drain(self.config, send=lambda *_: self.fail('Old subscription has ended'), now=now + 31)
        self.assertEqual(self.store.stats()['notifications'], {'delivered': 1})
        self.save(); calls = []
        drain(self.config, send=lambda _, chat, text: calls.append(chat) or 1, now=now + 32)
        self.assertEqual(calls, ['101'])

    def test_stop_during_broadcast_skips_next_recipient(self):
        self.call(); self.call(update(chat=202)); self.save(); calls = []
        def send(_, chat, text):
            calls.append(chat)
            self.call(update('/stop', chat=202, message=2))
            return 1
        drain(self.config, send=send)
        self.assertEqual(calls, ['101'])

    def test_many_subscribers_are_sent_in_bounded_batches_without_duplicates(self):
        for chat in range(101, 110): self.call(update(chat=chat))
        self.save(); now = int(time.time()); calls = []
        for index, expected in enumerate([4, 8, 9]):
            drain(self.config, limit=1, send=lambda _, chat, text: calls.append(chat) or 1, now=now + 61 * index)
            self.assertEqual(len(calls), expected)
        self.assertEqual(len(set(calls)), 9)
        self.assertEqual(self.store.stats()['notifications'], {'delivered': 1})

    def test_existing_registry_upgrades_without_losing_leads_and_backup_keeps_subscriptions(self):
        self.save()
        with self.store.connection(write=True) as con:
            con.execute('DROP TABLE notification_recipients')
            con.execute('DROP TABLE telegram_subscribers')
        self.app = Application(self.config); self.store = self.app.store
        self.assertEqual(self.store.stats()['leads'], 1)
        self.call()
        backup = Path(self.temp.name) / 'backup.sqlite3'; self.store.backup(backup)
        restored = Application(replace(self.config, db=backup))
        self.assertEqual(restored.store.stats()['leads'], 1)
        self.assertTrue(restored.store.bot_command('101', 'status', 0, 0))


if __name__ == '__main__': unittest.main()

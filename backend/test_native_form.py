"""Native POST fallback tests: private temporary SQLite, no Telegram/network."""
import io
import json
import unittest
import urllib.parse
from backend import test_leads as fixtures
from backend.test_leads import fixture
from backend.notify import notification_text


class NativeFormTest(unittest.TestCase):
    setUp = fixtures.RegistryTest.setUp
    def native(self, value, origin='https://klinikavcifrah.ru', referer=''):
        raw=urllib.parse.urlencode(value).encode()
        env={'PATH_INFO':'/api/leads','REQUEST_METHOD':'POST','CONTENT_TYPE':'application/x-www-form-urlencoded',
             'CONTENT_LENGTH':str(len(raw)),'wsgi.input':io.BytesIO(raw),'HTTP_ORIGIN':origin,'HTTP_X_REAL_IP':'192.0.2.80','HTTP_REFERER':referer}
        captured={}
        body=b''.join(self.app(env,lambda status,headers:captured.update(status=int(status.split()[0]),headers=dict(headers))))
        return captured,body.decode()

    def test_native_success_commits_and_repeat_deduplicates_without_echoing_contact(self):
        data=fixture(consent='on',name='PRIVATE TEST NAME',message='PRIVATE TEST CONTENT')
        data.pop('utm')
        first,body=self.native(data)
        self.assertEqual(first['status'],200);self.assertTrue(first['headers']['Content-Type'].startswith('text/html'))
        self.assertIn('Заявка сохранена',body);self.assertNotIn(data['name'],body);self.assertNotIn(data['phone'],body);self.assertNotIn(data['message'],body)
        self.assertEqual(first['headers']['Cache-Control'],'no-store');self.assertNotIn('Location',first['headers'])
        self.assertEqual(self.native(data)[0]['status'],200)
        self.assertEqual(self.store.stats()['leads'],1)

    def test_native_error_origin_and_captcha_do_not_write_leads(self):
        data=fixture(consent='');data.pop('utm')
        self.assertEqual(self.native(data)[0]['status'],400)
        data['consent']='on'
        self.assertEqual(self.native(data,origin='https://evil.test')[0]['status'],403)
        self.app.verify=lambda *_:False
        self.assertEqual(self.native(data)[0]['status'],400)
        self.assertEqual(self.store.stats()['leads'],0)

    def test_native_crm_interest_and_json_metadata_use_common_registry(self):
        data=fixture(consent='on');data.pop('utm')
        status,_=self.native(data,referer='https://klinikavcifrah.ru/kontakty?interest=crm_custom&direction=marketing')
        self.assertEqual(status['status'],200)
        with self.store.connection() as con:lead=json.loads(con.execute('SELECT payload FROM leads').fetchone()[0])
        self.assertEqual(lead['interest'],'crm_custom');self.assertEqual(lead['direction'],'digital')
        self.assertIn('Индивидуальная CRM / интеграции',notification_text(self.store.claim()))

    def test_native_team_directions_reach_the_common_registry_and_notification(self):
        for direction, title in [('commercial', 'Коммерческая система'), ('marketing', 'Маркетинг и привлечение'), ('digital', 'Сайт, CRM и аналитика')]:
            with self.subTest(direction=direction):
                data=fixture(consent='on', requestId='native-team-request-'+direction);data.pop('utm')
                status,_=self.native(data,referer='https://klinikavcifrah.ru/kontakty?direction='+direction+'&email=private@example.test')
                self.assertEqual(status['status'],200)
                with self.store.connection() as con:
                    row=con.execute('SELECT id,payload FROM leads WHERE request_id=?',(data['requestId'],)).fetchone()
                lead=json.loads(row['payload'])
                self.assertEqual(lead['direction'],direction)
                self.assertNotIn('private@example.test',row['payload'])
                self.assertIn(title,notification_text({'lead_id':row['id'],'payload':row['payload']}))

    def test_native_direction_rejects_untrusted_or_ambiguous_referrer_markers(self):
        referers = ['https://evil.test/kontakty?direction=marketing',
                    'https://klinikavcifrah.ru/kontakty?direction=private@example.test',
                    'https://klinikavcifrah.ru/kontakty?direction=marketing&direction=digital']
        for index, referer in enumerate(referers):
            with self.subTest(referer=referer):
                data=fixture(consent='on',requestId='native-untrusted-request-'+str(index),message='Case '+str(index));data.pop('utm')
                self.assertEqual(self.native(data,referer=referer)[0]['status'],200)
                with self.store.connection() as con:
                    payload=con.execute('SELECT payload FROM leads WHERE request_id=?',(data['requestId'],)).fetchone()[0]
                self.assertNotIn('direction',json.loads(payload))
                self.assertNotIn('private@example.test',payload)



class ConsentVersionTest(unittest.TestCase):
    setUp = fixtures.RegistryTest.setUp
    call = fixtures.RegistryTest.call

    def test_new_wording_version_is_saved_and_old_id_replay_stays_compatible(self):
        version = 'contact-information-2026-10-24'
        value = fixture(consentVersion=version, requestId='consent-request-123456789')
        status, first = self.call(value)
        self.assertEqual(status, 200)
        with self.store.connection() as con:
            row = con.execute('SELECT policy_version,consent_at,payload FROM leads').fetchone()
        self.assertEqual(row['policy_version'], version)
        self.assertGreater(row['consent_at'], 0)
        self.assertEqual(json.loads(row['payload'])['consentVersion'], version)
        value.pop('consentVersion')
        status, replay = self.call(value)
        self.assertEqual(status, 200)
        self.assertEqual(first['id'], replay['id'])
        self.assertEqual(self.store.stats()['leads'], 1)

    def test_unknown_wording_version_is_rejected(self):
        self.assertEqual(self.call(fixture(consentVersion='invented'))[0], 400)
        self.assertEqual(self.store.stats()['leads'], 0)


if __name__=='__main__':unittest.main()

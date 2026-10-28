#!/usr/bin/env python3
"""Read-only acceptance of public pages; never creates leads or sends messages."""
import argparse
from concurrent.futures import ThreadPoolExecutor
from html.parser import HTMLParser
import json
import re
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
import struct

PATHS = ['/', '/marketing-i-privlechenie', '/sajt-crm-analitika', '/kommercheskaya-sistema', '/kak-rabotaem', '/kejsy-i-razbory', '/dlya-klinik', '/kontakty', '/soglasheniya']


class Page(HTMLParser):
    def __init__(self):
        super().__init__(); self.h1 = 0; self.canonical = []; self.ids = set(); self.links = []; self.images = []; self.forms = []; self.title = ''; self.description = ''; self.heading = ''; self._tag = ''; self.jsonld = []; self._json = False; self._text = ''; self.content = []; self.legal_approved = False
    def handle_starttag(self, tag, attributes):
        attrs = dict(attributes); self._tag = tag
        if attrs.get('data-legal-status') == 'approved': self.legal_approved = True
        if 'id' in attrs: self.ids.add(attrs['id'])
        if tag == 'h1': self.h1 += 1
        if tag == 'link' and attrs.get('rel') == 'canonical': self.canonical.append(attrs.get('href'))
        if tag == 'meta' and attrs.get('name') == 'description': self.description = attrs.get('content', '')
        if tag == 'a' and attrs.get('href'): self.links.append(attrs['href'])
        if tag == 'img': self.images.append(attrs)
        if tag == 'form': self.forms.append(attrs)
        if tag == 'script' and attrs.get('type') == 'application/ld+json': self._json = True; self._text = ''
    def handle_data(self, data):
        if self._json: self._text += data
        elif self._tag == 'title': self.title += data
        elif self._tag == 'h1': self.heading += data
        elif self._tag not in ('script', 'style'): self.content.append(data)
    def handle_endtag(self, tag):
        if tag == 'script' and self._json: self.jsonld.append(json.loads(self._text)); self._json = False
        self._tag = ''


def fetch(url, method='GET', origin=None):
    headers = {'User-Agent': 'kvc-deploy-health/1.0', 'Cache-Control': 'no-cache'}
    if origin: headers['Origin'] = origin
    request = urllib.request.Request(url, method=method, headers=headers)
    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            return response.status, response.read(4 * 1024 * 1024), dict(response.headers)
    except urllib.error.HTTPError as error:
        return error.code, error.read(16384), dict(error.headers)


def audit(origin, revision=None, request=fetch):
    origin = origin.rstrip('/'); pages = {}; errors = []; pending = []
    def read(path):
        code, body, _ = request(origin + path)
        if code != 200: raise ValueError(f'{path}: HTTP {code}')
        page = Page(); page.feed(body.decode('utf-8'))
        if page.h1 != 1 or (len(page.canonical) != 1 or page.canonical[0].rstrip('/') != (origin + path).rstrip('/')) or not page.title or not page.description:
            raise ValueError(f'{path}: heading/canonical/metadata mismatch')
        for form in page.forms:
            if form.get('method', 'get').lower() != 'post' or form.get('action') != '/api/leads':
                raise ValueError(f'{path}: unsafe native form fallback')
        if any('alt' not in image for image in page.images): raise ValueError(f'{path}: missing image alt')
        return path, page
    with ThreadPoolExecutor(max_workers=4) as pool:
        for path, page in pool.map(read, PATHS): pages[path] = page
    for path, page in pages.items():
        for href in page.links:
            target = urllib.parse.urlsplit(urllib.parse.urljoin(origin + path, href))
            if target.scheme not in ('http', 'https') or target.netloc != urllib.parse.urlsplit(origin).netloc: continue
            route = target.path.rstrip('/') or '/'
            if route not in pages: errors.append(f'{path}: unknown internal route {route}')
            elif target.fragment and urllib.parse.unquote(target.fragment) not in pages[route].ids: errors.append(f'{path}: missing anchor {href}')
    if len({page.title for page in pages.values()}) != len(PATHS): errors.append('Duplicate titles')
    if len({page.description for page in pages.values()}) != len(PATHS): errors.append('Duplicate descriptions')
    for path in ['/robots.txt', '/sitemap.xml', '/opengraph-image']:
        status, body, _ = request(origin + path)
        if status != 200:
            errors.append(f'{path}: HTTP {status}'); continue
        if path == '/robots.txt':
            if (f'Sitemap: {origin}/sitemap.xml'.encode() not in body
                    or re.search(rb'^Disallow:\s*/\s*$', body, re.M) or b'localhost' in body):
                errors.append('Invalid robots rules/sitemap')
        elif path == '/sitemap.xml':
            try:
                locations = {element.text for element in ET.fromstring(body).iter() if element.tag.endswith('}loc')}
                if locations != {origin + route for route in PATHS}: errors.append('Sitemap locations mismatch')
            except ET.ParseError: errors.append('Sitemap is not valid XML')
        elif len(body) < 24 or body[1:4] != b'PNG' or struct.unpack('>II', body[16:24]) != (1200, 630):
            errors.append('OG image is not a 1200x630 PNG')
    if request(origin + '/__kvc_acceptance_missing_page')[0] != 404: errors.append('Unknown route is not 404')
    status, body, _ = request(origin + '/__release.json')
    live = json.loads(body)['commit'] if status == 200 else None
    if not live or (revision and live != revision): errors.append('Static revision mismatch')
    status, _, headers = request(origin + '/api/leads', 'OPTIONS', origin)
    api = next((value for key, value in headers.items() if key.lower() == 'x-kvc-api-revision'), None)
    if status != 204 or api != live: errors.append('API readiness/revision mismatch')
    for path, page in pages.items():
        if len(page.forms) != (1 if path == '/kontakty' else 0): errors.append(f'{path}: expected single shared contact form')
        approved_contacts = {'tel:+79690070865', 'mailto:revenue@klinikavcifrah.ru', 'https://t.me/+79690070865', 'https://wa.me/79690070865'} if path == '/kontakty' else set()
        if any(href.startswith(('http:', 'https:', 'tel:', 'mailto:')) and not href.startswith(origin + '/') and href not in approved_contacts for href in page.links):
            errors.append(f'{path}: external contact remains')
    if not pages['/soglasheniya'].legal_approved: pending.append('Approved legal documents and data operator identity')
    if not any('crm_custom' in href for href in pages['/sajt-crm-analitika'].links): errors.append('CRM interest CTA missing')
    report = {'revision': live, 'api_revision': api, 'pages': len(pages), 'forms': sum(len(p.forms) for p in pages.values()), 'errors': errors, 'owner_inputs_pending': pending,
              'scope': 'Public HTTP, metadata, internal links/anchors, form POST fallback and API revision. No leads created; no Telegram messages sent.'}
    return report, pages


if __name__ == '__main__':
    parser = argparse.ArgumentParser(); parser.add_argument('--origin', default='https://klinikavcifrah.ru'); parser.add_argument('--revision'); args = parser.parse_args()
    report, _ = audit(args.origin, args.revision)
    print(json.dumps(report, ensure_ascii=False, indent=2))
    raise SystemExit(bool(report['errors']))

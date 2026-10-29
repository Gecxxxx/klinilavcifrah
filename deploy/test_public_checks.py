import importlib.util
from pathlib import Path
import json
import unittest
import urllib.parse

spec=importlib.util.spec_from_file_location('public_checks',Path(__file__).parents[1]/'scripts/check-live.py')
checks=importlib.util.module_from_spec(spec);spec.loader.exec_module(checks)

class PublicChecksTest(unittest.TestCase):
    def fetch(self,url,method='GET',origin=None):
        path=urllib.parse.urlsplit(url).path
        if method=='OPTIONS':return 204,b'',{'X-KVC-API-Revision':self.api}
        if path=='/__release.json':return 200,json.dumps({'commit':self.revision}).encode(),{}
        if path in checks.PATHS:
            form='<form method="post" action="/api/leads"></form>' if path == '/kontakty' else ''
            crm='<a href="/kontakty?interest=crm_custom#forma">CRM</a>' if path=='/sajt-crm-analitika' else ''
            body=f'<html><head><title>{path}</title><link rel="canonical" href="https://example.test{path}"><meta name="description" content="Page {path}"></head><body><main id="main"><h1>{path}</h1><section id="forma">{form}</section>{crm}{self.extra_links.get(path, "")}</main></body></html>'
            if self.bad and path=='/kontakty':body=body.replace('method="post"','method="get"')
            return 200,body.encode(),{}
        if path=='/robots.txt':return 200,b'User-agent: *\nAllow: /\nSitemap: https://example.test/sitemap.xml',{}
        if path=='/sitemap.xml':return 200,('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+''.join('<url><loc>https://example.test'+route+'</loc></url>' for route in checks.PATHS)+'</urlset>').encode(),{}
        if path=='/opengraph-image':
            import struct
            return 200,b'\x89PNG'+bytes(12)+struct.pack('>II',1200,630),{}
        return 404,b'',{}
    def setUp(self):
        self.revision='a'*40;self.api=self.revision;self.bad=False;self.extra_links={}
    def test_expected_site_and_versions_pass_without_creating_a_lead(self):
        result,pages=checks.audit('https://example.test',self.revision,self.fetch)
        self.assertEqual(result['errors'],[]);self.assertEqual(result['forms'],1);self.assertEqual(len(pages),9)
        self.assertTrue(result['owner_inputs_pending'])
        self.assertIn('Approved privacy policy, separate consent and remaining processing facts', result['owner_inputs_pending'])
    def test_approved_operator_email_on_legal_page_is_allowed(self):
        self.extra_links={'/soglasheniya':'<a href="mailto:revenue@klinikavcifrah.ru">Operator</a>'}
        result,_=checks.audit('https://example.test',self.revision,self.fetch)
        self.assertEqual(result['errors'],[])
        self.assertTrue(result['owner_inputs_pending'])
    def test_other_external_contacts_are_still_rejected(self):
        for path,href in [('/soglasheniya','mailto:other@example.test'),('/soglasheniya','https://t.me/other_contact'),('/','mailto:revenue@klinikavcifrah.ru')]:
            with self.subTest(path=path,href=href):
                self.extra_links={path:f'<a href="{href}">Contact</a>'}
                result,_=checks.audit('https://example.test',self.revision,self.fetch)
                self.assertIn(f'{path}: external contact remains',result['errors'])
    def test_unsafe_native_form_is_a_hard_failure(self):
        self.bad=True
        with self.assertRaisesRegex(ValueError,'unsafe native form'):checks.audit('https://example.test',self.revision,self.fetch)
    def test_api_mismatch_fails_even_if_pages_work(self):
        self.api='b'*40
        result,_=checks.audit('https://example.test',self.revision,self.fetch)
        self.assertIn('API readiness/revision mismatch',result['errors'])

if __name__=='__main__':unittest.main()

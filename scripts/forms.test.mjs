import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { AttributionTracker } from '../src/lib/lead-attribution.ts';
import { leadSchema } from '../src/lib/lead-schema.ts';

function storage() { const data = new Map(); return { getItem:k=>data.get(k)||null, setItem:(k,v)=>data.set(k,v), data }; }
const original = {name:'Тест',company:'Клиника',phone:'+79990000000',website:'clinic.ru',message:'Задача',consent:true,website_check:''};
test('browser/server agree on contact formats and field bounds', () => {
  const variants = [{},...['+7 (999) 000-00-00','@clinic_contact','info@example.test','https://t.me/clinic_contact','t.me/clinic_contact', 'abcdef', '@abcd', 'info@bad', 'test.user'].map(phone=>({phone})),
    {name:'x'.repeat(101)}, {company:'x'.repeat(161)}, {phone:'1'.repeat(101)}, {website:'x'.repeat(301)}, {website:'bad address.test'}, {message:'x'.repeat(1001)}, {consent:false}];
  const data=variants.map(v=>({...original,...v}));
  const server=JSON.parse(execFileSync('python3',['-c',`import json,sys
from backend.app import validated
from backend.store import Rejected
result=[]
for value in json.load(sys.stdin):
 try: validated(value); result.append(True)
 except Rejected: result.append(False)
print(json.dumps(result))`],{input:JSON.stringify(data),encoding:'utf8'}));
  assert.deepEqual(data.map(v=>leadSchema.safeParse(v).success),server);
});
test('first landing, campaign and external referrer survive internal navigation and reload', () => {
  const store=storage(), first=new AttributionTracker();
  first.capture(new URL('https://example.test/?utm_source=qr&utm_campaign=autumn'), 'https://search.test/find?q=contact',store);
  const cta=first.selectCta(new URL('https://example.test/marketing-i-privlechenie'),'service_hero','',store);
  assert.equal(cta.direction,'marketing');
  const loaded=new AttributionTracker().capture(new URL('https://example.test/kontakty?utm_source=other'),'https://example.test/marketing-i-privlechenie',store);
  assert.equal(loaded.landingPage,'/'); assert.equal(loaded.utm.utm_source,'qr');
  assert.equal(loaded.referrer,'https://search.test/find'); assert.equal(loaded.ctaPage,'/marketing-i-privlechenie');
  assert.equal(loaded.ctaLocation,'service_hero'); assert.equal(loaded.product,'preliminary_review');
});
test('blocked storage keeps same-tab campaign and CTA without preventing submission', () => {
 const denied={getItem(){throw Error('denied')},setItem(){throw Error('denied')}};
 const tracker=new AttributionTracker();
 tracker.capture(new URL('https://example.test/?utm_source=telegram'),'https://t.me/channel',denied);
 tracker.selectCta(new URL('https://example.test/sajt-crm-analitika'),'service_inline','',denied);
 const lead=tracker.capture(new URL('https://example.test/kontakty'),'https://example.test/',denied);
 assert.equal(lead.utm.utm_source,'telegram');assert.equal(lead.direction,'digital');assert.equal(lead.referrer,'https://t.me/channel');
});
test('untagged/direct traffic is honestly empty; corrupt storage is recoverable and UTM is bounded', () => {
 const direct=new AttributionTracker().capture(new URL('https://example.test/kontakty'),'https://example.test/',storage());
 assert.deepEqual(direct.utm,{}); assert.equal(direct.referrer,'');assert.equal(direct.ctaLocation,'direct');
 const store=storage(); store.setItem('klinika_visit_v1','broken JSON');
 const result=new AttributionTracker().capture(new URL('https://example.test/?email=private&utm_source='+'x'.repeat(201)),'javascript:bad',store);
 assert.equal(result.utm.utm_source.length,200); assert.equal(result.referrer,''); assert.ok(!JSON.stringify([...store.data.values()]).includes('private'));
});

test('analytics queues initialization before early goals; drops contact parameters and tolerates counter failure', async () => {
 process.env.NEXT_PUBLIC_YANDEX_METRIKA_ID='12345678';
 const {reachGoal,trackPage}=await import('../src/lib/analytics.ts');
 const events=[];
 globalThis.window={location:{origin:'https://example.test'},dispatchEvent:e=>events.push(e.detail)};
 try {
  reachGoal('form_start',{page:'/kontakty',phone:'+79990000000',message:'Private message'});
  assert.equal(window.ym.a[0][1],'init'); assert.equal(window.ym.a[0][2].webvisor,false);
  assert.equal(window.ym.a[1][1],'reachGoal');assert.deepEqual(events[0].params,{page:'/kontakty'});
  trackPage('/kontakty');assert.equal(window.ym.a[2][1],'hit');
  window.ym=()=>{throw Error('blocked counter')};
  assert.doesNotThrow(()=>reachGoal('lead_saved',{direction:'digital'}));
  assert.doesNotThrow(()=>trackPage('/kontakty'));
 } finally { delete globalThis.window; }
});

test('custom CRM CTA uses the same form and preserves its interest through reload', () => {
 const store=storage();const tracker=new AttributionTracker();
 tracker.selectCta(new URL('https://example.test/sajt-crm-analitika'),'crm_custom','',store);
 const saved=new AttributionTracker().capture(new URL('https://example.test/kontakty?interest=crm_custom'),'https://example.test/sajt-crm-analitika',store);
 assert.equal(saved.interest,'crm_custom');assert.equal(saved.direction,'digital');assert.equal(saved.product,'preliminary_review');
 const direct=new AttributionTracker().capture(new URL('https://example.test/kontakty?interest=crm_custom'),'');
 assert.equal(direct.interest,'crm_custom');assert.equal(direct.direction,'digital');
});

test('each team direction survives the shared form and a reload without changing first-touch attribution', () => {
 for (const direction of ['commercial','marketing','digital']) {
  const store=storage(), tracker=new AttributionTracker();
  tracker.capture(new URL('https://example.test/?utm_source=qr'),'https://partner.test/article',store);
  const click=tracker.selectCta(new URL('https://example.test/'),'team','',store,direction);
  assert.equal(click.direction,direction);
  const form=new AttributionTracker().capture(new URL('https://example.test/kontakty'),'https://example.test/',store);
  assert.equal(form.direction,direction);assert.equal(form.ctaLocation,'team');assert.equal(form.ctaPage,'/');
  assert.equal(form.landingPage,'/');assert.equal(form.utm.utm_source,'qr');assert.equal(form.referrer,'https://partner.test/article');
  const direct=new AttributionTracker().capture(new URL('https://example.test/kontakty?direction='+direction),'');
  assert.equal(direct.direction,direction);
 }
});

test('direction markers are allowlisted and cannot override custom CRM intent', () => {
 const store=storage(),tracker=new AttributionTracker();
 const invalid=tracker.selectCta(new URL('https://example.test/'),'team','',store,'private@example.test');
 assert.equal(invalid.direction,'general');
 assert.equal(new AttributionTracker().capture(new URL('https://example.test/kontakty?direction=private@example.test'),'').direction,'general');
 store.setItem('klinika_cta_v1',JSON.stringify({ctaLocation:'team',ctaPage:'/',direction:'private@example.test'}));
 assert.equal(new AttributionTracker().capture(new URL('https://example.test/kontakty'),'',store).direction,'general');
 assert.equal(new AttributionTracker().capture(new URL('https://example.test/kontakty?interest=crm_custom&direction=marketing'),'').direction,'digital');
 const previousCrm=storage();
 new AttributionTracker().selectCta(new URL('https://example.test/sajt-crm-analitika'),'crm_custom','',previousCrm);
 const selectedTeam=new AttributionTracker().capture(new URL('https://example.test/kontakty?direction=marketing'),'',previousCrm);
 assert.equal(selectedTeam.direction,'marketing');assert.equal(selectedTeam.interest,undefined);
});

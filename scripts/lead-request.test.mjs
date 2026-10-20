import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prepareLeadRequest, acknowledgeLead } from '../src/lib/lead-request.ts';

function storage() { const map = new Map(); return { getItem: k => map.get(k) ?? null, setItem: (k,v) => map.set(k,v), removeItem: k => map.delete(k), map }; }
const attribution = { page: '/kontakty', landingPage: '/', referrer: 'https://example.test/', utm: { utm_source: 'test' } };
const values = { name: 'Test', company: 'Example', phone: '+79990000000', message: 'Synthetic', consent: true };

test('network retry keeps request ID, original attribution and refreshed CAPTCHA', async () => {
 const store = storage();
 const first = await prepareLeadRequest({ ...values, turnstileToken: 'old' }, attribution, store);
 const second = await prepareLeadRequest({ ...values, turnstileToken: 'new' }, { ...attribution, page: '/' }, store);
 assert.equal(first.requestId, second.requestId);
 assert.equal(second.page, '/kontakty'); assert.equal(second.turnstileToken, 'new');
 assert.ok(!JSON.stringify([...store.map.values()]).includes(values.phone));
});
test('changed form values create a new intent, acknowledgement allows a subsequent new lead', async () => {
 const store=storage();
 const first=await prepareLeadRequest(values,attribution,store);
 const edited=await prepareLeadRequest({...values,message:'Changed'},attribution,store);
 assert.notEqual(first.requestId,edited.requestId);
 assert.equal(acknowledgeLead('saved-id-1',store),true);
 assert.equal(acknowledgeLead('saved-id-1',store),false);
 const fresh=await prepareLeadRequest({...values,message:'Changed'},attribution,store);
 assert.notEqual(edited.requestId,fresh.requestId);
});
test('disabled or corrupt sessionStorage does not prevent submission or same-page retries', async () => {
 const denied={getItem(){throw Error('denied')},setItem(){throw Error('denied')},removeItem(){throw Error('denied')}};
 const first=await prepareLeadRequest({...values,message:'No storage'},attribution,denied);
 const retry=await prepareLeadRequest({...values,message:'No storage'},attribution,denied);
 assert.equal(first.requestId,retry.requestId);
 const corrupt=storage();corrupt.setItem('klinika_pending_lead_v1','{invalid json');
 const next=await prepareLeadRequest({...values,message:'Corrupt storage'},attribution,corrupt);
 assert.ok(next.requestId.length>20);
});

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {captureOrder,configuration,createOrder,validateRemoteOrder} from '../lib/paypal.ts';
import {inspect,scenarios} from '../lib/engine.ts';

// Tests cannot accidentally charge or call a real sandbox, even if developer keys exist.
const savedEnv={...process.env};
delete process.env.PAYPAL_SANDBOX_CLIENT_ID;
delete process.env.PAYPAL_SANDBOX_CLIENT_SECRET;
delete process.env.PAYPAL_CHECKOUT_SIGNING_KEY;
const nativeFetch=globalThis.fetch;
globalThis.fetch=async()=>{throw new Error('Network forbidden in unit tests');};

test('payment off with no sandbox credentials',()=>{assert.equal(configuration().enabled,false);assert.equal(configuration().mode,'sandbox');});
test('zero-purchase flow never creates a PayPal order',async()=>{const s=inspect(scenarios.reuse.setup).proposal!.setup;await assert.rejects(createOrder(s),/additional purchase/);});
test('bad cart cannot create a PayPal order',async()=>{await assert.rejects(createOrder(scenarios.repair.setup),/compatibility/);});
test('valid cart still blocked until sandbox credentials supplied',async()=>{await assert.rejects(createOrder(inspect(scenarios.repair.setup).proposal!.setup),/sandbox credentials/);});
test('forged or malformed capture ticket cannot reach PayPal',async()=>{for(const ticket of ['not-a-ticket','a.b.c','e30.invalid',''])await assert.rejects(captureOrder(ticket,scenarios.repair.setup),/changed or expired/);});
test('remote order must match signed ID, amount, currency, reference and intent',()=>{const good={id:'TESTORDER12345',intent:'CAPTURE',purchase_units:[{reference_id:'plugright-test',amount:{currency_code:'USD',value:'24.00'}}]},expected={id:good.id,cents:2400};assert.doesNotThrow(()=>validateRemoteOrder(good,expected));for(const change of [{...good,id:'ANOTHERORDER'},{...good,intent:'AUTHORIZE'},{...good,purchase_units:[]},{...good,purchase_units:[{reference_id:'other',amount:{currency_code:'USD',value:'24.00'}}]},{...good,purchase_units:[{reference_id:'plugright-test',amount:{currency_code:'EUR',value:'24.00'}}]},{...good,purchase_units:[{reference_id:'plugright-test',amount:{currency_code:'USD',value:'0.01'}}]}])assert.throws(()=>validateRemoteOrder(change,expected));});
test('only sandbox API is compiled into payment adapter; credentials never in client',()=>{const server=readFileSync(new URL('../lib/paypal.ts',import.meta.url),'utf8'),client=readFileSync(new URL('../app/page.tsx',import.meta.url),'utf8');assert.ok(server.includes('https://api-m.sandbox.paypal.com'));assert.ok(!server.includes('https://api-m.paypal.com'));assert.ok(!client.includes('PAYPAL_SANDBOX_CLIENT_SECRET'));assert.ok(!client.includes('PAYPAL_CHECKOUT_SIGNING_KEY'));});
test('adapter contract test with fake HTTP: signed cart, capture, retry, tamper and cancel',async()=>{
  process.env.PAYPAL_SANDBOX_CLIENT_ID='UNIT_TEST_NOT_A_PAYPAL_KEY';process.env.PAYPAL_SANDBOX_CLIENT_SECRET='UNIT_TEST_NOT_A_PAYPAL_SECRET';process.env.PAYPAL_CHECKOUT_SIGNING_KEY='unit-test-signing-key-not-for-real-use';
  const s=inspect(scenarios.repair.setup).proposal!.setup;
  let captured=false,approved=true,createBody:any, captureCalls=0, itemTampered=false; const calls:string[]=[];
  globalThis.fetch=async(input,init)=>{
    const url=String(input);calls.push(url);assert.ok(url.startsWith('https://api-m.sandbox.paypal.com/'));
    if(url.endsWith('/v1/oauth2/token'))return Response.json({access_token:'FAKE_TEST_TOKEN'});
    if(url.endsWith('/v2/checkout/orders')){createBody=JSON.parse(String(init?.body));assert.equal(createBody.purchase_units[0].amount.value,'24.00');assert.equal(createBody.purchase_units[0].items[0].sku,'A4');assert.equal(createBody.purchase_units[0].items[0].quantity,'1');return Response.json({id:'TESTORDER123456',status:'CREATED'});}
    const units=structuredClone(createBody.purchase_units);
    if(itemTampered)units[0].items[0].sku='A1';
    if(url.endsWith('/capture')){captureCalls++;assert.equal((init?.headers as Record<string,string>)['PayPal-Request-Id'],'plugright-TESTORDER123456');captured=true;}
    if(captured)units[0].payments={captures:[{id:'FAKE_CAPTURE_FOR_UNIT_TEST',status:'COMPLETED',amount:{currency_code:'USD',value:'24.00'}}]};
    return Response.json({id:'TESTORDER123456',intent:'CAPTURE',status:captured?'COMPLETED':approved?'APPROVED':'CREATED',purchase_units:units});
  };
  try{
    const created=await createOrder(s);assert.equal(created.mode,'sandbox');assert.ok(created.ticket);
    const networkBefore=calls.length;
    await assert.rejects(captureOrder(created.ticket,{...s,mode:'1080p60'}),/cart changed/);assert.equal(calls.length,networkBefore);
    const [payload,sig]=created.ticket.split('.');await assert.rejects(captureOrder(`${payload}.${sig.slice(0,-3)}xyz`,s),/changed or expired/);
    approved=false;await assert.rejects(captureOrder(created.ticket,s),/buyer approval/);assert.equal(captureCalls,0);approved=true;
    itemTampered=true;await assert.rejects(captureOrder(created.ticket,s),/order items/);assert.equal(captureCalls,0);itemTampered=false;
    const result=await captureOrder(created.ticket,s);assert.equal(result.status,'COMPLETED');assert.equal(result.mode,'sandbox');assert.equal(result.value,'24.00');assert.equal(captureCalls,1);
    const retry=await captureOrder(created.ticket,s);assert.equal(retry.captureId,result.captureId);assert.equal(captureCalls,1);
  }finally{globalThis.fetch=nativeFetch;for(const name of ['PAYPAL_SANDBOX_CLIENT_ID','PAYPAL_SANDBOX_CLIENT_SECRET','PAYPAL_CHECKOUT_SIGNING_KEY']){if(savedEnv[name]===undefined)delete process.env[name];else process.env[name]=savedEnv[name];}}
});

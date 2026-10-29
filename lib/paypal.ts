import { inspect, names, prices, validate, type Setup } from './engine.ts';

const BASE = 'https://api-m.sandbox.paypal.com'; // Deliberately no live URL/configuration override.
const encoder = new TextEncoder();
export class PaymentError extends Error { status:number; constructor(message:string, status=400) { super(message); this.status=status; } }
export function configuration() {
  const id=process.env.PAYPAL_SANDBOX_CLIENT_ID, secret=process.env.PAYPAL_SANDBOX_CLIENT_SECRET, signing=process.env.PAYPAL_CHECKOUT_SIGNING_KEY;
  return { enabled:!!(id && secret && signing && signing.length>=32), clientId:id??'', mode:'sandbox' as const };
}
async function api(path:string, method='GET', body?:unknown, requestId?:string) {
  if (!configuration().enabled) throw new PaymentError('PayPal sandbox credentials are not configured.',503);
  const credentials=btoa(`${process.env.PAYPAL_SANDBOX_CLIENT_ID}:${process.env.PAYPAL_SANDBOX_CLIENT_SECRET}`);
  const auth=await fetch(`${BASE}/v1/oauth2/token`,{method:'POST',headers:{Authorization:`Basic ${credentials}`,'Content-Type':'application/x-www-form-urlencoded'},body:'grant_type=client_credentials',signal:AbortSignal.timeout(15000)});
  if(!auth.ok) throw new PaymentError('Sandbox authentication failed. Check the test credentials.',502);
  const {access_token}=await auth.json() as {access_token:string};
  const response=await fetch(`${BASE}${path}`,{method,headers:{Authorization:`Bearer ${access_token}`,'Content-Type':'application/json',...(requestId?{'PayPal-Request-Id':requestId}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(20000)});
  if(!response.ok) throw new PaymentError('The PayPal sandbox request failed. Check the payment status before retrying.',502);
  return response.json() as Promise<any>;
}
const encode=(s:string)=>btoa(s).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
const decode=(s:string)=>atob(s.replaceAll('-','+').replaceAll('_','/'));
async function key() {
  const raw=process.env.PAYPAL_CHECKOUT_SIGNING_KEY;
  if(!raw || raw.length<32) throw new PaymentError('A sandbox order signing key is required.',503);
  return crypto.subtle.importKey('raw',encoder.encode(raw),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
}
type Ticket={id:string;setup:Setup;cents:number;expires:number};
async function sign(data:Ticket) { const payload=encode(JSON.stringify(data)); const sig=await crypto.subtle.sign('HMAC',await key(),encoder.encode(payload)); return `${payload}.${encode(String.fromCharCode(...new Uint8Array(sig)))}`; }
async function verify(ticket:string):Promise<Ticket> {
  try {
    if(typeof ticket!=='string' || ticket.length>10000) throw new Error();
    const [payload,sig,extra]=ticket.split('.');
    if(extra || !payload || !sig || !await crypto.subtle.verify('HMAC',await key(),Uint8Array.from(decode(sig),c=>c.charCodeAt(0)),encoder.encode(payload))) throw new Error();
    const data=JSON.parse(decode(payload));
    if(!/^[A-Z0-9]{10,30}$/.test(data.id) || data.expires<Date.now()) throw new Error();
    return data;
  } catch { throw new PaymentError('Order details changed or expired. Check the cart again.'); }
}
export async function createOrder(raw:unknown) {
  const checked=inspect(raw);
  if(!checked.checkoutReady || checked.total<=0) throw new PaymentError('Check compatibility and cart first. No additional purchase means no payment.');
  const value=(checked.total/100).toFixed(2), requestId=crypto.randomUUID();
  const items=checked.setup.cart.map(item=>({name:`Test only: ${names[item.id]}`.slice(0,127),sku:item.id,quantity:String(item.quantity),unit_amount:{currency_code:'USD',value:(prices[item.id]/100).toFixed(2)}}));
  const order=await api('/v2/checkout/orders','POST',{intent:'CAPTURE',purchase_units:[{reference_id:'plugright-test',description:'PlugRight prototype — test only; no goods supplied',items,amount:{currency_code:'USD',value,breakdown:{item_total:{currency_code:'USD',value}}}}],payment_source:{paypal:{experience_context:{shipping_preference:'NO_SHIPPING',user_action:'PAY_NOW'}}}},requestId);
  if(!order.id || !/^[A-Z0-9]{10,30}$/.test(order.id)) throw new PaymentError('Invalid sandbox order response.',502);
  return {id:order.id,ticket:await sign({id:order.id,setup:checked.setup,cents:checked.total,expires:Date.now()+15*60*1000}),mode:'sandbox'};
}
export function validateRemoteOrder(order:any, expected:{id:string;cents:number;setup?:Setup}) {
  const units=order?.purchase_units;
  if(order?.id!==expected.id || order.intent!=='CAPTURE' || !Array.isArray(units) || units.length!==1 || units[0].reference_id!=='plugright-test' || units[0].amount?.currency_code!=='USD' || units[0].amount?.value!==(expected.cents/100).toFixed(2)) throw new PaymentError('PayPal order amount or currency mismatch.',409);
  if(expected.setup){const items=units[0].items;if(!Array.isArray(items)||items.length!==expected.setup.cart.length||expected.setup.cart.some(item=>!items.some((p:any)=>p.sku===item.id&&p.quantity===String(item.quantity)&&p.unit_amount?.currency_code==='USD'&&p.unit_amount?.value===(prices[item.id]/100).toFixed(2))))throw new PaymentError('PayPal order items do not match the checked cart.',409);}
}
export async function captureOrder(ticket:string, raw:unknown) {
  const data=await verify(ticket), checked=inspect(raw);
  if(!checked.checkoutReady || JSON.stringify(validate(data.setup))!==JSON.stringify(checked.setup) || checked.total!==data.cents) throw new PaymentError('Equipment or cart changed. Create a new sandbox order.',409);
  const order=await api(`/v2/checkout/orders/${data.id}`);
  validateRemoteOrder(order,data);
  let result=order;
  if(order.status!=='COMPLETED') {
    if(order.status!=='APPROVED') throw new PaymentError('PayPal sandbox buyer approval is required.',409);
    result=await api(`/v2/checkout/orders/${data.id}/capture`,'POST',{},`plugright-${data.id}`);
  }
  const captures=result.purchase_units?.flatMap((u:any)=>u.payments?.captures??[])??[];
  if(result.status!=='COMPLETED' || captures.length!==1 || captures[0].status!=='COMPLETED' || captures[0].amount?.currency_code!=='USD' || captures[0].amount?.value!==(data.cents/100).toFixed(2)) throw new PaymentError('Sandbox completion could not be verified. Check the PayPal order status.',409);
  return {status:'COMPLETED',mode:'sandbox',orderId:data.id,captureId:captures[0].id,value:(data.cents/100).toFixed(2),currency:'USD'};
}

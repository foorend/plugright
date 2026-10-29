import { captureOrder, configuration, createOrder, PaymentError } from '@/lib/paypal';
export async function GET() { return Response.json(configuration(),{headers:{'Cache-Control':'no-store'}}); }
export async function POST(request:Request) {
  try {
    if(request.headers.get('origin')!==new URL(request.url).origin) throw new PaymentError('Start sandbox checkout from the same site.',403);
    const text=await request.text(); if(text.length>16000) throw new PaymentError('Request too large.');
    const body=JSON.parse(text);
    if(body.action==='create') return Response.json(await createOrder(body.setup));
    if(body.action==='capture') return Response.json(await captureOrder(body.ticket,body.setup));
    throw new PaymentError('Unsupported payment request.');
  } catch(error) { return Response.json({error:error instanceof PaymentError?error.message:'Could not process sandbox checkout. Check whether it completed.'},{status:error instanceof PaymentError?error.status:500}); }
}

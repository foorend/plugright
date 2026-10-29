import { inspect } from '@/lib/engine';
export async function POST(request:Request) {
  try { const text=await request.text(); if(text.length>10000) throw new Error('Request too large.'); return Response.json(inspect(JSON.parse(text))); }
  catch(error) { return Response.json({error:error instanceof Error?error.message:'Review the settings.'},{status:400}); }
}

'use client';
import {useRef,useState} from 'react';
import type {MLCEngineInterface} from '@mlc-ai/web-llm';
import {intakeInstructions,intakeSchema,MODEL_ID,parseIntake,resolveIntake} from '@/lib/intake';
import type {Setup} from '@/lib/engine';

export default function EquipmentIntake({disabled,onApply}:{disabled:boolean;onApply:(setup:Setup)=>void}) {
  const [text,setText]=useState(''),[busy,setBusy]=useState(false),[progress,setProgress]=useState(''),[error,setError]=useState('');
  const [review,setReview]=useState<ReturnType<typeof resolveIntake>|null>(null),[seconds,setSeconds]=useState(0);
  const engine=useRef<MLCEngineInterface|null>(null),generation=useRef(0);
  const edit=(value:string)=>{generation.current++;setText(value);setReview(null);setError('');};
  const analyze=async()=>{
    if(busy||disabled||!text.trim())return;
    const current=generation.current,start=performance.now();setBusy(true);setError('');setReview(null);
    try {
      if(!('gpu' in navigator))throw new Error('Browser AI requires WebGPU. Use a current desktop Chrome or Edge with hardware acceleration, or use the manual equipment controls below.');
      if(!engine.current){setProgress('Downloading browser model… First load may take several minutes.');const {CreateMLCEngine}=await import('@mlc-ai/web-llm');engine.current=await CreateMLCEngine(MODEL_ID,{initProgressCallback:p=>setProgress(p.text)},{context_window_size:4096});}
      setProgress('Reading your equipment description locally…');
      const response=await engine.current.chat.completions.create({messages:[{role:'system',content:intakeInstructions},{role:'user',content:text}],extra_body:{enable_thinking:false},temperature:0,max_tokens:850,response_format:{type:'json_object',schema:JSON.stringify(intakeSchema)}});
      const content=response.choices[0]?.message.content;
      if(response.choices[0]?.finish_reason==='length'||!content)throw new Error('The model did not finish. Try a shorter description, or use the manual controls.');
      const result=resolveIntake(parseIntake(content),text);
      if(current===generation.current){setReview(result);setSeconds((performance.now()-start)/1000);setProgress('Model response received. Review the quoted evidence before applying.');}
    } catch(e){if(current===generation.current){setError(e instanceof Error?e.message:'Browser AI could not finish. Use the manual controls below.');setProgress('No equipment or cart changes were applied.');}}
    finally {setBusy(false);}
  };
  return <section className="ai-intake" aria-labelledby="ai-title"><div className="ai-heading"><div><h2 id="ai-title">Describe it before you shop.</h2><p>Browser AI reads your equipment. You review it. The rule checker and server control compatibility and checkout.</p></div><span>Local AI · no API key</span></div>
    <label htmlFor="equipment-description">Your computer, monitor, target resolution/refresh rate, video port, planned item and all owned cables</label>
    <textarea id="equipment-description" maxLength={2000} value={text} disabled={busy||disabled} onChange={e=>edit(e.target.value)} placeholder="One external monitor: MacBook Air M2 with Dell U2723QE, 4K 60Hz, video USB-C input. I plan to buy an Anker 332 A8356 hub. I own only an Apple Thunderbolt 3 0.8m cable; no other cables."/>
    <div className="ai-actions"><button className="primary" disabled={busy||disabled||!text.trim()} onClick={analyze}>{busy?'Reading locally…':'Read with browser AI'}</button><button className="text-button" disabled={busy||disabled} onClick={()=>edit('One external monitor: MacBook Air M2 with Dell U2723QE, 4K 60Hz, video USB-C input. I plan to buy an Anker 332 A8356 hub. I own only an Apple Thunderbolt 3 0.8m cable; no other cables.')}>Use an example description</button></div>
    <small>Qwen3 4B via WebLLM. Downloads model files from Hugging Face and the WebLLM runtime; approximately 3.5GB GPU memory required. After loading, your description is processed on this device. No paid AI calls. Model interpretations can be wrong.</small>
    {progress&&<p className="ai-progress" role="status">{progress}</p>}{error&&<p className="payment-error" role="alert">{error}</p>}
    {review&&<div className="ai-review"><h3>What the model found <small>{seconds.toFixed(1)}s including any initial loading</small></h3><dl>{review.evidence.map((item,i)=><div key={i}><dt>{item.label}</dt><dd><strong>{item.value}</strong><q>{item.quote}</q></dd></div>)}</dl>{review.questions.length?<div className="ai-questions"><h3>Confirm the missing details</h3><ul>{review.questions.map(q=><li key={q}>{q}</li>)}</ul><p>Add these details and run AI again, or use the manual controls. No changes have been made.</p></div>:<><p>This proposes a single-item test cart for a planned connection, or no purchase for owned equipment. Check every extracted value before applying.</p><button className="primary" disabled={disabled} onClick={()=>{if(review.setup){onApply(review.setup);setReview(null);setProgress('Equipment applied. Run the compatibility check below; no payment has been started.');}}}>Use these details · then check connection</button></>}</div>}
  </section>;
}

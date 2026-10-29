import facts from './products.json' with { type: 'json' };

export type Setup = { host: string; display: string; mode: string; via: string; port: string; owned: string[]; cart: { id: string; quantity: number }[] };
export type Finding = { status: 'supported' | 'blocked' | 'unknown'; title: string; detail: string; point: 'host' | 'link' | 'display'; sources: { model: string; url: string }[] };
export const products = facts.products;
export const product = (id: string) => products.find(p => p.id === id);
export const names: Record<string, string> = { A1: 'Apple USB-C Charge Cable 2m', A2: 'Apple Thunderbolt 3 Cable 0.8m', A3: 'Apple Thunderbolt 3 → 2 Adapter', A4: 'StarTech USB-C → DP Cable', A5: 'StarTech USB-C → Mini DP', A6: 'StarTech USB-C → HDMI 4K60', A7: 'Apple Digital AV · A2119', A8: 'Apple Digital AV · A1621', K1: 'Plugable UD-6950H', K2: 'Plugable TBT4-UDZ', K3: 'Anker 332 · A8356' };
// Fictional, fixed test prices in cents; not market prices, inventory or an offer to sell.
export const prices: Record<string, number> = { A1: 1900, A2: 3900, A3: 4900, A4: 2400, A5: 2900, A6: 2900, A7: 6900, A8: 4900, K3: 3500 };
export const money = (cents: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
const links = products.filter(p => ['cable', 'adapter', 'adapter_revision', 'displaylink_dock', 'native_dock', 'alt_mode_hub'].includes(p.kind)).map(p => p.id);
export function validate(raw: unknown): Setup {
  if (!raw || typeof raw !== 'object') throw new Error('An equipment setup is required.');
  const s = raw as Setup;
  if (!['H1','H2','H3','H4','H5','unknown'].includes(s.host) || !['D1','D2','D3','D4','unknown'].includes(s.display) || !['1080p60','1440p60','4k30','4k60'].includes(s.mode) || ![...links,'unknown','none'].includes(s.via) || !['video','data','unknown'].includes(s.port)) throw new Error('Unsupported equipment or connection settings.');
  if (!Array.isArray(s.owned) || s.owned.length > 20 || s.owned.some(id => ![...links,'unknown'].includes(id)) || new Set(s.owned).size !== s.owned.length) throw new Error('Review your owned equipment.');
  if (!Array.isArray(s.cart) || s.cart.length > 10 || s.cart.some(i => !i || !Object.hasOwn(prices, i.id) || !Number.isInteger(i.quantity) || i.quantity < 1 || i.quantity > 3) || new Set(s.cart.map(i=>i.id)).size !== s.cart.length) throw new Error('Invalid cart items or quantities.');
  return { host:s.host, display:s.display, mode:s.mode, via:s.via, port:s.port, owned:[...s.owned], cart:s.cart.map(i=>({id:i.id,quantity:i.quantity})) };
}
export function total(cart: Setup['cart']) { return cart.reduce((sum, i) => sum + prices[i.id] * i.quantity, 0); }
export function evaluate(s: Setup, via = s.via): Finding {
  const ids = [...new Set([s.host, s.display, via])];
  const sources = ids.flatMap(id => (product(id)?.sources ?? []).map(url=>({model:product(id)!.model,url}))).filter((l,i,a)=>a.findIndex(x=>x.url===l.url)===i);
  const answer = (status:Finding['status'],title:string,detail:string,point:Finding['point']='link'):Finding=>({status,title,detail,point,sources});
  if (s.host==='unknown') return answer('unknown','Exact computer model required','A USB-C connector alone does not prove video support. Confirm the model, chip and year.','host');
  if (s.display==='unknown') return answer('unknown','Confirm the monitor model','Similar monitor sizes can have different inputs and resolutions.','display');
  if (via==='unknown' || via==='none') return answer('unknown','Confirm the cable model','A 100W or USB-C label alone does not prove video support.');
  const fromCart = s.cart.some(i=>i.id===via);
  if (!s.owned.includes(via) && !fromCart) return answer('unknown','The connection item is not available','Add the selected item to your owned list or test cart.');
  if (s.display==='D2' && s.mode!=='1080p60') return answer('blocked','The monitor cannot support this resolution','Dell P2422H supports up to 1920×1080 at 60Hz. A new cable cannot make it 4K.','display');
  if (['D3','D4'].includes(s.display) && s.mode!=='1440p60') return answer('unknown','Use 1440p 60Hz for this monitor','Only its native 2560×1440 mode is covered. Other timings are not confirmed.','display');
  if (via==='A1') return answer('blocked','A charge cable cannot carry video','This Apple 2m USB-C Charge Cable does not support video. Other Apple cable models may differ.');
  if (s.port==='unknown') return answer('unknown','Confirm the port','Distinguish video inputs from data-only USB-C ports.');
  if (s.port==='data') return answer('blocked','A data port is not a video input','This data-only USB-C port cannot display video. Use a video input.','display');
  if (via==='K1') return answer('unknown','Confirm the DisplayLink setup','UD-6950H uses USB data for video. Confirm the driver, OS, screen permissions and host cable before relying on it.');
  if (s.host==='H5') return answer('blocked','This laptop USB-C port has no video output','IdeaPad 3 15ALC6 has data-only USB-C. A normal video cable or hub cannot fix it. Check HDMI separately.','host');
  if (via==='A3') return s.display==='D4' ? answer('supported','A Thunderbolt path is supported','This connects the Mac Thunderbolt port to Apple Thunderbolt Display. It is not an adapter for Mini DisplayPort monitors.') : answer('blocked','Thunderbolt is not a Mini DP converter','Apple Thunderbolt 3 → 2 Adapter does not support ordinary DisplayPort or Mini DisplayPort monitors.');
  if (s.display==='D4') return answer('blocked','Thunderbolt Display needs Thunderbolt','Similar connector shapes do not make Mini DisplayPort and Thunderbolt interchangeable.');
  const accepts = s.display==='D1' ? ['A2','A4','A6','A7','A8','K2','K3'] : s.display==='D2' ? ['A4','A6','A7','A8','K2','K3'] : ['A5'];
  if (!accepts.includes(via)) return answer('blocked','The connection does not match the monitor input','Match the cable output to the monitor video input.');
  if (['A8','K3'].includes(via) && s.mode==='4k60') return answer('blocked','This connection is limited to 4K 30Hz',`${names[via]} supports up to 4K 30Hz. Use another path for 4K 60Hz.`);
  if (s.mode==='1440p60' && ['A8','K3'].includes(via)) return answer('unknown','This intermediate mode needs confirmation','A 4K 30Hz specification does not prove 60Hz support at every intermediate resolution.');
  if (via==='K2') return answer('supported','One monitor works through dock HDMI or DP','Use HDMI or DisplayPort video output, not rear data-only USB-C. This check covers one external monitor.');
  return answer('supported','Supported by manufacturer specifications',via==='A2' ? `${s.owned.includes(via)?'Owned':'Selected'} Thunderbolt 3 cable: connect directly to the Dell video USB-C upstream input. No separate hub needed.` : `${names[via]} supports the requested mode.${['A6','A7','A8','K3'].includes(via)?' A separate HDMI cable supporting that mode is also required.':''} Normal SDR desktop use with working equipment.`);
}
export function inspect(raw: unknown) {
  const s = validate(raw), current = evaluate(s);
  let proposal: { setup: Setup; finding: Finding; reused: boolean; note: string } | null = null;
  // Prefer an explicitly owned, known working link before proposing any purchase.
  for (const id of s.owned) {
    const next = {...s, via:id, cart:[], port:'video'};
    const f = evaluate(next);
    if (f.status==='supported') { proposal={setup:next,finding:f,reused:true,note:'Use owned equipment and remove new connection items from the cart.'}; break; }
  }
  // Keep a correct planned link instead of replacing it merely to shave off a test price.
  if(!proposal && s.cart.some(i=>i.id===s.via)) {
    const next={...s,port:'video',cart:[{id:s.via,quantity:1}]};
    const f=evaluate(next);
    if(f.status==='supported' && JSON.stringify(next)!==JSON.stringify(s)) proposal={setup:next,finding:f,reused:false,note:s.port==='data'?'Keep the item and switch to a video input instead of buying more equipment.':'Keep one selected connection item; remove extra items and quantities.'};
  }
  // Unknown information cannot be fixed by recommending a purchase.
  if (!proposal && !s.owned.includes('unknown') && current.status==='blocked' && current.point!=='host' && current.point!=='display') {
    const candidates = Object.keys(prices).filter(id=>!s.owned.includes(id)).sort((a,b)=>prices[a]-prices[b]);
    for (const id of candidates) {
      const next = {...s, via:id, cart:[{id,quantity:1}], port:'video'};
      const f=evaluate(next);
      if (f.status==='supported') { proposal={setup:next,finding:f,reused:false,note:'Replace the cart with one supported connection item. Prices are fictional demo prices.'}; break; }
    }
  }
  if (proposal && JSON.stringify(proposal.setup)===JSON.stringify(s)) proposal=null;
  const unused = s.cart.filter(i=>i.id!==s.via || s.owned.includes(i.id) || i.quantity!==1);
  const checkoutReady = current.status==='supported' && s.cart.length===1 && unused.length===0;
  const cartFindings=s.cart.map(item=>({id:item.id,finding:evaluate(s,item.id),extra:item.id!==s.via||s.owned.includes(item.id)||item.quantity!==1}));
  return { setup:s, current, proposal, unused, cartFindings, total:total(s.cart), afterTotal:proposal?total(proposal.setup.cart):total(s.cart), checkoutReady };
}
export const scenarios: Record<string, {title:string;description:string;setup:Setup}> = {
  reuse:{title:'Reuse before buying',description:'Check your owned Thunderbolt cable before buying a hub.',setup:{host:'H2',display:'D1',mode:'4k60',via:'K3',port:'video',owned:['A2'],cart:[{id:'K3',quantity:1}]}},
  repair:{title:'Repair a 4K 60Hz cart',description:'Catch a charge-only cable and a 4K 30Hz hub.',setup:{host:'H2',display:'D1',mode:'4k60',via:'K3',port:'video',owned:[],cart:[{id:'A1',quantity:1},{id:'K3',quantity:1}]}},
  unknown:{title:'When USB-C cannot work',description:'Can a new hub fix a data-only USB-C port?',setup:{host:'H5',display:'D2',mode:'1080p60',via:'A4',port:'video',owned:[],cart:[{id:'A4',quantity:1}]}}
};

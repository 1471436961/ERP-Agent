import fs from 'node:fs';

export async function checkERP(c) {
  const url=new URL(c.ERP_URL);
  if(url.username||url.password||url.search||url.hash||url.pathname!=='/') throw Error('ERP_URL must be a base origin without /login');
  if(url.protocol!=='https:' && !(url.protocol==='http:'&&['localhost','127.0.0.1','erp.localhost'].includes(url.hostname))) throw Error('Only loopback ERP may use HTTP');
  for(const key of ['ERP_API_KEY','ERP_API_SECRET','ERP_USER']) if(!c[key]||c[key].includes('<')) throw Error(`Missing ${key}; a browser password is not an API credential`);
  if(['Administrator','Guest'].includes(c.ERP_USER)) throw Error('Use a restricted ERP identity');
  const request=async p=>{
    const r=await fetch(url.origin+p,{headers:{Authorization:`token ${c.ERP_API_KEY}:${c.ERP_API_SECRET}`},redirect:'error',signal:AbortSignal.timeout(15000)});
    if(!r.ok)throw Error(`ERP HTTP ${r.status}: ${p.split('?')[0]}`);
    return r.json();
  };
  const id=await request('/api/method/frappe.auth.get_logged_user');
  if(id.message!==c.ERP_USER)throw Error('ERP identity differs from ERP_USER');
  const evidence={origin:url.origin,identity:'matched',checked_at:new Date().toISOString(),reads:{}};
  for(const dt of ['Item','Sales Order','Sales Invoice']) {
    const list=await request(`/api/resource/${encodeURIComponent(dt)}?limit_page_length=1`);
    if(!Array.isArray(list.data))throw Error('Invalid ERP response');
    if(list.data.length) {
      const detail=await request(`/api/resource/${encodeURIComponent(dt)}/${encodeURIComponent(list.data[0].name)}`);
      if(detail.data?.name!==list.data[0].name)throw Error('Record read-back mismatch');
    }
    evidence.reads[dt]=list.data.length?'list_and_detail_pass':'empty_dataset_permission_pass';
  }
  return evidence;
}
if(process.argv[1]?.endsWith('check-erp.mjs')) {
  try {console.log(JSON.stringify(await checkERP(JSON.parse(fs.readFileSync(process.argv[2],'utf8'))),null,2));}
  catch(e){console.error(e.message);process.exitCode=1;}
}

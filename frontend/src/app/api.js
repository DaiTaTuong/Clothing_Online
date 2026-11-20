export async function api(path, method='GET', data, signal) {
  const r=await fetch('/api'+path,{ method, signal, ...(data===undefined?{}:{headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}) });
  const result=await r.json();
  if (!r.ok) throw Object.assign(new Error(result.message||'Không thể kết nối. Hãy thử lại.'),{code:result.code,status:r.status});
  return result;
}
export const tryUrl = id => '/fitting-room'+(id?'?item_id='+encodeURIComponent(id):'');

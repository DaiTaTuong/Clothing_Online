import React,{useEffect,useRef,useState} from 'react';
import {ArrowUpRight,Bookmark,Check,Download,History,ImagePlus,LoaderCircle,Ruler,Shirt,ShoppingBag,Sparkles,Trash2} from 'lucide-react';
import {categoryNames,fitSize,measurements,money,sampleProfile} from '../../../../shared/contracts/index.mjs';
import {mannequin} from '../../../../shared/contracts/mannequin.mjs';
import {api,tryUrl} from '../../app/api.js';
import {Dialog,Empty,IconButton,Link} from '../../components/ui/index.jsx';
import {Measurements,TonePicker} from '../shop/Account.jsx';

const fields=[...Object.keys(measurements),'tone'];
const wait=()=>new Promise(r=>setTimeout(r,550));
async function poll(job,active,update) {
  while(active()&&['queued','processing'].includes(job.status)) {
    update(job);await wait();if(!active())return null;
    job=await api('/jobs/'+job.jobId);
  }
  return active()?job:null;
}
export function Fitting({session,products,itemId,look,navigate,onSession,saveProfile,onCart,notify,onItem}) {
  const [draft,setDraft]=useState(session?.profile||sampleProfile),[tab,setTab]=useState(''),[mode,setMode]=useState('result');
  const [job,setJob]=useState(null),[avatar,setAvatar]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(''),[consent,setConsent]=useState(false),[ai,setAI]=useState(false),[useFace,setUseFace]=useState(false),[retry,setRetry]=useState(0),[suggestions,setSuggestions]=useState([]);
  const [inputError,setInputError]=useState(''),[history,setHistory]=useState(null);
  const upload=useRef(null), avatarRequest=useRef(0), working=useRef(false);
  const saved=session?.profile||sampleProfile, profileVersion=session?.profileVersion;
  const dirty=fields.some(k=>draft[k]!==saved[k]), product=products[itemId];
  const aiAvailable=Boolean(product&&session?.settings.aiCategories.includes(product.category));
  const useAI=ai&&aiAvailable&&consent;
  const validAvatar=avatar&&avatar.profileVersion===profileVersion&&avatar.status==='completed'?avatar:null;
  const avatarId=useAI?validAvatar?.jobId:undefined;
  const profileSnapshot=JSON.stringify(saved);
  useEffect(()=>{if(session)setDraft(JSON.parse(profileSnapshot));},[profileSnapshot,session?.conversationId]);
  useEffect(()=>{onItem(itemId);return()=>onItem('');},[itemId,onItem]);
  useEffect(()=>{if(tab!=='recommended'||profileVersion===undefined)return;let active=true;api('/recommendations').then(r=>{if(active)setSuggestions(r.results.slice(0,8).map(x=>x.product));}).catch(()=>{if(active)setSuggestions([]);});return()=>{active=false;};},[tab,profileVersion]);
  useEffect(()=>{
    let active=true;
    setJob(null);setError('');
    if (profileVersion===undefined||!product||dirty||busy==='avatar') return;
    setMode('result');
    const start=look?api('/jobs/'+look):api('/try-ons','POST',{productId:product.id,profileVersion,avatarId,mode:useAI?'ai':'2d',consent:useAI});
    start.then(j=>{
      if(look&&(j.productId!==product.id||j.type!=='try-on'||!j.saved))throw Error('Không tìm thấy lượt thử đã lưu.');
      return poll(j,()=>active,setJob);
    }).then(j=>{if(j&&active){setJob(j);if(j.error)setError(j.error);}}).catch(e=>{if(active)setError(e.message);});
    return()=>{active=false;};
  },[itemId,look,profileVersion,product,dirty,avatarId,useAI,retry,busy==='avatar']);
  function change(k,v){avatarRequest.current++;setDraft(d=>({...d,[k]:v}));setError('');}
  async function updateBody() {
    if(working.current)return;
    working.current=true;const n=++avatarRequest.current;setBusy('avatar');setInputError('');setAvatar(null);
    try {
      const s=await saveProfile(draft,false);
      const done=await poll(await api('/avatars','POST',{profileVersion:s.profileVersion,useFace:useFace&&Boolean(s.faceId),consent}),()=>n===avatarRequest.current,setAvatar);
      if(done){setAvatar(done);if(done.error)setInputError(done.error);else notify('Đã cập nhật vóc dáng.');}
    } catch(e){setInputError(e.message);}finally{working.current=false;setBusy('');}
  }
  async function loadFace(file) {
    if(!file)return;
    setInputError('');
    if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>5*1024*1024){setInputError('Chọn ảnh JPG, PNG hoặc WebP tối đa 5 MB.');return;}
    setBusy('media');
    try {
      const image=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file);});
      await api('/media','POST',{image});onSession(await api('/session'));setAvatar(null);notify('Đã tải ảnh chân dung.');
    }catch(e){setInputError(e.message||'Không tải được ảnh.');}finally{setBusy('');}
  }
  async function deleteFace(){setBusy('media');setInputError('');try{onSession(await api('/media/'+session.faceId,'DELETE'));setUseFace(false);setAvatar(null);notify('Đã xóa ảnh chân dung.');}catch(e){setInputError(e.message);}finally{setBusy('');}}
  function download(){
    const svg=new Blob([mannequin(draft)],{type:'image/svg+xml'}),url=URL.createObjectURL(svg),img=new Image();
    img.onload=()=>{const canvas=document.createElement('canvas');canvas.width=768;canvas.height=1024;canvas.getContext('2d').drawImage(img,0,0);URL.revokeObjectURL(url);const a=document.createElement('a');a.href=canvas.toDataURL('image/png');a.download='body_2d.png';a.click();};img.src=url;
  }
  const selectedSize=product&&fitSize(product,session?.profile), list=tab==='recommended'?suggestions:Object.values(products).filter(p=>!tab||p.category===tab);
  const loading=product&&!dirty&&!error&&(!job||['queued','processing'].includes(job.status));
  const renderResult=mode==='result'&&!dirty&&job?.status==='completed';
  async function saveLook(){try{setJob(await api('/try-ons/'+job.jobId,'PATCH',{}));notify('Đã lưu lượt thử.');}catch(e){notify(e.message);}}
  async function openHistory(){setHistory({});try{setHistory(await api('/try-ons'));}catch(e){setHistory({error:e.message});}}
  if(!session)return <main className="shell page-loading">Đang tải phòng thử đồ…</main>;
  return <main className="shell fitting-page">
    <header className="page-head"><span className="eyebrow"><span/> FORME° FITTING STUDIO</span><h1>Phòng thử đồ</h1></header>
    <div className="fitting-grid">
      <section className="fit-panel fit-profile"><div className="panel-title"><span>01</span><Ruler size={19}/><h2>Vóc dáng</h2></div>
        <div className="face-control"><input ref={upload} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={e=>{loadFace(e.target.files?.[0]);e.target.value='';}}/>
          {session.faceId?<><img src={'/api/media/'+session.faceId} alt="Ảnh chân dung đã tải"/><strong>Ảnh chân dung</strong><IconButton label="Xóa ảnh chân dung" disabled={!!busy} onClick={deleteFace}><Trash2 size={16}/></IconButton></>:
            <button className="btn btn-outline wide" disabled={!!busy} onClick={()=>upload.current.click()}><ImagePlus size={18}/> Tải ảnh chân dung</button>}
        </div>
        {session.faceId&&<small className="muted">Ảnh nguồn được giữ tối đa 24 giờ.</small>}
        <TonePicker value={draft.tone} onChange={v=>change('tone',v)}/>
        <Measurements profile={draft} change={change} sliders/>
        {(session.settings.faceSwap&&session.faceId||aiAvailable)&&<label className="check-label"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/> Tôi đồng ý gửi ảnh dùng cho lần xử lý đến dịch vụ AI.</label>}
        {session.settings.faceSwap&&session.faceId&&<label className="check-label"><input type="checkbox" checked={useFace} disabled={!consent} onChange={e=>setUseFace(e.target.checked)}/> Cá nhân hóa khuôn mặt</label>}
        {!session.settings.faceSwap&&session.faceId&&<p className="muted">Cá nhân hóa khuôn mặt chưa bật; bản thử dùng mặt mặc định.</p>}
        {inputError&&<p className="error" role="alert">{inputError}</p>}
        <button className="btn btn-primary wide" disabled={!!busy} onClick={updateBody}>{busy==='avatar'?<LoaderCircle className="spin" size={17}/>:<Check size={17}/>} {avatar?.stage==='sync-face'?'Đang đồng bộ khuôn mặt…':'Cập nhật vóc dáng'}</button>
      </section>
      <section className="fit-stage"><div className="stage-tools"><div className="segmented"><button className={mode==='body'?'current':''} onClick={()=>setMode('body')} aria-pressed={mode==='body'}>Phôi 2D</button><button className={mode==='result'?'current':''} onClick={()=>setMode('result')} aria-pressed={mode==='result'}>Kết quả thử</button></div><div className="stage-actions"><IconButton label="Lượt thử đã lưu" onClick={openHistory}><History size={18}/></IconButton><IconButton label="Tải phôi PNG 768 × 1024" onClick={download}><Download size={18}/></IconButton></div></div>
        <div className="model-frame" data-testid="model-frame">
          {renderResult?<img src={job.imageUrl} alt={`Kết quả thử ${product.name}`}/>:mode==='result'&&!dirty&&validAvatar?.mode==='face'?<img src={validAvatar.imageUrl} alt="Phôi cá nhân hóa"/>:<div className="model-svg" role="img" aria-label="Mannequin 2D" dangerouslySetInnerHTML={{__html:mannequin(draft)}}/>}
          <div className="frame-label"><span/> {renderResult?(job.mode==='ai'?'KẾT QUẢ AI':'MINH HỌA 2D'):'PHÔI 2D'} </div>
          {mode==='result'&&loading&&<div className="model-status" role="status"><LoaderCircle size={18} className="spin"/> {useAI?'Đang ướm trang phục bằng AI…':'Đang dựng bản thử 2D…'}</div>}
          {renderResult&&<IconButton className="save-look" label={job.saved?'Đã lưu lượt thử':'Lưu lượt thử'} disabled={job.saved} onClick={saveLook}><Bookmark size={19} fill={job.saved?'currentColor':'none'}/></IconButton>}
        </div>
        {error&&<p className="error stage-error" role="alert">{error} <button className="text-button" onClick={()=>look?navigate(tryUrl(itemId)):setRetry(n=>n+1)}>Thử lại</button></p>}
        {dirty&&<p className="muted">Cập nhật vóc dáng để thử với số đo mới.</p>}
        {!product&&itemId&&Object.keys(products).length>0&&<p className="error">Không tìm thấy món đồ này.</p>}
        {aiAvailable&&!look&&<label className="check-label"><input type="checkbox" disabled={!consent} checked={useAI} onChange={e=>setAI(e.target.checked)}/> Thử bằng AI</label>}
        <p className="stage-caption">Ảnh thử để tham khảo. Chọn size theo bảng số đo.</p>
      </section>
      <section className="fit-panel fit-wardrobe"><div className="panel-title"><span>02</span><Shirt size={19}/><h2>Tủ đồ</h2></div>
        <div className="wardrobe-tabs tabs">{[['','Tất cả'],...Object.entries(categoryNames),['recommended','Stylist']].map(([k,label])=><button key={k} className={tab===k?'current':''} aria-pressed={tab===k} onClick={()=>setTab(k)}>{k==='recommended'&&<Sparkles size={13}/>} {label}</button>)}</div>
        {product&&<div className="selected-garment"><div><span className="eyebrow">ĐANG CHỌN</span><strong>{product.name}</strong><small>{money(product.price)}{selectedSize&&` · Size tham khảo ${selectedSize}`}</small></div><button className="btn btn-primary wide" onClick={()=>onCart(product)}><ShoppingBag size={16}/> Thêm vào giỏ</button></div>}
        <div className="wardrobe-list">{list.map(p=><button key={p.id} className={p.id===itemId?'selected':''} onClick={()=>{if(p.id!==itemId||look){setAI(false);navigate(tryUrl(p.id),false);}}} aria-pressed={p.id===itemId}><img src={p.image} alt="" loading="lazy"/><span><strong>{p.name}</strong><small>{money(p.price)}</small></span>{p.id===itemId?<Check size={17}/>:<ArrowUpRight size={16}/>}</button>)}</div>
      </section>
    </div>
    {history&&<Dialog title="Lượt thử đã lưu" close={()=>setHistory(null)}>
      {history.error?<p className="error" role="alert">{history.error}</p>:!history.items?<p className="muted">Đang tải…</p>:!history.items.length?<Empty icon={Bookmark} title="Chưa lưu lượt thử nào"/>:
        <div className="history-grid">{history.items.map(j=><Link key={j.jobId} className="history-item" to={tryUrl(j.productId)+'&look='+j.jobId} navigate={navigate} onClick={()=>setHistory(null)}><img src={j.imageUrl} alt="Ảnh thử trang phục đã lưu"/><strong>{products[j.productId]?.name||'Lượt thử'}</strong><small>{j.mode==='ai'?'AI':'Minh họa 2D'}</small></Link>)}</div>}
    </Dialog>}
  </main>;
}

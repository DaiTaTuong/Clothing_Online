import React,{useEffect,useRef,useState} from 'react';
import {ArrowUpRight,Send,Sparkles,X} from 'lucide-react';
import {money} from '../../../../shared/contracts/index.mjs';
import {api,tryUrl,trySetUrl} from '../../app/api.js';
import {IconButton,Link} from '../../components/ui/index.jsx';
const prompts=['Phối đồ đi chơi cuối tuần','Màu nào tôn da mình?','Tìm quần hack chiều cao'];
export function Chat({open,setOpen,session,products,navigate,page,productId}) {
  const [messages,setMessages]=useState([]),[value,setValue]=useState(''),[pending,setPending]=useState(''),[error,setError]=useState('');
  const bottom=useRef(null), identity=useRef(''), sending=useRef(false);
  useEffect(()=>{let active=true;identity.current=session?.conversationId;setMessages([]);setPending('');setError('');sending.current=false;if(session?.conversationId)api('/conversations/'+session.conversationId).then(r=>{if(active)setMessages(r.messages);}).catch(()=>{});return()=>{active=false;};},[session?.conversationId]);
  useEffect(()=>{if(open)bottom.current?.scrollIntoView({block:'nearest'});},[messages,pending,open]);
  async function send(message) {
    const text=message.trim(), id=identity.current;
    if(!text||!session||sending.current)return;
    sending.current=true;setValue('');setPending(text);setError('');
    try{const result=await api('/chat','POST',{message:text,page,productId});if(id===identity.current)setMessages(result.messages);}
    catch(e){if(id===identity.current){setError(e.message);setValue(text);}}
    finally{if(id===identity.current){sending.current=false;setPending('');}}
  }
  return <div className="chat-widget">
    {open&&<section className="chat-panel" aria-label="FORME Stylist">
      <div className="chat-header"><span className="chat-spark"><Sparkles size={21}/></span><div><strong>FORME Stylist</strong><small>{session?.profile?`Hồ sơ: ${session.profile.height} cm · ${session.profile.weight} kg`:session?.settings.stylist==='llm'?'Trợ lý thời trang AI':'Tư vấn theo danh mục'}</small></div><IconButton label="Đóng Stylist" onClick={()=>setOpen(false)}><X size={20}/></IconButton></div>
      <div className="chat-messages" role="log" aria-label="Hội thoại">
        <p className="chat-bubble assistant">Chào bạn! Hôm nay bạn muốn mặc gì?</p>
        {messages.map(m=>{const validCards=(m.cards||[]).filter(c=>products[c.productId]);return <div key={m.id} className={'chat-message '+m.role}><p className={'chat-bubble '+m.role}>{m.text}</p>
          {validCards.map(c=>{const p=products[c.productId];return <article className="chat-product" key={c.productId}><img src={p.image} alt=""/><div><strong>{p.name}</strong><small>{money(p.price)}{c.recommendedSize&&` · Size ${c.recommendedSize}`}</small><Link className="text-button" to={tryUrl(p.id)} navigate={navigate} onClick={()=>setOpen(false)}>Thử ngay <ArrowUpRight size={13}/></Link></div></article>;})}
          {validCards.length>=2&&<Link className="btn btn-outline" style={{marginTop:'6px',fontSize:'12px',padding:'6px 10px'}} to={trySetUrl(validCards.map(c=>c.productId))} navigate={navigate} onClick={()=>setOpen(false)}><Sparkles size={13}/> Phối cả set này ({validCards.length} món)</Link>}</div>;})}
        {pending&&<><p className="chat-bubble user">{pending}</p><p className="chat-bubble assistant muted">Đang chọn đồ…</p></>}
        {error&&<p className="error" role="alert">{error}</p>}<div ref={bottom}/>
      </div>
      <div className="chat-prompts">{prompts.map(p=><button key={p} onClick={()=>send(p)} disabled={!!pending}>{p}</button>)}</div>
      <form className="chat-compose" onSubmit={e=>{e.preventDefault();send(value);}}><input aria-label="Tin nhắn Stylist" placeholder="Hỏi Stylist…" maxLength={500} value={value} onChange={e=>setValue(e.target.value)}/><button className="icon-btn" aria-label="Gửi tin nhắn" title="Gửi tin nhắn" disabled={!value.trim()||!!pending}><Send size={18}/></button></form>
    </section>}
    <button className="chat-toggle" onClick={()=>setOpen(v=>!v)} aria-label={open?'Thu gọn Stylist':'Mở AI Stylist'} aria-expanded={open} title="FORME Stylist">{open?<X size={21}/>:<Sparkles size={21}/>} <span>{open?'Thu gọn':'AI Stylist'}</span></button>
  </div>;
}

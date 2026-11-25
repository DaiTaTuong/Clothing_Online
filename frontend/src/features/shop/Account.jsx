import React,{useEffect,useState} from 'react';
import {ArrowRight, Bookmark, Check, ChevronRight, Eye, EyeOff, LogOut, Minus, Plus, Ruler, Shield, ShoppingBag, Trash2, UserRound} from 'lucide-react';
import {categoryNames,fitSize,measurements,money,sampleProfile,sizeGuide,styles,faceShapes,tones} from '../../../../shared/contracts/index.mjs';
import {api,tryUrl} from '../../app/api.js';
import {Dialog,Empty,IconButton,Link} from '../../components/ui/index.jsx';

export function TonePicker({value,onChange}) {
  return <div className="tone-field"><span>Tông da <small>{tones[value].name}</small></span><div className="swatches">{tones.map((t,i)=><button key={t.name} type="button" style={{'--tone':t.color}} aria-label={t.name} title={t.name} aria-pressed={i===value} onClick={()=>onChange(i)}>{i===value&&<Check size={15}/>}</button>)}</div></div>;
}
export function Measurements({profile,change,sliders=false}) {
  return <div className={sliders?'measurements sliders':'measurements numeric'}>{Object.entries(measurements).map(([key,[label,min,max,unit]])=><label key={key}>
    <span>{label}{sliders&&<output>{profile[key]} {unit}</output>}</span>
    <input aria-label={label} type={sliders?'range':'number'} min={min} max={max} required value={profile[key]} onChange={e=>change(key,e.target.value===''?'':Number(e.target.value))}/>
    {!sliders&&<small>{unit}</small>}
  </label>)}</div>;
}
export function ProfileDialog({session,close,navigate,save}) {
  const [profile,setProfile]=useState(session.profile||sampleProfile),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const change=(key,v)=>setProfile(p=>({...p,[key]:v}));
  return <Dialog title="Hồ sơ vóc dáng" eyebrow="FORME° PROFILE" close={close}><form className="form-stack" onSubmit={async e=>{e.preventDefault();setBusy(true);setError('');try{await save(profile);close();}catch(ex){setError(ex.message);}finally{setBusy(false);}}}>
    <Measurements profile={profile} change={change}/>
    <TonePicker value={profile.tone} onChange={v=>change('tone',v)}/>
    <label>Phong cách yêu thích<select value={profile.style} onChange={e=>change('style',e.target.value)}><option value="">Chưa chọn</option>{Object.entries(styles).map(([key,v])=><option key={key} value={key}>{v}</option>)}</select></label>
    <label>Dáng mặt <small>(tùy chọn)</small><select value={profile.faceShape} onChange={e=>change('faceShape',e.target.value)}><option value="">Chưa chọn</option>{Object.entries(faceShapes).map(([key,v])=><option key={key} value={key}>{v}</option>)}</select></label>
    {error&&<p role="alert" className="error">{error}</p>}
    <button className="btn btn-primary" disabled={busy}>Lưu hồ sơ <ArrowRight size={17}/></button>
    <Link className="text-button center" to={tryUrl()} navigate={navigate} onClick={close}>Mở phòng thử đồ</Link>
  </form></Dialog>;
}
export function SizeDialog({product:p,profile,close,navigate,add,showTry=true}) {
  const recommended=fitSize(p,profile), [size,setSize]=useState(recommended||''),[busy,setBusy]=useState(false),[error,setError]=useState('');
  return <Dialog title={p.name} close={close} eyebrow={categoryNames[p.category]}><div className="size-product"><img src={p.image} alt={p.name}/><div><strong>{money(p.price)}</strong><p>{p.color} · {p.description}</p>{showTry&&<Link className="text-button" to={tryUrl(p.id)} navigate={navigate} onClick={close}>Thử đồ <ChevronRight size={14}/></Link>}</div></div>
    <div className="size-pick"><strong>Chọn size</strong></div>
    <div className="size-options">{Object.keys(sizeGuide).map(s=>{const n=p.stock?.[s]??0;return <button key={s} type="button" className={s===size?'current':''} disabled={!n} aria-pressed={s===size} onClick={()=>setSize(s)}>{s}</button>;})}</div>
    <details className="size-chart"><summary>Bảng size gợi ý</summary><table><thead><tr><th>Size</th><th>Chiều cao</th><th>Cân nặng</th></tr></thead><tbody>{Object.entries(sizeGuide).map(([s,g])=><tr key={s}><th>{s}</th><td>{p.sizeChart?.[s]?.height||g.height}</td><td>{p.sizeChart?.[s]?.weight||g.weight}</td></tr>)}</tbody></table><small>Gợi ý chọn size theo chiều cao và cân nặng; nếu phân vân giữa 2 size, hãy ưu tiên size lớn hơn.</small></details>
    {error&&<p role="alert" className="error">{error}</p>}
    <button className="btn btn-primary wide" disabled={!size||busy} onClick={async()=>{setBusy(true);setError('');try{await add(p,size);close();}catch(e){setError(e.message);}finally{setBusy(false);}}}><ShoppingBag size={17}/> Thêm vào giỏ</button>
  </Dialog>;
}
export function Cart({cart,close,update}) {
  const [busy,setBusy]=useState(''),[error,setError]=useState('');
  const apply=async(item,quantity)=>{
    setBusy(item.productId+item.size);setError('');
    try{await update(item,quantity);}catch(e){setError(e.message);}finally{setBusy('');}
  };
  return <Dialog title={`Giỏ hàng (${cart.count})`} eyebrow="TÚI ĐỒ CỦA BẠN" close={close} drawer>
    {!cart.items.length?<Empty title="Giỏ hàng đang trống"><button className="btn btn-primary" onClick={close}>Tiếp tục khám phá</button></Empty>:<>
      <div className="cart-lines">{cart.items.map(item=><article className="cart-line" key={item.productId+item.size}>
        <img src={item.product.image} alt={item.product.name}/><div><strong>{item.product.name}</strong><small>{item.product.color} · Size {item.size}</small><div className="stepper">
          <IconButton label="Giảm số lượng" disabled={!!busy||item.quantity===1} onClick={()=>apply(item,item.quantity-1)}><Minus size={14}/></IconButton><span>{item.quantity}</span><IconButton label="Tăng số lượng" disabled={!!busy||item.quantity>=item.product.stock[item.size]} onClick={()=>apply(item,item.quantity+1)}><Plus size={14}/></IconButton>
        </div></div><div className="cart-line-end"><IconButton label="Xóa sản phẩm" disabled={!!busy} onClick={()=>apply(item,0)}><Trash2 size={16}/></IconButton><strong>{money(item.subtotal)}</strong></div>
      </article>)}</div>
      {error&&<p role="alert" className="error">{error}</p>}
      <div className="cart-total"><span>Tạm tính</span><strong>{money(cart.total)}</strong></div><p className="muted">Giỏ hàng demo, chưa hỗ trợ thanh toán.</p>
      <button className="btn btn-primary wide" onClick={close}>Tiếp tục khám phá <ArrowRight size={16}/></button>
    </>}
  </Dialog>;
}
export function Account({session,products,navigate,onSession,editProfile,notify}) {
  const [mode,setMode]=useState('login'),[visible,setVisible]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const [history,setHistory]=useState(null),[overview,setOverview]=useState(null);
  useEffect(()=>{let active=true;setHistory(null);setOverview(null);if(session?.user){api('/try-ons').then(r=>{if(active)setHistory(r.items);}).catch(e=>{if(active)setError(e.message);});if(session.user.role==='admin'&&session.settings.demoAdmin)api('/admin/overview').then(r=>{if(active)setOverview(r);}).catch(e=>{if(active)setError(e.message);});}return()=>{active=false;};},[session?.user?.id]);
  async function submit(data,type) {setBusy(true);setError('');try{onSession(await api('/auth/'+type,'POST',data));notify(type==='logout'?'Bạn đã đăng xuất.':type==='register'?'Đã tạo tài khoản.':'Đã đăng nhập.');}catch(e){setError(e.message);}finally{setBusy(false);}}
  if (!session) return <main className="shell page-loading" aria-busy="true">Đang tải tài khoản…</main>;
  if (session.user) return <main className="shell account-page">
    <div className="page-head"><span className="eyebrow"><span/> FORME° ACCOUNT</span><h1>Chào {session.user.name}.</h1><p>{session.user.email}</p></div>
    <div className="account-layout">
      <div className="account-tools"><button className="account-row" onClick={editProfile}><Ruler size={19}/><span>Hồ sơ vóc dáng</span><ChevronRight size={17}/></button><button className="account-row" disabled={busy} onClick={()=>submit(undefined,'logout')}><LogOut size={19}/><span>Đăng xuất</span><ChevronRight size={17}/></button>
        {overview&&<section className="admin-overview"><h2><Shield size={18}/> Quản trị demo</h2><dl><div><dt>Sản phẩm</dt><dd>{overview.products}</dd></div><div><dt>Tài khoản</dt><dd>{overview.accounts}</dd></div><div><dt>Lượt xử lý còn lưu</dt><dd>{overview.jobs}</dd></div></dl></section>}
      </div><section className="account-history"><h2>Lượt thử đã lưu</h2>{history===null?<p className="muted">Đang tải…</p>:!history.length?<Empty icon={Bookmark} title="Chưa lưu lượt thử nào"><Link className="btn btn-outline" to={tryUrl()} navigate={navigate}>Vào phòng thử đồ</Link></Empty>:<div className="history-grid">{history.map(j=>{const ids=(j.productIds?.length?j.productIds:[j.productId]).filter(Boolean);const title=ids.map(id=>products[id]?.name||id).join(' + ')||'Lượt thử';const link=ids.length>1?`/fitting-room?items=${encodeURIComponent(ids.join(','))}&look=${encodeURIComponent(j.jobId)}`:`${tryUrl(j.productId)}${j.productId?'&':'?'}look=${encodeURIComponent(j.jobId)}`;return <Link key={j.jobId} to={link} navigate={navigate} className="history-item"><img src={j.imageUrl} alt="Ảnh thử trang phục đã lưu"/><strong>{title}</strong><small>{j.mode==='ai'?'AI':'Minh họa 2D'}</small></Link>;})}</div>}</section>
    </div>{error&&<p className="error" role="alert">{error}</p>}
  </main>;
  return <main className="shell auth-page"><div className="auth-photo"><img src="/images/studio.jpg" alt="Ảnh bộ sưu tập Forme Studio"/><span className="eyebrow">FORME° STUDIO / COLLECTION 01</span></div><section className="auth-content">
    <div className="eyebrow"><span/> FORME° ACCOUNT</div><h1>{mode==='login'?'Chào bạn.':'Tạo tài khoản.'}</h1>
    <div className="segmented auth-tabs">{[['login','Đăng nhập'],['register','Đăng ký']].map(([v,label])=><button key={v} type="button" aria-pressed={mode===v} className={mode===v?'current':''} onClick={()=>{setMode(v);setError('');}}>{label}</button>)}</div>
    <form className="form-stack" onSubmit={e=>{e.preventDefault();submit(Object.fromEntries(new FormData(e.currentTarget)),mode);}}>
      {mode==='register'&&<label>Tên của bạn<input name="name" autoComplete="name" required minLength={2} maxLength={60} placeholder="Họ và tên"/></label>}
      <label>Email<input name="email" type="email" autoComplete="email" required placeholder="ban@example.com"/></label>
      <label>Mật khẩu<span className="password-wrap"><input name="password" type={visible?'text':'password'} autoComplete={mode==='login'?'current-password':'new-password'} minLength={8} maxLength={128} required placeholder="Tối thiểu 8 ký tự"/><IconButton label={visible?'Ẩn mật khẩu':'Hiện mật khẩu'} onClick={()=>setVisible(v=>!v)}>{visible?<EyeOff size={18}/>:<Eye size={18}/>}</IconButton></span></label>
      {error&&<p className="error" role="alert">{error}</p>}
      <button className="btn btn-primary" disabled={busy}><UserRound size={17}/> {mode==='login'?'Đăng nhập':'Đăng ký'} <ArrowRight size={17}/></button>
    </form>
    {session.settings.demoAdmin&&<button className="btn btn-outline wide demo-login" disabled={busy} onClick={()=>submit({email:'studio@forme.demo',password:'FormeStudio2026!'},'login')}><Shield size={17}/> Vào bằng tài khoản quản trị demo</button>}
    <Link className="text-button" to="/" navigate={navigate}>Tiếp tục với tư cách khách <ChevronRight size={15}/></Link>
  </section></main>;
}

import React,{useCallback,useEffect,useRef,useState} from 'react';
import {ArrowUpRight, ChevronDown, CircleAlert, Menu, Ruler, Search, ShoppingBag, Sparkles, UserRound, X} from 'lucide-react';
import {tones} from '../../../shared/contracts/index.mjs';
import {api,tryUrl} from './api.js';
import {IconButton,Link} from '../components/ui/index.jsx';
import {Account,Cart,ProfileDialog,SizeDialog} from '../features/shop/Account.jsx';
import {Shop} from '../features/shop/Shop.jsx';
import {Fitting} from '../features/fitting-room/Fitting.jsx';
import {Chat} from '../features/chat/Chat.jsx';
const emptyCart={items:[],count:0,total:0};
const location=()=>window.location.pathname+window.location.search;
export function App(){
  const [route,setRoute]=useState(location),[session,setSession]=useState(null),[products,setProducts]=useState({});
  const [dialog,setDialog]=useState(null),[chat,setChat]=useState(false),[item,setItem]=useState(''),[toast,setToast]=useState(''),[initError,setInitError]=useState(''),[redo,setRedo]=useState(0),[menu,setMenu]=useState(false);
  const [search,setSearch]=useState(()=>new URLSearchParams(window.location.search).get('q')||'');
  const notice=useRef(0);
  const notify=useCallback(text=>{setToast(text);clearTimeout(notice.current);notice.current=setTimeout(()=>setToast(''),3600);},[]);
  const close=useCallback(()=>setDialog(null),[]);
  const navigate=useCallback((to,top=true)=>{
    if(location()!==to) {window.history.pushState({},'',to);setRoute(to);}
    setMenu(false);
    if(top)window.scrollTo({top:0,behavior:'instant'});
  },[]);
  useEffect(()=>{const pop=()=>{setRoute(location());setMenu(false);setDialog(null);};window.addEventListener('popstate',pop);return()=>window.removeEventListener('popstate',pop);},[]);
  useEffect(()=>{
    let active=true;setInitError('');
    api('/session').then(s=>{if(active)setSession(s);return api('/products');}).then(r=>{if(active)setProducts(Object.fromEntries(r.items.map(p=>[p.id,p])));}).catch(e=>{if(active)setInitError(e.message);});
    return()=>{active=false;};
  },[redo]);
  const [path,raw]=route.split('?'), params=new URLSearchParams(raw), query=params.get('q')||'';
  const fitting=path==='/fitting-room', account=path==='/account', shop=!fitting&&!account;
  useEffect(()=>setSearch(query),[query]);
  const profile=session?.profile, cart=session?.cart||emptyCart;
  async function saveProfile(p,say=true){const value=await api('/profile','PUT',p);setSession(value);if(say)notify('Đã lưu hồ sơ vóc dáng.');return value;}
  async function add(p,size){const next=await api('/cart/items','POST',{productId:p.id,size});setSession(s=>({...s,cart:next}));notify(`Đã thêm ${p.name} · size ${size}`);}
  async function updateCart(p,quantity){const next=await api('/cart/items',quantity===0?'DELETE':'PATCH',{productId:p.productId,size:p.size,quantity});setSession(s=>({...s,cart:next}));}
  const onCart=p=>setDialog({type:'size',product:p,showTry:false});
  const onDetail=p=>setDialog({type:'size',product:p,showTry:true});
  const editProfile=()=>setDialog({type:'profile'});
  const submitSearch=e=>{e.preventDefault();navigate(search.trim()?'/?q='+encodeURIComponent(search.trim()):'/');};
  return <>
    <header className="site-header"><div className="nav-shell">
      <IconButton className="mobile-menu" label={menu?'Đóng điều hướng':'Mở điều hướng'} aria-expanded={menu} onClick={()=>setMenu(v=>!v)}>{menu?<X size={20}/>:<Menu size={20}/>}</IconButton>
      <Link to="/" navigate={navigate} className="brand" aria-label="FORME Studio, cửa hàng"><strong>FORME<span>°</span></strong><small>STUDIO</small></Link>
      <nav className={'top-nav '+(menu?'expanded':'')} aria-label="Điều hướng chính">
        <Link to="/" navigate={navigate} aria-current={shop?'page':undefined}>Cửa hàng</Link>
        <Link to={tryUrl()} navigate={navigate} aria-current={fitting?'page':undefined}>Phòng thử đồ <Sparkles size={13}/></Link>
      </nav>
      <form className="search" role="search" onSubmit={submitSearch}><button aria-label="Tìm kiếm" type="submit"><Search size={18}/></button><input aria-label="Tìm sản phẩm" placeholder="Tìm áo, quần, hoặc một phong cách…" value={search} maxLength={140} onChange={e=>setSearch(e.target.value)}/>{search&&<button aria-label="Xóa từ khóa" type="button" onClick={()=>{setSearch('');if(query)navigate('/');}}><X size={15}/></button>}</form>
      <div className="nav-actions">
        <button className="profile-pill" disabled={!session} onClick={editProfile} aria-label="Hồ sơ vóc dáng"><span className="profile-avatar"><Ruler size={15}/></span><span>{profile?`${profile.height} cm · ${profile.weight} kg`:'Vóc dáng'}{profile&&<small>{tones[profile.tone].name}</small>}</span><ChevronDown size={13}/></button>
        <IconButton label={`Giỏ hàng (${cart.count})`} className="nav-cart" disabled={!session} onClick={()=>setDialog({type:'cart'})}><ShoppingBag size={21}/>{cart.count>0&&<span>{cart.count}</span>}</IconButton>
        <Link to="/account" className="icon-btn" navigate={navigate} aria-label="Tài khoản" title={session?.user?.name||'Tài khoản'}><UserRound size={21}/></Link>
      </div>
    </div></header>
    {initError&&<div className="shell boot-error" role="alert"><CircleAlert size={16}/> {initError} <button className="text-button" onClick={()=>setRedo(n=>n+1)}>Tải lại</button></div>}
    {fitting?<Fitting session={session} products={products} itemId={params.get('item_id')||''} look={params.get('look')} navigate={navigate} onSession={setSession} {...{saveProfile,onCart,notify}} onItem={setItem}/>:
      account?<Account session={session} onSession={setSession} {...{products,navigate,editProfile,notify}}/>:
      <Shop {...{session,navigate,query,onCart,onDetail}} openChat={()=>setChat(true)} />}
    <footer className="site-footer"><div className="shell footer-inner"><Link to="/" navigate={navigate} className="brand"><strong>FORME<span>°</span></strong><small>STUDIO</small></Link><span>© {new Date().getFullYear()} FORME Studio</span><Link to={tryUrl()} navigate={navigate}>Phòng thử đồ <ArrowUpRight size={15}/></Link></div></footer>
    {session&&!account&&<Chat open={chat} setOpen={setChat} session={session} {...{products,navigate}} page={fitting?'fitting':'shop'} productId={fitting?item:undefined}/>}
    {dialog?.type==='profile'&&session&&<ProfileDialog {...{session,close,navigate}} save={saveProfile}/>}
    {dialog?.type==='size'&&<SizeDialog product={dialog.product} showTry={dialog.showTry} {...{profile,close,navigate,add}}/>}
    {dialog?.type==='cart'&&<Cart {...{cart,close}} update={updateCart}/>}
    {toast&&<div className="toast" role="status">{toast}<IconButton label="Đóng thông báo" onClick={()=>setToast('')}><X size={15}/></IconButton></div>}
  </>;
}

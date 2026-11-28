import React, {useEffect,useRef} from 'react';
import {X, ArrowUpRight, Shirt, Plus, Sparkles, ShoppingBag, SlidersHorizontal} from 'lucide-react';
import {categoryNames,money,occasionNames} from '../../../../shared/contracts/index.mjs';
import {tryUrl} from '../../app/api.js';

export function Link({ to, navigate, onClick, children, ...props }) {
  return <a href={to} {...props} onClick={e=>{onClick?.(e); if (!e.defaultPrevented && e.button===0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {e.preventDefault();navigate(to);}}}>{children}</a>;
}
export function IconButton({label,children,...props}) {
  return <button type="button" title={label} aria-label={label} {...props} className={`icon-btn ${props.className||''}`}>{children}</button>;
}
export function Dialog({title,eyebrow,close,children,drawer=false}) {
  const dialog=useRef(null);
  useEffect(()=>{
    const node=dialog.current, focus=document.activeElement;
    node.showModal();
    const overflow=document.body.style.overflow;
    document.body.style.overflow='hidden';
    return ()=>{node.close();document.body.style.overflow=overflow;focus?.focus?.();};
  },[]);
  return <dialog ref={dialog} className={drawer?'dialog drawer':'dialog'} aria-label={title} onCancel={e=>{e.preventDefault();close();}} onClick={e=>{if(e.target===e.currentTarget)close();}}>
    <div className="dialog-inner">
      <div className="dialog-heading"><div>{eyebrow&&<span className="eyebrow">{eyebrow}</span>}<h2>{title}</h2></div><IconButton label="Đóng" onClick={close}><X size={21}/></IconButton></div>
      {children}
    </div>
  </dialog>;
}
export function Empty({icon:Icon=ShoppingBag,title,children}) {
  return <div className="empty"><span className="empty-icon"><Icon size={25}/></span><h3>{title}</h3>{children}</div>;
}
export function ProductCard({record,navigate,onCart,onDetail,index}) {
  const {product:p,match,reasons}=record;
  const [imgDead,setImgDead]=React.useState(false);
  if (imgDead) return null;
  return <article className="product">
    <div className="product-media">
      <button className="photo-hit" onClick={()=>onDetail(p)} aria-label={`Xem chi tiết ${p.name}`}><img src={p.image} alt={p.name} loading={index<4?'eager':'lazy'} width="420" height="560" onError={()=>setImgDead(true)}/></button>
      {p.badge&&<span className="product-tag">{p.badge}</span>}
      {match&&<span className="match-tag" title={reasons.join(' · ')}><Sparkles size={12}/> Phù hợp {match}</span>}
      <button className="round-detail" title="Chi tiết sản phẩm" aria-label={`Chi tiết ${p.name}`} onClick={()=>onDetail(p)}><ArrowUpRight size={16}/></button>
    </div>
    <div className="product-data"><p className="product-meta">{categoryNames[p.category]} <span>·</span> {p.color}</p><button className="product-name" onClick={()=>onDetail(p)}>{p.name}</button><strong>{money(p.price)}</strong></div>
    <div className="product-actions"><Link className="btn btn-outline" to={tryUrl(p.id)} navigate={navigate}><Shirt size={16}/> Thử đồ</Link><IconButton label={`Thêm ${p.name} vào giỏ`} onClick={()=>onCart(p)}><Plus size={20}/></IconButton></div>
  </article>;
}
export function FilterBar({filters,change}) {
  return <div className="filters">
    <div className="tabs" aria-label="Danh mục">
      {[['','Tất cả'],...Object.entries(categoryNames),['outfit','Set AI']].map(([id,name])=><button key={id} className={filters.category===id?'current':''} aria-pressed={filters.category===id} onClick={()=>change('category',id)}>{id==='outfit'&&<Sparkles size={14}/>} {name}</button>)}
    </div>
    <div className="filter-selects"><SlidersHorizontal size={17} aria-hidden="true"/>
      <select aria-label="Tông da" value={filters.tone} onChange={e=>change('tone',e.target.value)}><option value="">Tông da</option><option value="light">Da sáng</option><option value="medium">Da trung tính</option><option value="deep">Da ngăm</option></select>
      <select aria-label="Dịp mặc" value={filters.occasion} onChange={e=>change('occasion',e.target.value)}><option value="">Dịp mặc</option>{Object.entries(occasionNames).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select>
      <select aria-label="Sắp xếp" value={filters.sort} onChange={e=>change('sort',e.target.value)}><option value="">Đề xuất</option><option value="newest">Mới nhất</option><option value="price-asc">Giá: thấp đến cao</option><option value="price-desc">Giá: cao đến thấp</option></select>
    </div>
  </div>;
}

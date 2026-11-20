import React,{useEffect,useRef,useState} from 'react';
import {ArrowDown,ArrowDownRight,ArrowUpRight,SearchX,Shirt,Sparkles} from 'lucide-react';
import {bodyShape,tones} from '../../../../shared/contracts/index.mjs';
import {api} from '../../app/api.js';
import {Empty,FilterBar,Link,ProductCard} from '../../components/ui/index.jsx';

const defaults={category:'',tone:'',occasion:'',sort:''};
export function Shop({navigate,session,query,onCart,onDetail,openChat}) {
  const [filters,setFilters]=useState(defaults), [results,setResults]=useState(null), [error,setError]=useState(''), [limit,setLimit]=useState(8), [refresh,setRefresh]=useState(0);
  const catalog=useRef(null);
  useEffect(()=>{
    if(!session)return;
    const abort=new AbortController();
    setError('');
    const {category,...rest}=filters;
    api('/search','POST',{...rest,category:category==='outfit'?'':category,outfit:category==='outfit',q:query},abort.signal)
      .then(r=>setResults(r.results)).catch(e=>{if(e.name!=='AbortError')setError(e.message);});
    return ()=>abort.abort();
  },[filters,session?.conversationId,session?.profileVersion,session?.profile,query,refresh]);
  useEffect(()=>{if(query) catalog.current?.scrollIntoView({behavior:'smooth'});},[query]);
  const p=session?.profile;
  return <main className="shell shop">
    <section className="hero" aria-label="Bộ sưu tập Forme Studio">
      <img className="hero-photo" src="/images/studio.jpg" alt="Người mẫu trong trang phục xanh sage của bộ ảnh studio" fetchPriority="high"/>
      <div className="hero-inner">
        <div className="eyebrow hero-kicker"><span/> FORME° STUDIO / COLLECTION 01</div>
        <h1>Mặc theo cách<br/><em>của bạn.</em></h1>
        <p>{p?`Chào ${session.user?.name?.split(' ').at(-1)||'bạn'}, khám phá trang phục hợp ${bodyShape(p)} và tông ${tones[p.tone].name.toLowerCase()}.`:'Tìm phom hợp dáng, màu hợp da và những món đồ bạn muốn mặc mỗi ngày.'}</p>
        <div className="hero-actions"><Link className="btn btn-light" to="/fitting-room" navigate={navigate}><Shirt size={17}/> Vào phòng thử đồ <ArrowUpRight size={15}/></Link><button className="btn btn-glass" onClick={openChat}><Sparkles size={16}/> Nhờ Stylist phối đồ</button></div>
      </div>
      <div className="hero-index"><span>01 / 01</span><ArrowDownRight size={14}/></div>
    </section>
    <section className="catalog" ref={catalog} aria-label="Danh mục sản phẩm">
      <div className="section-head"><div><p className="eyebrow"><span/> THE EVERYDAY EDIT</p><h2>{query?'Kết quả tìm kiếm':'Khám phá bộ sưu tập'}</h2></div><span className="result-count">{results?.length??'…'} sản phẩm</span></div>
      {query&&<div className="query-row">Tìm “{query}” <button className="text-button" onClick={()=>navigate('/')}>Xóa tìm kiếm</button></div>}
      <FilterBar filters={filters} change={(key,value)=>{setLimit(8);setFilters({...filters,[key]:value});}}/>
      {error?<Empty icon={SearchX} title="Chưa tải được sản phẩm"><p>{error}</p><button className="btn btn-outline" onClick={()=>setRefresh(x=>x+1)}>Tải lại</button></Empty>:
        results===null?<div className="product-grid" aria-label="Đang tải sản phẩm">{[0,1,2,3].map(i=><div className="skeleton" key={i}/>)}</div>:
        !results.length?<Empty icon={SearchX} title="Không có sản phẩm phù hợp"><p>Thử từ khóa khác hoặc bỏ bớt bộ lọc.</p><button className="btn btn-outline" onClick={()=>{setFilters(defaults);navigate('/');}}>Xóa bộ lọc</button></Empty>:
        <><div className="product-grid">{results.slice(0,limit).map((r,i)=><ProductCard key={r.productId} record={r} index={i} {...{navigate,onCart,onDetail}}/>)}</div>
          {limit<results.length&&<div className="load-more"><button className="btn btn-outline" onClick={()=>setLimit(n=>n+8)}>Xem thêm sản phẩm <ArrowDown size={16}/></button></div>}</>}
    </section>
  </main>;
}

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pathToFileURL } from 'node:url';
import { randomBytes } from 'node:crypto';
import { byId } from '../../data/catalog.mjs';
import { measurements, styles, faceShapes } from '../../shared/contracts/index.mjs';
import { createStore, hashPassword, checkPassword, day, digest, fail, now, uuid } from './platform/store.mjs';
import { ranked, answer } from './modules/stylist/rules.mjs';
import { narrate } from './modules/stylist/llm.mjs';
import { createJobs } from './modules/tryon/jobs.mjs';
import { providerSettings } from './modules/tryon/providers.mjs';

const root = fileURLToPath(new URL('../../',import.meta.url));
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.woff2':'font/woff2','.png':'image/png'};
const demoEmail = 'studio@forme.demo', demoPassword = 'FormeStudio2026!';
const sessionAge = day*7;
function cookie(req) { return req.headers.cookie?.match(/(?:^|;\s*)forme_sid=([a-f0-9]{64})(?:;|$)/)?.[1]; }
function json(res,data,status=200) { res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}); res.end(JSON.stringify(data)); }
async function body(req,limit = 32768) {
  if (!req.headers['content-type']?.startsWith('application/json')) throw fail(415,'CONTENT_TYPE','Yêu cầu phải dùng JSON.');
  if (Number(req.headers['content-length']) > limit) throw fail(413,'BODY_LIMIT','Dữ liệu quá lớn.');
  let length = 0; const chunks = [];
  for await (const chunk of req) { length += chunk.length; if (length > limit) throw fail(413,'BODY_LIMIT','Dữ liệu quá lớn.'); chunks.push(chunk); }
  try { const data = JSON.parse(Buffer.concat(chunks)); if (!data || typeof data !== 'object' || Array.isArray(data)) throw Error(); return data; }
  catch { throw fail(400,'INVALID_JSON','Dữ liệu không hợp lệ.'); }
}
export async function createApp({ file=resolve(root,'.runtime','forme.sqlite'), dev=false, demo=process.env.DEMO_ADMIN!=='0' }={}) {
  const store = createStore(file), jobs = createJobs(store);
  const { get, run } = store;
  if (demo && !get('SELECT id FROM accounts WHERE email=?',demoEmail)) run('INSERT INTO accounts VALUES (?,?,?,?,?)',uuid(),demoEmail,'Nhóm FORME',await hashPassword(demoPassword),'admin');
  const attempts = new Map(), chatBusy = new Set();
  const sweep = setInterval(()=>{store.sweep(); for (const [key,r] of attempts) if (r.until<now()) attempts.delete(key);},60000);
  sweep.unref();
  const server = createServer();
  const vite = dev ? await (await import('vite')).createServer({configFile:resolve(root,'vite.config.js'),server:{middlewareMode:true,hmr:{server}},appType:'spa'}) : null;
  function rate(key, limit, period) {
    const entry = attempts.get(key);
    const r = !entry || entry.until < now() ? {n:0,until:now()+period} : entry;
    r.n++; attempts.set(key,r);
    if (r.n>limit) throw fail(429,'RATE_LIMIT','Bạn thao tác quá nhanh. Hãy thử lại sau.');
  }
  function startSession(res,user=null) {
    const token = randomBytes(32).toString('hex'), owner = user ? 'u:'+user.id : 'g:'+uuid();
    run('INSERT INTO sessions VALUES (?,?,?,?)',digest(token),owner,user?.id ?? null,now()+sessionAge);
    res.setHeader('Set-Cookie',`forme_sid=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${sessionAge/1000}${process.env.COOKIE_SECURE==='1'?'; Secure':''}`);
    return { owner,user,token };
  }
  function session(req,res) {
    const token = cookie(req);
    const row = token && get('SELECT * FROM sessions WHERE token=? AND expires>?',digest(token),now());
    if (!row) return startSession(res);
    return { owner:row.owner,user:row.user_id?get('SELECT * FROM accounts WHERE id=?',row.user_id):null,token };
  }
  function cartInfo(cart) {
    const items = cart.flatMap(line => { const product = byId.get(line.productId); return product ? [{...line,product,subtotal:product.price*line.quantity}] : []; });
    return {items,count:items.reduce((n,l)=>n+l.quantity,0),total:items.reduce((n,l)=>n+l.subtotal,0)};
  }
  function payload(s) {
    const state = store.state(s.owner), { profile, profileVersion, conversationId } = state;
    const user = s.user && {id:s.user.id,name:s.user.name,email:s.user.email,role:s.user.role};
    return {user,profile,profileVersion,faceId:state.faceId&&jobs.readMedia(s.owner,state.faceId)?state.faceId:null,conversationId,cart:cartInfo(state.cart),settings:{...providerSettings(),demoAdmin:demo}};
  }
  function mergeSession(from,to) {
    if (!from.owner.startsWith('g:')) return;
    store.txn(() => {
      const guest = store.state(from.owner), account = store.state(to.owner);
      for (const line of guest.cart) {
        const existing = account.cart.find(x=>x.productId===line.productId&&x.size===line.size);
        if (!existing) account.cart.push(line);
        else existing.quantity = Math.min(byId.get(line.productId).stock[line.size],existing.quantity+line.quantity);
      }
      if (!account.profile && guest.profile) { account.profile = guest.profile; account.profileVersion++; }
      if (guest.messages.length) account.messages = [...account.messages,...guest.messages].sort((a,b)=>a.createdAt.localeCompare(b.createdAt)).slice(-40);
      for (const row of jobs.history(from.owner)) {
        const existing = jobs.job(from.owner,row.jobId);
        const data = JSON.parse(existing.payload);
        if (data.faceId) continue;
        run('UPDATE jobs SET owner=?,cache_key=?,expires=? WHERE id=?',to.owner,digest(row.jobId),now()+30*day,row.jobId);
        run('UPDATE media SET owner=?,expires=? WHERE id=?',to.owner,now()+30*day,data.imageId);
      }
      store.put(to.owner,account);
      run('DELETE FROM states WHERE owner=?',from.owner);
      run('DELETE FROM jobs WHERE owner=?',from.owner);
      run('DELETE FROM media WHERE owner=?',from.owner);
    });
  }
  async function api(req,res,url) {
    const m = req.method, p = url.pathname, params = Object.fromEntries(url.searchParams);
    if (p==='/api/health' && m==='GET') return json(res,{status:'ok'});
    if (!['GET','HEAD'].includes(m) && req.headers.origin) {
      const protocol = process.env.COOKIE_SECURE==='1'?'https':'http';
      if (req.headers.origin !== (process.env.PUBLIC_ORIGIN||`${protocol}://${req.headers.host}`)) throw fail(403,'ORIGIN','Nguồn yêu cầu không hợp lệ.');
    }
    const s = session(req,res);
    const state = () => store.state(s.owner);
    if (p==='/api/session' && m==='GET') return json(res,payload(s));
    if (p.startsWith('/api/auth/') && m==='POST') {
      if (p==='/api/auth/logout') {
        run('DELETE FROM sessions WHERE token=?',digest(s.token));
        return json(res,payload(startSession(res)));
      }
      if (p!=='/api/auth/register' && p!=='/api/auth/login') throw fail(404,'NOT_FOUND','Không tìm thấy chức năng.');
      rate('auth:'+req.socket.remoteAddress,30,15*60000);
      const data = await body(req);
      const email = typeof data.email==='string' ? data.email.trim().toLowerCase() : '';
      const password = typeof data.password==='string' ? data.password : '';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>200||password.length<8||password.length>128) throw fail(422,'INVALID_LOGIN','Nhập email hợp lệ và mật khẩu từ 8 đến 128 ký tự.');
      let user = get('SELECT * FROM accounts WHERE email=?',email);
      if (p.endsWith('/register')) {
        const name = typeof data.name==='string' ? data.name.trim() : '';
        if (name.length<2||name.length>60) throw fail(422,'INVALID_NAME','Tên cần từ 2 đến 60 ký tự.');
        if (user) throw fail(409,'EMAIL_EXISTS','Email này đã được sử dụng.');
        user = { id:uuid(),email,name,role:'member',password:await hashPassword(password) };
        if (get('SELECT id FROM accounts WHERE email=?',email)) throw fail(409,'EMAIL_EXISTS','Email này đã được sử dụng.');
        run('INSERT INTO accounts VALUES (?,?,?,?,?)',user.id,email,name,user.password,user.role);
      } else if (!(await checkPassword(password,user?.password))||(!demo&&user?.role==='admin')) throw fail(401,'INVALID_LOGIN','Email hoặc mật khẩu chưa đúng.');
      const next = startSession(res,user);
      mergeSession(s,next);
      run('DELETE FROM sessions WHERE token=?',digest(s.token));
      return json(res,payload(next),p.endsWith('/register')?201:200);
    }
    if (p==='/api/profile' && m==='GET') return json(res,{profile:state().profile,profileVersion:state().profileVersion});
    if (p==='/api/profile' && m==='PUT') {
      const d = await body(req), old = state(), profile = {};
      for (const [k,[label,min,max]] of Object.entries(measurements)) {
        if (!Number.isInteger(d[k])||d[k]<min||d[k]>max) throw fail(422,'INVALID_PROFILE',`${label} phải nằm trong khoảng ${min}–${max}.`);
        profile[k]=d[k];
      }
      if (!Number.isInteger(d.tone)||d.tone<0||d.tone>5) throw fail(422,'INVALID_PROFILE','Tông da không hợp lệ.');
      Object.assign(profile,{tone:d.tone,style:Object.hasOwn(styles,d.style)?d.style:'',faceShape:Object.hasOwn(faceShapes,d.faceShape)?d.faceShape:''});
      const changed = [...Object.keys(measurements),'tone'].some(k=>profile[k]!==old.profile?.[k]);
      store.put(s.owner,{...old,profile,profileVersion:old.profileVersion+Number(changed)});
      return json(res,payload(s));
    }
    if (p==='/api/products' && m==='GET') {
      const {results}=ranked(params,state().profile);
      const limit=Math.max(1,Math.min(24,Number(params.limit)||24)), page=Math.max(1,Math.floor(Number(params.page)||1));
      return json(res,{items:results.slice((page-1)*limit,page*limit).map(r=>r.product),total:results.length,page});
    }
    if (p.startsWith('/api/products/') && m==='GET') {
      const product=byId.get(p.split('/').at(-1));
      if (!product) throw fail(404,'NOT_FOUND','Sản phẩm không tồn tại.');
      return json(res,{product});
    }
    if ((p==='/api/recommendations' && m==='GET') || (p==='/api/search' && m==='POST')) {
      const filters=m==='POST'?await body(req):params;
      return json(res,ranked(filters,state().profile));
    }
    if (p==='/api/cart' && m==='GET') return json(res,cartInfo(state().cart));
    if (p==='/api/cart/items' && ['POST','PATCH','DELETE'].includes(m)) {
      const d = await body(req), item=byId.get(d.productId), current=state(), cart=current.cart;
      const index=cart.findIndex(l=>l.productId===d.productId&&l.size===d.size);
      if (m==='DELETE') { if (index>=0) cart.splice(index,1); }
      else {
        const n=d.quantity ?? 1, quantity=n+(m==='POST'?(cart[index]?.quantity||0):0);
        if (!item||!Object.hasOwn(item.stock,d.size)||!Number.isInteger(n)||n<1||quantity>item.stock[d.size]) throw fail(422,'INVALID_CART','Size hoặc số lượng không còn đủ trong kho.');
        const line={productId:item.id,size:d.size,quantity};
        if (index<0) cart.push(line); else cart[index]=line;
      }
      store.put(s.owner,current);
      return json(res,cartInfo(cart));
    }
    if (p.startsWith('/api/conversations/') && m==='GET') {
      const current=state();
      if (current.conversationId!==p.split('/').at(-1)) throw fail(404,'NOT_FOUND','Không tìm thấy hội thoại.');
      return json(res,{conversationId:current.conversationId,messages:current.messages});
    }
    if (p==='/api/chat' && m==='POST') {
      const d=await body(req), message=typeof d.message==='string'?d.message.trim():'';
      if (!message||message.length>500) throw fail(422,'INVALID_MESSAGE','Nhập câu hỏi từ 1 đến 500 ký tự.');
      if (chatBusy.has(s.owner)) throw fail(409,'CHAT_BUSY','Stylist đang trả lời.');
      rate('chat:'+s.owner,20,60000);
      chatBusy.add(s.owner);
      try {
        const current=state(), product=byId.get(d.productId), reply=answer(message,current.profile,product,current.messages);
        const text=await narrate({ message,reply,history:current.messages,profile:current.profile,page:d.page==='fitting'?'fitting':'shop',current:product });
        if (!get('SELECT token FROM sessions WHERE token=?',digest(s.token))) throw fail(409,'SESSION_CHANGED','Phiên đã thay đổi.');
        const latest=state(), stamp=new Date().toISOString();
        latest.messages=[...latest.messages,{id:uuid(),role:'user',text:message,createdAt:stamp},{id:uuid(),role:'assistant',text:text||reply.text,cards:reply.cards.map(r=>({productId:r.productId,recommendedSize:r.recommendedSize})),createdAt:stamp}].slice(-40);
        store.put(s.owner,latest);
        return json(res,{conversationId:latest.conversationId,messages:latest.messages});
      } finally { chatBusy.delete(s.owner); }
    }
    if (p==='/api/ai/validate-and-matting' && m==='POST') {
      rate('ai:'+s.owner,25,60000);
      const data = await body(req, 15_000_000);
      const rawImage = data.image;
      if (!rawImage || typeof rawImage !== 'string') throw fail(400,'INVALID_IMAGE','Thiếu dữ liệu ảnh người dùng.');

      // 1. Chuyển tiếp tới AI Microservice trên PC Trí / Colab nếu có
      if (process.env.AI_SERVICE_URL) {
        try {
          const aiRes = await fetch(`${process.env.AI_SERVICE_URL}/api/ai/validate-and-matting`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: rawImage }),
            signal: AbortSignal.timeout(25000)
          });
          const result = await aiRes.json();
          if (aiRes.ok && result.success) return json(res, result);
          if (result.error) throw fail(400, 'AI_VALIDATION_ERROR', result.error);
        } catch (e) {
          if (e.code === 'AI_VALIDATION_ERROR') throw e;
        }
      }

      // 2. Bộ xử lý Kiểm tra toàn thân & Tách nền trắng cơ bản
      try {
        const base64Data = rawImage.replace(/^data:image\/\w+;base64,/, '');
        const imgBuffer = Buffer.from(base64Data, 'base64');
        const meta = await sharp(imgBuffer).metadata();

        if (meta.height < 320 || (meta.width > meta.height * 1.05)) {
          throw fail(400, 'INVALID_IMAGE', 'Ảnh chưa thấy rõ toàn thân hoặc bị chụp ngang. Vui lòng lùi ra xa và chụp lại từ đầu đến bàn chân.');
        }

        const resized = await sharp(imgBuffer)
          .resize({ width: 768, height: 1024, fit: 'contain', background: '#FFFFFF' })
          .flatten({ background: '#FFFFFF' })
          .png()
          .toBuffer();

        return json(res, {
          success: true,
          image: `data:image/png;base64,${resized.toString('base64')}`,
          message: 'Ảnh hợp lệ. Đã tách nền trắng #FFFFFF thành công.'
        });
      } catch (err) {
        if (err.status) throw err;
        throw fail(400, 'INVALID_IMAGE', 'Ảnh chưa thấy rõ bàn chân hoặc đỉnh đầu, vui lòng lùi ra xa và chụp lại toàn thân.');
      }
    }
    if (p==='/api/ai/try-on' && m==='POST') {
      rate('ai:'+s.owner,25,60000);
      const data = await body(req, 15_000_000);
      const { personImage, items } = data;
      if (!personImage || !Array.isArray(items) || items.length === 0) {
        throw fail(400, 'INVALID_TRYON', 'Thiếu ảnh người mẫu hoặc danh sách trang phục.');
      }

      // 1. Chuyển tiếp tới AI Microservice trên PC Trí / Colab nếu có
      if (process.env.AI_SERVICE_URL) {
        try {
          const aiRes = await fetch(`${process.env.AI_SERVICE_URL}/api/ai/try-on`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ person_image: personImage, garments: items }),
            signal: AbortSignal.timeout(35000)
          });
          const result = await aiRes.json();
          if (aiRes.ok && result.success) return json(res, result);
        } catch (e) {
          // Tiếp tục fallback bên dưới
        }
      }

      // 2. Bộ xử lý Phối đồ phân tầng nhiều lớp
      try {
        const base64Data = personImage.replace(/^data:image\/\w+;base64,/, '');
        let currentBuffer = Buffer.from(base64Data, 'base64');
        const baseMeta = await sharp(currentBuffer).metadata();
        const mw = baseMeta.width || 768;
        const mh = baseMeta.height || 1024;

        // Thứ tự lớp: Bottoms -> Tops (Layer 1) -> Dresses -> Outer (Layer 2)
        const sortedItems = [...items].sort((a, b) => (a.layer_level || 1) - (b.layer_level || 1));

        for (const item of sortedItems) {
          if (!item.garmentImage) continue;
          try {
            const garmentPath = resolve(root, 'frontend', 'public', '.' + item.garmentImage);
            const garmentBuffer = await readFile(garmentPath);
            const trimmed = await sharp(garmentBuffer).trim().png().toBuffer();
            const gMeta = await sharp(trimmed).metadata();
            const aspect = (gMeta.height || 1) / Math.max(1, gMeta.width || 1);

            let targetW, targetH, pasteX, pasteY;
            if (item.category === 'bottoms') {
              targetW = Math.round(mw * 0.40);
              targetH = Math.round(targetW * aspect);
              pasteX = Math.round(mw * 0.5 - targetW * 0.5);
              pasteY = Math.round(mh * 0.42);
            } else if (item.cut === 'blazer' || item.layer_level === 2) {
              targetW = Math.round(mw * 0.54);
              targetH = Math.round(targetW * aspect);
              pasteX = Math.round(mw * 0.5 - targetW * 0.5);
              pasteY = Math.round(mh * 0.19);
            } else if (item.category === 'dresses') {
              targetW = Math.round(mw * 0.48);
              targetH = Math.round(targetW * aspect);
              pasteX = Math.round(mw * 0.5 - targetW * 0.5);
              pasteY = Math.round(mh * 0.20);
            } else {
              targetW = Math.round(mw * 0.48);
              targetH = Math.round(targetW * aspect);
              pasteX = Math.round(mw * 0.5 - targetW * 0.5);
              pasteY = Math.round(mh * 0.20);
            }

            const resizedGarment = await sharp(trimmed)
              .resize(Math.max(10, targetW), Math.max(10, targetH), { fit: 'inside' })
              .toBuffer();

            currentBuffer = await sharp(currentBuffer)
              .composite([{ input: resizedGarment, top: Math.max(0, pasteY), left: Math.max(0, pasteX) }])
              .png()
              .toBuffer();
          } catch (e) {
            console.error('Lỗi ghép sản phẩm:', item.name, e);
          }
        }

        return json(res, {
          success: true,
          image: `data:image/png;base64,${currentBuffer.toString('base64')}`,
          message: 'Phối đồ AI ôm dáng hoàn tất.'
        });
      } catch (err) {
        throw fail(500, 'TRYON_ERROR', 'Không thể phối đồ đạt chất lượng. Vui lòng thử lại.');
      }
    }
    if (p==='/api/media' && m==='POST') {
      rate('media:'+s.owner,12,60000);
      return json(res,await jobs.upload(s.owner,await body(req,7_000_000)),201);
    }
    if (p.startsWith('/api/media/')) {
      const id=p.split('/').at(-1);
      if (m==='DELETE') { jobs.remove(s.owner,id); return json(res,payload(s)); }
      if (m==='GET') {
        const image=jobs.readMedia(s.owner,id);
        if (!image) throw fail(404,'NOT_FOUND','Không tìm thấy ảnh.');
        res.writeHead(200,{'Content-Type':'image/png','Cache-Control':'private, no-store'});
        return res.end(image.data);
      }
    }
    if (m==='POST' && ['/api/avatars','/api/try-ons'].includes(p)) {
      rate('job:'+s.owner,35,60000);
      return json(res,jobs.create(s.owner,p==='/api/avatars'?'avatar':'try-on',await body(req)),202);
    }
    if (p.startsWith('/api/jobs/') && m==='GET') {
      const row = jobs.job(s.owner,p.split('/').at(-1));
      if (!row) throw fail(404,'NOT_FOUND','Không tìm thấy tác vụ.');
      return json(res,jobs.view(row));
    }
    if (p==='/api/try-ons' && m==='GET') return json(res,{items:jobs.history(s.owner)});
    if (p.startsWith('/api/try-ons/') && m==='PATCH') return json(res,jobs.save(s.owner,p.split('/').at(-1),s.user));
    if (p==='/api/admin/overview' && m==='GET') {
      if (s.user?.role!=='admin'||!demo) throw fail(403,'FORBIDDEN','Trang này dành cho quản trị demo.');
      return json(res,{products:byId.size,accounts:get('SELECT count(*) AS n FROM accounts').n,jobs:get('SELECT count(*) AS n FROM jobs WHERE expires>?',now()).n,settings:providerSettings()});
    }
    throw fail(404,'NOT_FOUND','Không tìm thấy chức năng.');
  }
  server.on('request',async (req,res) => {
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Referrer-Policy','same-origin');
    res.setHeader('X-Frame-Options','DENY');
    const requestId=uuid();
    try {
      const url = new URL(req.url,'http://localhost');
      if (url.pathname.startsWith('/api/')) return await api(req,res,url);
      if (vite) return vite.middlewares(req,res,()=>{res.writeHead(404);res.end();});
      if (!['GET','HEAD'].includes(req.method)) throw fail(405,'METHOD','Phương thức không hỗ trợ.');
      const base = resolve(root,'dist'), candidate=resolve(base,'.'+decodeURIComponent(url.pathname));
      if (candidate!==base && !candidate.startsWith(base+sep)) throw fail(404,'NOT_FOUND','Không tìm thấy trang.');
      const path=extname(candidate)?candidate:resolve(base,'index.html');
      let data;
      try { data=await readFile(path); } catch { throw fail(404,'NOT_FOUND','Không tìm thấy tệp. Chạy npm run build trước khi khởi động.'); }
      res.writeHead(200,{'Content-Type':types[extname(path)]||'application/octet-stream','Cache-Control':path.includes(sep+'assets'+sep)?'public,max-age=31536000,immutable':'no-cache'});
      res.end(req.method==='HEAD'?undefined:data);
    } catch (error) {
      if (!error.status) console.error(requestId,error);
      if (!res.headersSent) json(res,{code:error.code&&error.status?error.code:'INTERNAL',message:error.status?error.message:'Có lỗi xảy ra. Vui lòng thử lại.',requestId},error.status||500);
      else res.end();
    }
  });
  server.on('close',()=>{clearInterval(sweep);void vite?.close();});
  return {server,store};
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href===import.meta.url) {
  const args=process.argv.slice(2), portIndex=args.indexOf('--port');
  const port=Number(portIndex<0?process.env.PORT||5173:args[portIndex+1]);
  const host=process.env.HOST||'127.0.0.1';
  const {server}=await createApp({dev:args.includes('--dev'),file:process.env.DATABASE_PATH||undefined});
  server.listen(port,host,()=>console.log(`FORME Studio: http://${host}:${server.address().port}`));
}

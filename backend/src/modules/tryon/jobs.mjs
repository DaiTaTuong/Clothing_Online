import sharp from 'sharp';
import { setTimeout as delay } from 'node:timers/promises';
import { byId } from '../../../../data/catalog.mjs';
import { mannequin } from '../../../../shared/contracts/mannequin.mjs';
import { sampleProfile } from '../../../../shared/contracts/index.mjs';
import { day, digest, fail, now, uuid } from '../../platform/store.mjs';
import { providerSettings, swapFace, virtualTryOn } from './providers.mjs';

export function createJobs(store) {
  const { get, all, run } = store;
  run("UPDATE jobs SET status='failed' WHERE status IN ('queued','processing')");
  const readMedia = (owner,id) => get('SELECT * FROM media WHERE id=? AND owner=? AND expires>?',id,owner,now());
  const insert = (owner,kind,data) => {
    const id = uuid(), expires = now()+day;
    run('INSERT INTO media VALUES (?,?,?,?,?,?)',id,owner,kind,data,digest(data),expires);
    return { id, url:'/api/media/'+id, expiresAt:new Date(expires).toISOString() };
  };
  const invalidateFace = (owner,faceId) => {
    if (!faceId) return;
    for (const row of all('SELECT * FROM jobs WHERE owner=?',owner)) {
      const p = JSON.parse(row.payload);
      if (p.faceId !== faceId) continue;
      if (p.imageId) run('DELETE FROM media WHERE id=? AND owner=?',p.imageId,owner);
      run('DELETE FROM jobs WHERE id=?',row.id);
    }
    run('DELETE FROM media WHERE id=? AND owner=?',faceId,owner);
  };
  async function upload(owner,body) {
    const match = typeof body.image === 'string' && body.image.match(/^data:image\/(png|jpeg|webp);base64,([a-zA-Z0-9+/=]+)$/);
    if (!match || match[2].length > 6_991_000) throw fail(422,'INVALID_IMAGE','Chọn ảnh JPEG, PNG hoặc WebP tối đa 5 MB.');
    let data;
    try {
      const input = sharp(Buffer.from(match[2],'base64'),{limitInputPixels:25_000_000});
      const metadata = await input.metadata();
      if (metadata.format !== match[1] || metadata.width < 64 || metadata.height < 64) throw Error();
      data = await input.rotate().resize({width:900,height:900,fit:'inside',withoutEnlargement:true}).png().toBuffer();
    } catch { throw fail(422,'INVALID_IMAGE','Ảnh không hợp lệ hoặc nhỏ hơn 64 × 64 px.'); }
    return store.txn(() => {
      const s = store.state(owner);
      invalidateFace(owner,s.faceId);
      const image = insert(owner,'face',data);
      store.put(owner,{...s,faceId:image.id,profileVersion:s.profileVersion+1});
      return {...image, profileVersion:s.profileVersion+1};
    });
  }
  function remove(owner,id) {
    const image = readMedia(owner,id);
    if (!image || image.kind !== 'face') throw fail(404,'NOT_FOUND','Không tìm thấy ảnh.');
    return store.txn(() => {
      invalidateFace(owner,id);
      const s = store.state(owner);
      store.put(owner,{...s,faceId:null,profileVersion:s.profileVersion+1});
      return { profileVersion:s.profileVersion+1 };
    });
  }
  function view(row) {
    const p = JSON.parse(row.payload);
    return { jobId:row.id, type:row.type, profileVersion:p.profileVersion, productId:p.productId, mode:p.mode,
      status:row.status, stage:row.status==='failed'?'failed':p.stage, saved:Boolean(p.saved), createdAt:new Date(row.created).toISOString(),
      imageUrl:p.imageId?'/api/media/'+p.imageId:null, error:row.status==='failed' ? p.error || 'Tác vụ đã gián đoạn. Hãy thử lại.' : null };
  }
  const job = (owner,id) => get('SELECT * FROM jobs WHERE id=? AND owner=? AND expires>?',id,owner,now());
  function create(owner,type,body) {
    const state = store.state(owner);
    if (body.profileVersion !== state.profileVersion) throw fail(409,'STALE_PROFILE','Hồ sơ đã thay đổi. Hãy tải lại phiên.');
    const profile = state.profile || sampleProfile;
    const face = state.faceId ? readMedia(owner,state.faceId) : null;
    const settings = providerSettings();
    const product = type==='try-on' ? byId.get(body.productId) : null;
    if (type==='try-on' && !product) throw fail(404,'NOT_FOUND','Sản phẩm không tồn tại.');
    const mode = type==='avatar' ? (body.useFace === true ? 'face' : '2d') : (body.mode === 'ai' ? 'ai' : '2d');
    if (mode==='face' && (!settings.faceSwap || !face || body.consent !== true)) throw fail(422,'FACE_UNAVAILABLE','Cá nhân hóa ảnh cần ảnh hợp lệ, cấu hình dịch vụ và sự đồng ý.');
    if (mode==='ai' && (!settings.aiCategories.includes(product.category) || body.consent !== true)) throw fail(422,'AI_UNAVAILABLE','AI chưa được bật cho món này hoặc chưa có sự đồng ý.');
    let source;
    if (type==='try-on' && body.avatarId) {
      const avatar = job(owner,body.avatarId);
      const p = avatar ? JSON.parse(avatar.payload) : null;
      if (!avatar || avatar.type!=='avatar' || avatar.status!=='completed' || p.profileVersion!==state.profileVersion || !(source = readMedia(owner,p.imageId))) throw fail(409,'STALE_AVATAR','Hãy cập nhật lại phôi vóc dáng.');
    }
    const faceId = mode==='face' || (mode==='ai' && source && JSON.parse(job(owner,body.avatarId).payload).mode==='face') ? face?.id : null;
    const outfitData = body.outfit ? {
      top: byId.get(body.outfit.topId) || null,
      bottom: byId.get(body.outfit.bottomId) || null,
      dress: byId.get(body.outfit.dressId) || null,
    } : null;
    const fullOutfit = outfitData?.top || outfitData?.bottom || outfitData?.dress ? outfitData : product;
    const key = digest(JSON.stringify(['forme-v1',type,state.profileVersion,faceId,faceId?face.hash:null,source?.hash,product?.id,body.outfit?.topId,body.outfit?.bottomId,body.outfit?.dressId,product?.imageVersion,mode]));
    const recent = all('SELECT * FROM jobs WHERE owner=? AND type=? AND cache_key=? AND expires>? ORDER BY created DESC',owner,type,key,now());
    const cached = recent.find(r => ['queued','processing'].includes(r.status) || (r.status==='completed' && readMedia(owner,JSON.parse(r.payload).imageId)));
    if (cached) return view(cached);
    const p = { stage:'queued', profileVersion:state.profileVersion, productId:product?.id, mode, faceId };
    const id = uuid();
    store.txn(() => {
      if (mode!=='2d') {
        const limit = Number(process.env.AI_DAILY_LIMIT ?? 99999);
        if (limit > 0) {
          const date = new Date().toISOString().slice(0,10);
          if ((get('SELECT count FROM usage WHERE date=?',date)?.count||0) >= limit) throw fail(429,'AI_QUOTA','Đã hết lượt xử lý ảnh AI hôm nay.');
          run('INSERT INTO usage VALUES (?,1) ON CONFLICT(date) DO UPDATE SET count=count+1',date);
        }
      }
      run('INSERT INTO jobs VALUES (?,?,?,?,?,?,?,?)',id,owner,type,key,'queued',JSON.stringify(p),now(),now()+day);
    });
    const update = (status,stage,fields={}) => {
      Object.assign(p,{stage},fields);
      run('UPDATE jobs SET status=?,payload=? WHERE id=? AND owner=?',status,JSON.stringify(p),id,owner);
    };
    void (async () => {
      try {
        await delay(150);
        if (!job(owner,id)) return;
        update('processing',mode==='face'?'sync-face':type==='try-on'?'fit':'render');
        const render = (outfitParam = null) => sharp(Buffer.from(mannequin(profile,outfitParam || fullOutfit))).png().toBuffer();
        const bytes = mode==='face' ? await swapFace(await render(),face.data) : mode==='ai' ? await virtualTryOn(source?.data || await render(),product,fullOutfit) : await render(fullOutfit);
        await delay(mode==='2d'?320:0);
        if (!job(owner,id)) return;
        store.txn(() => update('completed','ready',{imageId:insert(owner,type,bytes).id}));
      } catch (err) {
        update('failed','failed',{error:mode==='2d'?'Không tạo được ảnh. Hãy thử lại.':err.message||'Dịch vụ ảnh chưa tạo được kết quả. Bạn có thể thử lại hoặc chọn xem 2D.'});
      }
    })();
    return view(job(owner,id));
  }
  function save(owner,id,user) {
    const row = job(owner,id);
    if (!row || row.type!=='try-on' || row.status!=='completed') throw fail(404,'NOT_FOUND','Không tìm thấy lượt thử.');
    const p = {...JSON.parse(row.payload),saved:true};
    const expires = now()+day*(user?30:1);
    store.txn(() => {
      run('UPDATE jobs SET payload=?,expires=? WHERE id=?',JSON.stringify(p),expires,id);
      run('UPDATE media SET expires=? WHERE id=? AND owner=?',expires,p.imageId,owner);
    });
    return view(job(owner,id));
  }
  return { create, readMedia, upload, remove, save, view, job, invalidateFace,
    history:owner=>all("SELECT * FROM jobs WHERE owner=? AND type='try-on' AND status='completed' AND expires>? ORDER BY created DESC LIMIT 80",owner,now()).filter(r=>JSON.parse(r.payload).saved).map(view) };
}

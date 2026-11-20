import { products } from '../../../../data/catalog.mjs';
import { bodyShape, categoryNames, fitSize, money, occasionNames, skinGroup, tones } from '../../../../shared/contracts/index.mjs';
export const normalize = s => String(s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g,'d').replace(/[^a-z0-9.,]+/g,' ').trim();
const find = (q, pattern) => pattern.test(q);
export function parseIntent(text) {
  const q = normalize(text);
  const category = find(q,/\b(dam|dress)\b/) ? 'dresses' : find(q,/\b(quan|chan vay|vay|jeans|shorts)\b/) ? 'bottoms' : find(q,/\b(ao|so mi|blazer|tee)\b/) ? 'tops' : '';
  const occasion = find(q,/\b(di lam|di hoc|cong so|van phong)\b/) ? 'office' : find(q,/\b(du tiec|tiec|cuoi)\b/) && !q.includes('cuoi tuan') ? 'formal' : find(q,/\b(dao pho|di choi|cuoi tuan)\b/) ? 'casual' : '';
  const tone = find(q,/\bda (ngam|nau|toi)\b/) ? 'deep' : find(q,/\bda sang\b/) ? 'light' : find(q,/\bda trung tinh\b/) ? 'medium' : '';
  const raw = q.match(/\b(?:duoi|toi da|ngan sach|khong qua|tam|khoang)\s+(\d+(?:[.,]\d+)?)\s*(trieu|tr|nghin|ngan|k|dong|vnd)?\b/);
  const budget = raw ? Math.round((raw[2] ? Number(raw[1].replace(',','.')) : Number(raw[1].replace(/[.,]/g,''))) * (['trieu','tr'].includes(raw[2]) ? 1000000 : ['nghin','ngan','k'].includes(raw[2]) ? 1000 : 1)) : null;
  const requestedSize = q.match(/\bsize (xs|s|m|l|xl)\b/)?.[1]?.toUpperCase();
  const cut = q.includes('so mi') && category === 'tops' ? 'shirt' : q.includes('blazer') ? 'blazer' : q.includes('chan vay') ? 'skirt' : q.includes('jeans') ? 'jeans' : '';
  return { q, category, occasion, tone, budget, cut, requestedSize, outfit: /\b(phoi|set|nguyen bo)\b/.test(q) && !category, tall: /\b(hack chieu cao|chan dai|thap|nho nguoi)\b/.test(q) };
}
const stop = new Set('tim toi minh cho ban mot chiec cai dep nao can muon cac nhung loai the nao hay voi hop theo do gia mau ton kien tu van'.split(' '));
export function ranked(filters = {}, profile = null, chat = false) {
  const intent = parseIntent(filters.q);
  const base = filters.category || intent.category, event = filters.occasion || intent.occasion, tone = filters.tone || intent.tone;
  const max = filters.maxPrice !== undefined && filters.maxPrice !== '' && Number.isFinite(Number(filters.maxPrice)) ? Number(filters.maxPrice) : intent.budget;
  const size = filters.size || intent.requestedSize;
  const structured = base || event || tone || max !== null || size || intent.outfit || intent.tall;
  const words = intent.q.split(' ').filter(w => w.length > 1 && !stop.has(w));
  const colors = ['trang nga','xanh navy','xanh reu','xanh sage','xanh phan','hong dat','nau dat','do ruou','tim man','den','trang','kem','be','nau','xanh','hong'];
  const color = colors.find(c => new RegExp('(?:^| )'+c+'(?: |$)').test(intent.q.replace(/da (nau|ngam|toi|sang|trung tinh)/g,'')));
  const applyColor = color && !/\b(mau nao|mau gi|ton da)\b/.test(intent.q) && !intent.outfit;
  const skin = tone || skinGroup(profile), shape = bodyShape(profile);
  const results = products.flatMap(p => {
    if (!Object.values(p.stock).some(n => n > 0) || (base && p.category !== base) || (event && !p.occasions.includes(event)) || (tone && !p.tones.includes(tone)) || (max !== null && p.price > max) || (size && !p.stock[size]) || (intent.cut === 'jeans' ? p.id !== 'blue-jeans' : intent.cut && p.cut !== intent.cut) || (applyColor && !normalize(p.color).includes(color))) return [];
    const name = normalize(p.name + ' ' + p.color);
    const hits = words.reduce((n,w) => n + (name.includes(w) ? 1 : 0),0);
    if (!chat && intent.q && !structured && !hits && !intent.cut && !applyColor) return [];
    const reasons = [];
    let affinity = 0;
    if (skin && p.tones.includes(skin)) { affinity += 3; reasons.push('Hợp tông da đã chọn'); }
    if (event) { affinity += 3; reasons.push(occasionNames[event]); }
    const recommendedSize = fitSize(p,profile);
    if (recommendedSize) { affinity += 2; reasons.push(`Tham khảo size ${recommendedSize}`); }
    if (profile?.style === p.form) { affinity += 2; reasons.push('Đúng phong cách yêu thích'); }
    if (shape === 'dáng quả lê' && ['shirt','blazer','skirt'].includes(p.cut)) { affinity++; reasons.push('Đường cắt cân đối tỷ lệ'); }
    if ((intent.tall || profile?.height < 158) && ['pants','skirt','wrap'].includes(p.cut)) { affinity += 2; reasons.push('Đường dọc tạo cảm giác cao hơn'); }
    return [{ productId:p.id, product:p, recommendedSize, match: reasons.length ? (affinity >= 5 ? 'cao' : 'vừa') : '', reasons, score: affinity + hits*5 + (name.includes(intent.q) && intent.q ? 12 : 0) }];
  });
  results.sort((a,b) => ({ 'price-asc':a.product.price-b.product.price, 'price-desc':b.product.price-a.product.price, newest:b.product.createdAt.localeCompare(a.product.createdAt) }[filters.sort] ?? b.score-a.score));
  if (intent.outfit || filters.outfit) {
    const cap = max ?? Infinity;
    for (const top of results.filter(r => r.product.category === 'tops')) {
      const bottom = results.find(r => r.product.category === 'bottoms' && r.product.price + top.product.price <= cap);
      if (bottom) return { intent, results: [top,bottom] };
    }
    return { intent, results: results.filter(r => r.product.category === 'dresses').slice(0,1) };
  }
  return { intent, results };
}
export function answer(message, profile, current, history = []) {
  const q = normalize(message);
  const previous = history.filter(m => m.role === 'user').at(-1)?.text || '';
  const followup = /^((con|the|neu) |duoi |tam |khoang |size |thi sao)/.test(q);
  const question = followup && previous ? `${previous} ${message}` : message;
  const { results, intent } = ranked({ q: question },profile,true);
  const wantSize = /\b(size|kich co|vua khong)\b/.test(q);
  const cards = (wantSize && current && !intent.category && !intent.occasion && intent.budget === null ? ranked({ q: current.name },profile,true).results.filter(r => r.productId === current.id) : results).slice(0,3);
  if (/^(chao|hello|hi|xin chao)[ .!]*$/.test(q)) return { text:'Chào bạn! Hôm nay bạn muốn phối đồ đi đâu? Cho mình biết dịp mặc hoặc ngân sách nhé.', cards:[] };
  if (wantSize && !profile) return { text:'Bạn thêm số đo ngực, eo và hông trong Hồ sơ vóc dáng nhé. Mình sẽ đối chiếu bảng size của từng món. Bạn vẫn có thể tự chọn size khi thêm vào giỏ.', cards };
  if (!cards.length) return { text:'Mình chưa tìm được món đáp ứng các tiêu chí này. Bạn muốn đổi ngân sách, loại trang phục hay dịp mặc?', cards };
  if (wantSize) return { text:cards.map(r=>r.recommendedSize ? `${r.product.name}: tham khảo size ${r.recommendedSize} theo số đo đã lưu.` : `${r.product.name}: chưa có size phù hợp còn hàng theo bảng mẫu.`).join(' '), cards };
  const setup = intent.outfit && cards.length > 1 ? `Phối ${cards[0].product.name} với ${cards[1].product.name}. Tổng hai món là ${money(cards.reduce((n,r)=>n+r.product.price,0))}.` :
    intent.outfit ? `Bạn có thể chọn ${cards[0].product.name} làm trang phục một món cho dịp này.` :
    `Mình chọn ${cards.map(r=>r.product.name).join(', ')}${intent.occasion ? ` cho dịp ${occasionNames[intent.occasion].toLowerCase()}` : ''}.`;
  const advice = /\b(mau nao|mau gi|ton da)\b/.test(q) && profile ? ` Với tông ${tones[profile.tone].name.toLowerCase()}, thử ${cards[0].product.color.toLowerCase()} để tạo điểm nhấn.` :
    intent.tall ? ' Cạp cao và đường dọc có thể tạo cảm giác chân dài hơn.' : ` ${cards[0].product.description}`;
  const neck = profile?.faceShape && /\b(co ao|khuon mat|co gi)\b/.test(q) ? (['round','square'].includes(profile.faceShape) ? ' Bạn có thể thử cổ chữ V hoặc cổ mở.' : ' Bạn có thể thử cổ vuông hoặc cổ tròn theo sở thích.') : '';
  return { text:setup+advice+neck, cards };
}

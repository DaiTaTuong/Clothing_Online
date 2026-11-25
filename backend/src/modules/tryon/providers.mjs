import { setTimeout as sleep } from 'node:timers/promises';
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
const dataUri = (data, type = 'png') => `data:image/${type};base64,${Buffer.from(data).toString('base64')}`;
const faceVersion = '278a81e7ebb22db98bcba54de985d22cc1abeead2754eb1f2af717247be69b34';
export const providerSettings = () => ({
  aiCategories: (process.env.AI_SERVICE_URL || process.env.GEMINI_API_KEY) ? ['tops','bottoms','dresses'] : (process.env.FASHN_API_KEY ? (process.env.TRYON_AI_CATEGORIES || '').split(',').map(s=>s.trim()).filter(s=>['tops','bottoms','dresses'].includes(s)) : []),
  faceSwap: Boolean(process.env.AI_SERVICE_URL || (process.env.REPLICATE_API_TOKEN && process.env.FACE_SWAP_ENABLED === '1')),
  stylist: (process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY) ? 'llm' : 'rules',
  tryOnMethod: process.env.GEMINI_API_KEY ? 'gemini-api' : (process.env.AI_SERVICE_URL ? 'local-ai-service' : '2d-fallback'),
});

export async function geminiVirtualTryOn(personBuffer, items, framing = 'full_body', rootDir = null) {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return null;

  const candidateModels = [
    process.env.GEMINI_TRYON_MODEL?.trim(),
    'gemini-2.5-flash-image',
    'gemini-2.0-flash-exp-image-generation',
  ].filter(Boolean);
  const uniqueModels = [...new Set(candidateModels)];

  const garmentParts = [];
  const descriptions = [];
  for (const [idx, item] of items.entries()) {
    try {
      let gBuf;
      if (item.garmentImage?.startsWith('data:image')) {
        gBuf = Buffer.from(item.garmentImage.split(',')[1], 'base64');
      } else if (item.garmentImage) {
        const gUrl = rootDir
          ? new URL('file:///' + rootDir.replace(/\\/g, '/').replace(/\/$/, '') + '/frontend/public' + item.garmentImage)
          : new URL('../../../../frontend/public' + item.garmentImage, import.meta.url);
        gBuf = await readFile(gUrl);
      }
      if (!gBuf) continue;
      const cleanGarment = await sharp(gBuf).resize({ width: 768, height: 768, fit: 'inside', withoutEnlargement: true }).png().toBuffer();
      const slotLabel = item.slot === 'outer' ? 'outerwear jacket/blazer (Layer 2 over the inner top)' :
        item.slot === 'bottom' ? 'bottom trousers/skirt' :
        item.slot === 'dress' ? 'one-piece dress (replaces top and bottom)' :
        'inner top/shirt (Layer 1)';
      descriptions.push(`${idx + 1}. "${item.name || item.id}" as ${slotLabel}`);
      garmentParts.push({
        inlineData: {
          mimeType: 'image/png',
          data: cleanGarment.toString('base64'),
        },
      });
    } catch {
      continue;
    }
  }
  if (garmentParts.length === 0) return null;

  const cleanPerson = await sharp(personBuffer).png().toBuffer();
  const prompt = [
    'You are an expert photorealistic AI Virtual Try-On engine for a fashion studio.',
    `The FIRST image is the user photo (framing: ${framing}) on a pure white #FFFFFF background.`,
    `The following ${garmentParts.length} image(s) are the exact shop garments to dress the person in:`,
    ...descriptions,
    'STRICT REQUIREMENTS:',
    '1. Replace the person\'s existing clothing with the provided garment image(s), matching the exact color, fabric texture, neckline, collar, sleeves, and cut from the reference garment image(s).',
    '2. If both an inner top (Layer 1) and an outerwear blazer (Layer 2) are provided, layer the blazer naturally over the inner top.',
    '3. Keep 100% of the person\'s original face, eyeglasses, hair, head angle, skin tone, body proportions, hands, and pose completely unchanged.',
    '4. Keep the background pure solid white (#FFFFFF) and preserve the exact 3:4 portrait aspect ratio.',
    '5. Output the final dressed person image.',
  ].join('\n');

  const contents = [
    {
      role: 'user',
      parts: [
        { text: prompt },
        { inlineData: { mimeType: 'image/png', data: cleanPerson.toString('base64') } },
        ...garmentParts,
      ],
    },
  ];

  let lastError = null;
  for (const model of uniqueModels) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(45000),
        body: JSON.stringify({
          contents,
          generationConfig: {
            responseModalities: ['TEXT', 'IMAGE'],
          },
        }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        lastError = errBody?.error?.message || `HTTP ${res.status}`;
        continue;
      }
      const data = await res.json();
      const parts = data.candidates?.[0]?.content?.parts || [];
      const imgPart = parts.find(p => p.inlineData?.data || p.inline_data?.data);
      const rawB64 = imgPart?.inlineData?.data || imgPart?.inline_data?.data;
      if (rawB64) {
        const outBuf = await sharp(Buffer.from(rawB64, 'base64'))
          .resize({ width: 768, height: 1024, fit: 'contain', background: '#FFFFFF' })
          .flatten({ background: '#FFFFFF' })
          .png()
          .toBuffer();
        return { buffer: outBuf, engine: `gemini-api:${model}` };
      }
    } catch (err) {
      lastError = err.message;
    }
  }
  if (lastError) {
    console.warn('[Gemini Try-On] Fallback after Gemini API error:', lastError);
  }
  return null;
}
async function request(url, token, body) {
  const response = await fetch(url,{method: body ? 'POST':'GET', redirect:'error', signal:AbortSignal.timeout(15000), headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'}, body:body ? JSON.stringify(body) : undefined});
  if (!response.ok) throw new Error(`Provider HTTP ${response.status}`);
  return response.json();
}
async function imageData(value, domain) {
  if (typeof value !== 'string' || value.length > 20_000_000) throw new Error('Invalid provider image');
  let result;
  if (/^data:image\/(png|jpeg|webp);base64,/.test(value)) result = Buffer.from(value.split(',')[1],'base64');
  else {
    const url = new URL(value);
    if (url.protocol !== 'https:' || !(url.hostname === domain || url.hostname.endsWith('.'+domain))) throw new Error('Invalid image host');
    const res = await fetch(url,{redirect:'error', signal:AbortSignal.timeout(15000)});
    if (!res.ok) throw new Error('Cannot download image');
    const chunks = []; let size = 0;
    for await (const chunk of res.body) { size += chunk.length; if (size > 15_000_000) throw new Error('Image too large'); chunks.push(chunk); }
    result = Buffer.concat(chunks);
  }
  return sharp(result,{limitInputPixels:20_000_000}).resize({width:1024,height:1365,fit:'inside',withoutEnlargement:true}).png().toBuffer();
}
export async function localGarmentTryOn(base, product, fullOutfit = null) {
  const meta = await sharp(base).metadata();
  const mw = meta.width || 768;
  const mh = meta.height || 1024;
  
  const itemsToDrape = [];
  const outfit = (fullOutfit && (fullOutfit.top || fullOutfit.bottom || fullOutfit.dress)) ? fullOutfit : { [product.category]: product };
  
  if (outfit.bottom) itemsToDrape.push({ item: outfit.bottom, cat: 'bottoms' });
  if (outfit.top) itemsToDrape.push({ item: outfit.top, cat: 'tops' });
  if (outfit.dress) itemsToDrape.push({ item: outfit.dress, cat: 'dresses' });
  if (itemsToDrape.length === 0 && product) itemsToDrape.push({ item: product, cat: product.category });
  
  let currentBase = base;
  for (const { item, cat } of itemsToDrape) {
    try {
      const garment = await readFile(new URL('../../../../frontend/public' + item.garmentImage, import.meta.url));
      const trimmed = await sharp(garment).trim().toBuffer();
      const gMeta = await sharp(trimmed).metadata();
      const gw = gMeta.width || 1;
      const gh = gMeta.height || 1;
      const aspect = gh / gw;
      
      let targetW, targetH, pasteX, pasteY;
      if (cat === 'tops') {
        targetW = Math.round(mw * 0.48);
        targetH = Math.round(targetW * aspect);
        const maxH = Math.round(mh * 0.28);
        if (targetH > maxH) { targetH = maxH; targetW = Math.round(targetH / aspect); }
        pasteX = Math.round(mw * 0.5 - targetW * 0.5);
        pasteY = Math.round(mh * 0.205);
      } else if (cat === 'bottoms') {
        targetW = Math.round(mw * 0.38);
        targetH = Math.round(targetW * aspect);
        const maxH = Math.round(mh * 0.45);
        if (targetH > maxH) { targetH = maxH; targetW = Math.round(targetH / aspect); }
        pasteX = Math.round(mw * 0.5 - targetW * 0.5);
        pasteY = Math.round(mh * 0.40);
      } else {
        targetW = Math.round(mw * 0.46);
        targetH = Math.round(targetW * aspect);
        const maxH = Math.round(mh * 0.56);
        if (targetH > maxH) { targetH = maxH; targetW = Math.round(targetH / aspect); }
        pasteX = Math.round(mw * 0.5 - targetW * 0.5);
        pasteY = Math.round(mh * 0.205);
      }
      
      const resizedGarment = await sharp(trimmed).resize(targetW, targetH, { fit: 'inside' }).png().toBuffer();
      currentBase = await sharp(currentBase).composite([{ input: resizedGarment, top: pasteY, left: pasteX }]).png().toBuffer();
    } catch (err) {
      console.warn('Could not drape item:', item.id, err.message);
    }
  }
  return currentBase;
}

export async function virtualTryOn(base, product, fullOutfit = null) {
  if (process.env.AI_SERVICE_URL) {
    const outfitItems = [];
    if (fullOutfit && (fullOutfit.top || fullOutfit.bottom || fullOutfit.dress)) {
      if (fullOutfit.bottom) outfitItems.push(fullOutfit.bottom);
      if (fullOutfit.top) outfitItems.push(fullOutfit.top);
      if (fullOutfit.dress) outfitItems.push(fullOutfit.dress);
    } else if (product) {
      outfitItems.push(product);
    }
    const url = process.env.AI_SERVICE_URL.replace(/\/$/, '') + '/api/ai/try-on';
    try {
      const garments = await Promise.all(outfitItems.map(async item => {
        const garment = await readFile(new URL('../../../../frontend/public' + item.garmentImage, import.meta.url));
        return {
          id: item.id,
          name: item.name,
          category: item.category,
          cut: item.cut || '',
          garment_image: dataUri(garment, 'png'),
          layer_level: item.cut === 'blazer' ? 2 : 1,
          slot: item.cut === 'blazer' ? 'outer' : (item.category === 'bottoms' ? 'bottom' : (item.category === 'dresses' ? 'dress' : 'top'))
        };
      }));
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(90000),
        body: JSON.stringify({
          person_image: dataUri(base),
          garments,
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && (data.image || data.output)) return imageData(data.image || data.output);
      }
    } catch (e) {
      console.warn('AI Service Try-on unreachable, falling back to local compositing:', e.message);
    }
    return localGarmentTryOn(base, product, fullOutfit);
  }
  const key = process.env.FASHN_API_KEY;
  if (!key) return localGarmentTryOn(base, product, fullOutfit);
  const garment = await readFile(new URL('../../../../frontend/public'+product.garmentImage,import.meta.url));
  const v1 = 'https://api.fashn.ai/v1/';
  const {id} = await request(v1+'run',key,{model_name:'tryon-v1.6',inputs:{
    model_image:dataUri(base),garment_image:dataUri(garment,'png'),category:product.category==='dresses'?'one-pieces':product.category,
    garment_photo_type:'flat-lay',moderation_level:'conservative',return_base64:true,num_samples:1,
  }});
  if (!id) throw new Error('Missing FASHN job ID');
  for (let i=0;i<30;i++) {
    await sleep(1800);
    const job = await request(v1+'status/'+encodeURIComponent(id),key);
    if (job.status==='completed') return imageData(job.output?.[0],'fashn.ai');
    if (['failed','canceled','cancelled'].includes(job.status)) throw new Error('FASHN job failed');
  }
  throw new Error('Try-on timeout');
}
export async function swapFace(base, face) {
  if (process.env.AI_SERVICE_URL) {
    const url = process.env.AI_SERVICE_URL.replace(/\/$/, '') + '/face-swap';
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(60000),
        body: JSON.stringify({
          base_image: dataUri(base),
          face_image: dataUri(face),
        })
      });
      if (!res.ok) {
        if (res.status === 404) throw new Error(`Máy chủ AI (${process.env.AI_SERVICE_URL}) đang Offline. Hãy kiểm tra ô Bước 4 trên Google Colab.`);
        throw new Error(`AI Microservice HTTP ${res.status}`);
      }
      const data = await res.json();
      return imageData(data.image || data.output);
    } catch (e) {
      if (e.message.includes('fetch failed') || e.message.includes('timeout') || e.message.includes('Offline')) {
        throw new Error(`Không thể kết nối đến máy chủ AI (${process.env.AI_SERVICE_URL}). Hãy đảm bảo Google Colab đang chạy.`);
      }
      throw e;
    }
  }
  const key = process.env.REPLICATE_API_TOKEN, root = 'https://api.replicate.com/v1/predictions';
  const {id} = await request(root,key,{version:faceVersion,input:{input_image:dataUri(base),swap_image:dataUri(face)}});
  if (!id) throw new Error('Missing Face Swap job ID');
  for (let i=0;i<30;i++) {
    await sleep(1800);
    const job = await request(root+'/'+encodeURIComponent(id),key);
    if (job.status==='succeeded') return imageData(Array.isArray(job.output)?job.output[0]:job.output,'replicate.delivery');
    if (['failed','canceled'].includes(job.status)) throw new Error('Face Swap job failed');
  }
  throw new Error('Face Swap timeout');
}

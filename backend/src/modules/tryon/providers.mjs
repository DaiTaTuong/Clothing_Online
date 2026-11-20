import { setTimeout as sleep } from 'node:timers/promises';
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
const dataUri = (data, type = 'png') => `data:image/${type};base64,${Buffer.from(data).toString('base64')}`;
const faceVersion = '278a81e7ebb22db98bcba54de985d22cc1abeead2754eb1f2af717247be69b34';
export const providerSettings = () => ({
  aiCategories: process.env.FASHN_API_KEY ? (process.env.TRYON_AI_CATEGORIES || '').split(',').map(s=>s.trim()).filter(s=>['tops','bottoms','dresses'].includes(s)) : [],
  faceSwap: Boolean(process.env.REPLICATE_API_TOKEN && process.env.FACE_SWAP_ENABLED === '1'),
  stylist: process.env.OPENAI_API_KEY ? 'llm' : 'rules',
});
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
export async function virtualTryOn(base, product) {
  const key = process.env.FASHN_API_KEY;
  const garment = await readFile(new URL('../../../../frontend/public'+product.garmentImage,import.meta.url));
  const v1 = 'https://api.fashn.ai/v1/';
  const {id} = await request(v1+'run',key,{model_name:'tryon-v1.6',inputs:{
    model_image:dataUri(base),garment_image:dataUri(garment,'jpeg'),category:product.category==='dresses'?'one-pieces':product.category,
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

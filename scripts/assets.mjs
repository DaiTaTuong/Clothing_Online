import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { products } from '../data/catalog.mjs';

const url = path => new URL(`../frontend/public/images/${path}`, import.meta.url);
await Promise.all(['products', 'garments'].map(x => mkdir(url(x), { recursive: true })));
const paths = {
  shirt: 'M140 69 175 53Q210 68 245 53L280 69 323 96 364 199 329 215 287 147 281 313Q208 327 139 313L133 147 91 215 56 199 97 96Z',
  blazer:'M139 70 173 54Q211 62 247 54L284 70 313 96 341 292 304 300 282 163 283 342 137 342 138 163 116 300 79 292 107 96Z',
  tee:'M142 72 174 57Q208 65 246 57L278 72 325 111 292 170 269 154 272 306 148 306 151 154 128 170 95 111Z',
  knit:'M143 69 172 57Q209 68 248 57L277 69 305 96 335 280 300 287 274 165 273 303 147 303 146 165 120 287 85 280 115 96Z',
  tank:'M156 61 178 59Q182 105 210 108 238 105 242 59L264 61Q267 117 280 143L272 310 148 310 140 143Q153 117 156 61Z',
  pants:'M143 71Q210 65 277 71L294 132 298 373 222 373 210 167 198 373 122 373 126 132Z',
  shorts:'M142 78Q210 70 278 78L293 133 304 247 228 250 210 171 192 250 116 247 127 133Z',
  skirt:'M156 80Q210 76 264 80L278 144 319 336Q212 357 101 336L142 144Z',
  dress:'M155 62 176 59 180 103H240L244 59 265 62 280 88 282 137 268 144 257 135 250 189Q274 232 307 357 210 378 113 357 146 232 170 189L163 135 152 144 138 137 140 88Z',
  slip:'M161 63 167 61 178 107Q210 132 242 107L253 61 259 63 256 121 265 150 249 196Q266 263 294 357 210 376 126 357 154 263 171 196L155 150 164 121Z',
  wrap:'M144 70 176 56 208 131 246 56 276 70 306 122 277 151 257 141 249 187 310 355Q212 379 110 355L171 187 163 141 143 151 114 122Z',
  shirtDress:'M143 71 175 54Q210 66 245 54L277 71 312 112 287 153 263 142 253 181 306 353Q210 376 114 353L167 181 157 142 133 153 108 112Z',
};
const lines = {
  shirt:'M175 53 191 103 210 86 229 103 245 53M210 87V316M155 121H187V150H155ZM78 200 105 189M315 189 342 200',
  blazer:'M173 54 156 104 178 116 163 135 211 216 246 131 232 116 264 104 247 54M210 215V341M147 237H183M236 237H273',
  tee:'M174 57Q178 100 210 100 242 100 246 57M149 295H271M101 122 132 157M319 122 288 157',
  knit:'M172 57 210 107 248 57M149 290H271M86 268 121 275M299 275 334 268',
  tank:'M162 62Q163 116 210 119 257 116 258 62M148 297H272',
  pants:'M140 90Q210 86 280 90M210 91V158M143 98 164 125M277 98 256 125M160 109 151 363M260 109 269 363M123 360H197M223 360H297',
  shorts:'M140 98Q210 91 280 98M210 97V162M143 105 166 139M277 105 254 139M119 235 190 237M230 237 301 235',
  skirt:'M152 97Q210 92 268 97M172 110 148 329M248 110 272 329M108 324Q210 346 312 324',
  dress:'M171 185Q206 194 249 185M184 205 168 345M233 205 259 345M121 344Q213 368 299 344',
  slip:'M173 194Q210 202 247 194M193 205 176 350M228 205 246 350',
  wrap:'M247 57 200 153 174 191 151 358M170 185Q210 194 250 185M251 190 277 233M250 190 225 229',
  shirtDress:'M175 54 189 96 210 83 231 96 245 54M210 83V360M168 177Q210 189 251 177M166 189Q210 201 255 189',
};
const buttons = { shirt:[111,137,163,189,215,241,267,293], blazer:[222,250], shirtDress:[107,132,157,206,230,254,278,302,326], pants:[81], shorts:[88] };
const palette = ['#eae5dc', '#e6e3df', '#e8e9dc', '#e4e6e9', '#ebe2dc', '#e1e8ea'];
function art(p, i, garment = false) {
  const color = p.hex, tone = palette[i % palette.length];
  const background = garment ? '<rect width="420" height="560" fill="white"/>' : `<rect width="420" height="560" fill="url(#paper)"/><path d="M0 400 Q110 363 420 380V560H0Z" fill="#fff" opacity=".18"/><ellipse cx="225" cy="472" rx="147" ry="23" fill="#51493f" opacity=".13" filter="url(#blur)"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="560" viewBox="0 0 420 560"><defs>
  <linearGradient id="paper" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#faf9f5"/><stop offset=".62" stop-color="${tone}"/><stop offset="1" stop-color="${tone}"/></linearGradient>
  <linearGradient id="cloth" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${color}"/><stop offset=".67" stop-color="${color}"/><stop offset="1" stop-color="#282526"/></linearGradient>
  <linearGradient id="light"><stop stop-color="white" stop-opacity=".23"/><stop offset=".36" stop-color="white" stop-opacity=".04"/><stop offset=".68" stop-color="#211b19" stop-opacity=".12"/><stop offset="1" stop-color="white" stop-opacity=".14"/></linearGradient>
  <pattern id="clothgrain" width="4" height="4" patternUnits="userSpaceOnUse"><path d="M0 0h4M0 2h4M1 0v4M3 0v4" stroke="#332a24" stroke-opacity=".10" stroke-width=".55"/></pattern>
  <filter id="blur"><feGaussianBlur stdDeviation="12"/></filter></defs>${background}
  <g transform="translate(0 ${p.category === 'tops' ? 101 : 83})">
  ${garment ? '' : `<path d="${paths[p.cut]}" fill="#3c3029" opacity=".23" transform="translate(9 16)" filter="url(#blur)"/>`}
  <path d="${paths[p.cut]}" fill="${color}" stroke="#302921" stroke-opacity=".35" stroke-width="1.4"/>
  <path d="${paths[p.cut]}" fill="url(#light)"/><path d="${paths[p.cut]}" fill="url(#clothgrain)"/>
  <path d="${lines[p.cut]}" fill="none" stroke="#241e1e" stroke-opacity=".40" stroke-width="1.15"/>
  <path d="${lines[p.cut]}" transform="translate(1 1)" fill="none" stroke="#fff" stroke-opacity=".25" stroke-width=".7"/>
  ${(buttons[p.cut] || []).map(y => `<circle cx="${p.cut==='blazer'?218:211}" cy="${y}" r="2.9" fill="#251f1c" opacity=".57"/><circle cx="${p.cut==='blazer'?217.3:210.3}" cy="${y-.6}" r="1" fill="#fff" opacity=".52"/>`).join('')}
  </g>${garment ? '' : `<path d="M23 520v13h13m348 0h13v-13" fill="none" stroke="#514942" stroke-opacity=".4"/><text x="210" y="533" text-anchor="middle" font-family="Arial" font-size="9" fill="#605950">FORME STUDIO / ${String(i+1).padStart(2,'0')}</text>`}</svg>`;
}
await Promise.all(products.flatMap((p, i) => [
  sharp(Buffer.from(art(p,i))).webp({ quality: 86 }).toFile(fileURLToPath(url(`products/${p.id}.webp`))),
  sharp(Buffer.from(art(p,i,true))).jpeg({ quality: 91 }).toFile(fileURLToPath(url(`garments/${p.id}.jpg`))),
]));

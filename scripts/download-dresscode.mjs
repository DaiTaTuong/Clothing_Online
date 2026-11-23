import sharp from 'sharp';
import { writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const garmentsDir = resolve(root, 'frontend', 'public', 'images', 'garments');
const productsDir = resolve(root, 'frontend', 'public', 'images', 'products');

await mkdir(garmentsDir, { recursive: true });
await mkdir(productsDir, { recursive: true });

// Danh sach 24 san pham map chuan xac theo mau sac, kieu dang, va thuong hieu DressCode / VITON-HD
const mappings = [
  // --- Tops (8 san pham) ---
  { id: 'linen-shirt', url: 'https://huggingface.co/spaces/levihsu/OOTDiffusion/resolve/main/run/examples/garment/04825_00.jpg' }, // So mi trang nga
  { id: 'navy-blazer', url: 'https://huggingface.co/spaces/yisol/IDM-VTON/resolve/main/example/cloth/04469_00.jpg' }, // Blazer xanh navy
  { id: 'ivory-tee', url: 'https://huggingface.co/spaces/yisol/IDM-VTON/resolve/main/example/cloth/09133_00.jpg' }, // Ao thun trang kem
  { id: 'blue-shirt', url: 'https://huggingface.co/spaces/levihsu/OOTDiffusion/resolve/main/run/examples/garment/06123_00.jpg' }, // So mi xanh phan Oxford
  { id: 'rose-knit', url: 'https://huggingface.co/spaces/yisol/IDM-VTON/resolve/main/example/cloth/09176_00.jpg' }, // Ao det kim hong dat
  { id: 'black-top', url: 'https://huggingface.co/spaces/yisol/IDM-VTON/resolve/main/example/cloth/09163_00.jpg' }, // Ao sat nach den
  { id: 'sage-tee', url: 'https://huggingface.co/spaces/yisol/IDM-VTON/resolve/main/example/cloth/09256_00.jpg' }, // Ao thun xanh sage
  { id: 'brown-knit', url: 'https://huggingface.co/spaces/levihsu/OOTDiffusion/resolve/main/run/examples/garment/07764_00.jpg' }, // Ao len nau cacao

  // --- Bottoms (8 san pham - DressCode) ---
  { id: 'tailored-trouser', url: 'https://huggingface.co/spaces/levihsu/OOTDiffusion/resolve/main/run/examples/garment/053290_1.jpg' }, // Quan tay nau dat
  { id: 'black-trouser', url: 'https://huggingface.co/spaces/levihsu/OOTDiffusion/resolve/main/run/examples/garment/053790_1.jpg' }, // Quan tay den Noir
  { id: 'blue-jeans', url: 'https://huggingface.co/spaces/levihsu/OOTDiffusion/resolve/main/run/examples/garment/051991_1.jpg' }, // Jeans ong dung denim
  { id: 'cream-skirt', url: 'https://huggingface.co/spaces/levihsu/OOTDiffusion/resolve/main/run/examples/garment/051988_1.jpg' }, // Chan vay be cat
  { id: 'wine-skirt', url: 'https://huggingface.co/spaces/levihsu/OOTDiffusion/resolve/main/run/examples/garment/050002_1.jpg' }, // Chan vay do ruou Merlot
  { id: 'olive-shorts', url: 'https://huggingface.co/spaces/levihsu/OOTDiffusion/resolve/main/run/examples/garment/050105_1.jpg' }, // Shorts xanh reu Safari
  { id: 'ivory-pants', url: 'https://huggingface.co/spaces/levihsu/OOTDiffusion/resolve/main/run/examples/garment/049949_1.jpg' }, // Quan linen Lumi trang nga
  { id: 'navy-skirt', url: 'https://huggingface.co/spaces/levihsu/OOTDiffusion/resolve/main/run/examples/garment/050181_1.jpg' }, // Chan vay xanh navy

  // --- Dresses (8 san pham - DressCode) ---
  { id: 'olive-dress', url: 'https://huggingface.co/spaces/levihsu/OOTDiffusion/resolve/main/run/examples/garment/053744_1.jpg' }, // Dam midi Olive
  { id: 'black-dress', url: 'https://huggingface.co/spaces/levihsu/OOTDiffusion/resolve/main/run/examples/garment/048769_1.jpg' }, // Dam den Nocturne
  { id: 'brick-dress', url: 'https://huggingface.co/spaces/levihsu/OOTDiffusion/resolve/main/run/examples/garment/051998_1.jpg' }, // Dam cam dat Terracotta
  { id: 'cloud-dress', url: 'https://huggingface.co/spaces/levihsu/OOTDiffusion/resolve/main/run/examples/garment/052234_1.jpg' }, // Dam so mi xanh phan Cloud
  { id: 'pearl-dress', url: 'https://huggingface.co/spaces/levihsu/OOTDiffusion/resolve/main/run/examples/garment/048554_1.jpg' }, // Dam hai day kem ngoc trai
  { id: 'plum-dress', url: 'https://huggingface.co/spaces/levihsu/OOTDiffusion/resolve/main/run/examples/garment/049805_1.jpg' }, // Dam tim man Prune
  { id: 'navy-dress', url: 'https://huggingface.co/spaces/levihsu/OOTDiffusion/resolve/main/run/examples/garment/051515_1.jpg' }, // Dam quan xanh navy Midnight
  { id: 'sage-dress', url: 'https://huggingface.co/spaces/levihsu/OOTDiffusion/resolve/main/run/examples/garment/051517_1.jpg' }, // Dam so mi xanh sage Jardin
];

console.log(`Bat dau tai va xu ly ${mappings.length} anh san pham thuc te chuan DressCode & VITON-HD...`);

let successCount = 0;

for (let i = 0; i < mappings.length; i++) {
  const { id, url } = mappings[i];
  const progress = `[${i + 1}/${mappings.length}]`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buffer = Buffer.from(await res.arrayBuffer());

    // 1. Dinh dang anh garment goc (768 x 1024, JPEG)
    const garmentBuffer = await sharp(buffer)
      .resize(768, 1024, { fit: 'contain', background: '#ffffff' })
      .jpeg({ quality: 90 })
      .toBuffer();

    // 2. Dinh dang anh product card (420 x 560, WebP)
    const productBuffer = await sharp(buffer)
      .resize(420, 560, { fit: 'contain', background: '#f5f5f5' })
      .webp({ quality: 85 })
      .toBuffer();

    const garmentPath = resolve(garmentsDir, `${id}.jpg`);
    const productPath = resolve(productsDir, `${id}.webp`);

    await writeFile(garmentPath, garmentBuffer);
    await writeFile(productPath, productBuffer);

    console.log(`${progress} Hoan thanh: ${id}`);
    successCount++;
  } catch (err) {
    console.error(`${progress} Loi tai ${id}:`, err.message);
  }
}

console.log(`\nDa cap nhat thanh cong ${successCount}/${mappings.length} san pham!`);

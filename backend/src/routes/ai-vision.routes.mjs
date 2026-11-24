import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { byId } from '../../../data/catalog.mjs';
import { digest, fail } from '../platform/store.mjs';

const SLOT_ORDER = { bottom: 1, top: 2, dress: 3, outer: 4 };

const FRAMING_META = {
  full_body: {
    label: 'Toàn thân',
    supportedSlots: ['top', 'outer', 'bottom', 'dress'],
  },
  half_body: {
    label: 'Nửa người',
    supportedSlots: ['top', 'outer', 'dress'],
  },
  portrait_upper: {
    label: 'Cận mặt & vai',
    supportedSlots: ['top', 'outer'],
  },
};

function normalizeItems(items) {
  return items
    .map(raw => {
      const fromCatalog = raw.id ? byId.get(raw.id) : null;
      const cut = raw.cut || fromCatalog?.cut || '';
      const category = raw.category || fromCatalog?.category || 'tops';
      const isOuter = cut === 'blazer' || raw.layer_level === 2 || raw.slot === 'outer';
      const slot = raw.slot || (isOuter ? 'outer' : (category === 'bottoms' ? 'bottom' : (category === 'dresses' ? 'dress' : 'top')));
      return {
        id: raw.id || fromCatalog?.id || '',
        name: raw.name || fromCatalog?.name || '',
        category,
        cut,
        slot,
        layer_level: isOuter ? 2 : 1,
        garmentImage: raw.garmentImage || raw.garment_image || fromCatalog?.garmentImage || null,
      };
    })
    .sort((a, b) => (a.layer_level - b.layer_level) || ((SLOT_ORDER[a.slot] || 9) - (SLOT_ORDER[b.slot] || 9)));
}

/**
 * Service 05: AI Vision Microservice Gateway & 2-Stage Pipeline (An Đức Minh Trí)
 * Hỗ trợ linh hoạt: Toàn thân (full_body), Nửa người (half_body) và Cận mặt & vai (portrait_upper).
 */
export async function handleAiVisionRoutes(ctx) {
  const { req, res, m, p, s, root, jobs, body, json, rate } = ctx;

  if (p === '/api/ai/validate-and-matting' && m === 'POST') {
    rate('ai:' + s.owner, 25, 60000);
    const data = await body(req, 15_000_000);
    const rawImage = data.image;
    const preferredFraming = Object.hasOwn(FRAMING_META, data.preferredFraming) ? data.preferredFraming : null;
    if (!rawImage || typeof rawImage !== 'string') throw fail(400, 'INVALID_IMAGE', 'Thiếu dữ liệu ảnh người dùng.');

    if (process.env.AI_SERVICE_URL) {
      try {
        const aiRes = await fetch(`${process.env.AI_SERVICE_URL.replace(/\/$/, '')}/api/ai/validate-and-matting`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: rawImage, preferred_framing: preferredFraming }),
          signal: AbortSignal.timeout(25000),
        });
        const result = await aiRes.json();
        if (aiRes.ok && result.success) {
          json(res, result);
          return true;
        }
        if (result.error) throw fail(400, 'AI_VALIDATION_ERROR', result.error);
      } catch (e) {
        if (e.code === 'AI_VALIDATION_ERROR') throw e;
      }
    }

    try {
      const base64Data = rawImage.replace(/^data:image\/\w+;base64,/, '');
      const imgBuffer = Buffer.from(base64Data, 'base64');
      const meta = await sharp(imgBuffer).metadata();

      if (!meta.height || !meta.width || meta.width < 200 || meta.height < 200) {
        throw fail(400, 'INVALID_IMAGE', 'Ảnh có độ phân giải quá thấp. Vui lòng chụp hoặc tải ảnh rõ khuôn mặt (tối thiểu 200×200 px).');
      }
      if (meta.width > meta.height * 1.85) {
        throw fail(400, 'INVALID_IMAGE', 'Khung ảnh quá ngang. Vui lòng chụp khung dọc, vuông hoặc webcam tiêu chuẩn có rõ khuôn mặt.');
      }

      const ratio = meta.height / meta.width;
      const framing = preferredFraming || (ratio >= 1.32 ? 'full_body' : ratio >= 0.95 ? 'half_body' : 'portrait_upper');
      const framingInfo = FRAMING_META[framing];

      const resized = await sharp(imgBuffer)
        .rotate()
        .resize({
          width: 768,
          height: 1024,
          fit: 'contain',
          position: framing === 'full_body' ? 'centre' : 'south',
          background: '#FFFFFF',
        })
        .flatten({ background: '#FFFFFF' })
        .png()
        .toBuffer();

      json(res, {
        success: true,
        image: `data:image/png;base64,${resized.toString('base64')}`,
        framing,
        framingLabel: framingInfo.label,
        supportedSlots: framingInfo.supportedSlots,
        engine: 'gateway-sharp-fallback',
        message: `Ảnh hợp lệ (${framingInfo.label}). Đã chuẩn hóa khung nền trắng #FFFFFF thành công.`,
      });
      return true;
    } catch (err) {
      if (err.status) throw err;
      throw fail(400, 'INVALID_IMAGE', 'Ảnh không hợp lệ hoặc bị hỏng. Vui lòng chụp lại ảnh có rõ khuôn mặt.');
    }
  }

  if (p === '/api/ai/try-on' && m === 'POST') {
    rate('ai:' + s.owner, 25, 60000);
    const data = await body(req, 15_000_000);
    const { personImage, items } = data;
    const framing = Object.hasOwn(FRAMING_META, data.framing) ? data.framing : 'full_body';
    if (!personImage || typeof personImage !== 'string' || !Array.isArray(items) || items.length === 0) {
      throw fail(400, 'INVALID_TRYON', 'Thiếu ảnh người mẫu hoặc danh sách trang phục.');
    }

    const sortedItems = normalizeItems(items);
    const personHash = digest(personImage);
    const cacheKey = digest(JSON.stringify(['ai-v2.2', framing, personHash, sortedItems.map(i => `${i.id}:${i.layer_level}`)]));

    const hit = jobs.findAiCache(s.owner, cacheKey);
    if (hit) {
      json(res, {
        success: true,
        cached: true,
        framing,
        warnings: [],
        jobId: hit.job.jobId,
        imageUrl: hit.job.imageUrl,
        image: `data:image/png;base64,${hit.media.data.toString('base64')}`,
        engine: hit.engine,
        message: 'Lấy kết quả phối đồ tức thì từ bộ nhớ đệm.',
      });
      return true;
    }

    if (process.env.AI_SERVICE_URL) {
      try {
        const aiRes = await fetch(`${process.env.AI_SERVICE_URL.replace(/\/$/, '')}/api/ai/try-on`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ person_image: personImage, garments: sortedItems, framing }),
          signal: AbortSignal.timeout(35000),
        });
        const result = await aiRes.json();
        if (aiRes.ok && result.success && result.image) {
          const outBuf = Buffer.from(result.image.replace(/^data:image\/\w+;base64,/, ''), 'base64');
          const saved = jobs.recordAiTryOn(s.owner, cacheKey, sortedItems, outBuf, result.engine || 'ai-service');
          json(res, {
            ...result,
            cached: false,
            jobId: saved.job.jobId,
            imageUrl: saved.job.imageUrl,
          });
          return true;
        }
      } catch {
        // Fallback sang bộ ghép lớp 2D khi AI Microservice offline
      }
    }

    try {
      const base64Data = personImage.replace(/^data:image\/\w+;base64,/, '');
      let currentBuffer = Buffer.from(base64Data, 'base64');
      const baseMeta = await sharp(currentBuffer).metadata();
      const mw = baseMeta.width || 768;
      const mh = baseMeta.height || 1024;
      const supportedSlots = new Set(FRAMING_META[framing].supportedSlots);
      const warnings = [];

      for (const item of sortedItems) {
        if (!supportedSlots.has(item.slot)) {
          warnings.push(`Ảnh đang ở chế độ ${FRAMING_META[framing].label} nên bỏ qua ${item.name || item.slot}. Hãy chụp toàn thân để thử quần/váy.`);
          continue;
        }
        if (!item.garmentImage) continue;
        try {
          const garmentPath = resolve(root, 'frontend', 'public', '.' + item.garmentImage);
          const garmentBuffer = await readFile(garmentPath);
          const trimmed = await sharp(garmentBuffer).trim().png().toBuffer();
          const gMeta = await sharp(trimmed).metadata();
          const aspect = (gMeta.height || 1) / Math.max(1, gMeta.width || 1);

          let targetW, targetH, pasteX, pasteY;
          if (framing === 'portrait_upper') {
            const widthRatio = (item.cut === 'blazer' || item.layer_level === 2) ? 0.62 : 0.54;
            targetW = Math.round(mw * widthRatio);
            targetH = Math.round(targetW * aspect);
            pasteX = Math.round(mw * 0.5 - targetW * 0.5);
            pasteY = Math.round(mh * 0.72);
          } else if (framing === 'half_body') {
            const widthRatio = (item.cut === 'blazer' || item.layer_level === 2) ? 0.58 : 0.50;
            targetW = Math.round(mw * widthRatio);
            targetH = Math.round(targetW * aspect);
            pasteX = Math.round(mw * 0.5 - targetW * 0.5);
            pasteY = Math.round(mh * 0.52);
          } else if (item.category === 'bottoms') {
            targetW = Math.round(mw * 0.40);
            targetH = Math.round(targetW * aspect);
            pasteX = Math.round(mw * 0.5 - targetW * 0.5);
            pasteY = Math.round(mh * 0.42);
          } else if (item.cut === 'blazer' || item.layer_level === 2) {
            targetW = Math.round(mw * 0.54);
            targetH = Math.round(targetW * aspect);
            pasteX = Math.round(mw * 0.5 - targetW * 0.5);
            pasteY = Math.round(mh * 0.19);
          } else {
            targetW = Math.round(mw * 0.48);
            targetH = Math.round(targetW * aspect);
            pasteX = Math.round(mw * 0.5 - targetW * 0.5);
            pasteY = Math.round(mh * 0.20);
          }

          let resizedGarment = await sharp(trimmed)
            .resize(Math.max(10, targetW), Math.max(10, targetH), { fit: 'inside' })
            .png()
            .toBuffer();

          const rMeta = await sharp(resizedGarment).metadata();
          const safeLeft = Math.max(0, pasteX);
          const safeTop = Math.max(0, pasteY);
          const maxW = Math.max(1, mw - safeLeft);
          const maxH = Math.max(1, mh - safeTop);
          if (rMeta.width > maxW || rMeta.height > maxH) {
            resizedGarment = await sharp(resizedGarment)
              .extract({ left: 0, top: 0, width: Math.min(rMeta.width, maxW), height: Math.min(rMeta.height, maxH) })
              .png()
              .toBuffer();
          }

          currentBuffer = await sharp(currentBuffer)
            .composite([{ input: resizedGarment, top: safeTop, left: safeLeft }])
            .png()
            .toBuffer();
        } catch (e) {
          console.error('Lỗi ghép sản phẩm:', item.name, e.message);
        }
      }

      const saved = jobs.recordAiTryOn(s.owner, cacheKey, sortedItems, currentBuffer, 'gateway-2d-fallback');
      json(res, {
        success: true,
        cached: false,
        framing,
        warnings,
        jobId: saved.job.jobId,
        imageUrl: saved.job.imageUrl,
        image: `data:image/png;base64,${currentBuffer.toString('base64')}`,
        engine: 'gateway-2d-fallback',
        message: 'Phối đồ phân tầng nhiều lớp hoàn tất.',
      });
      return true;
    } catch {
      throw fail(500, 'TRYON_ERROR', 'Không thể phối đồ đạt chất lượng. Vui lòng thử lại.');
    }
  }

  return false;
}

import { byId } from '../../../data/catalog.mjs';
import { digest, fail, uuid } from '../platform/store.mjs';
import { answer } from '../modules/stylist/rules.mjs';
import { narrate } from '../modules/stylist/llm.mjs';

const SLOT_ORDER = { bottom: 1, top: 2, dress: 3, outer: 4 };

export function validateAndOrderOutfit(productIds) {
  const slots = { top: null, bottom: null, outer: null, dress: null };
  const notifications = [];

  for (const id of productIds) {
    const prod = byId.get(id);
    if (!prod) continue;
    const isOuter = prod.cut === 'blazer';
    const slot = isOuter ? 'outer' : (prod.category === 'bottoms' ? 'bottom' : (prod.category === 'dresses' ? 'dress' : 'top'));
    const layer_level = isOuter ? 2 : 1;
    const entry = {
      id: prod.id,
      name: prod.name,
      category: prod.category,
      cut: prod.cut || '',
      slot,
      layer_level,
      garmentImage: prod.garmentImage,
    };

    if (slot === 'dress') {
      if (slots.top || slots.bottom) notifications.push(`Đầm ${prod.name} đã thay thế áo và quần hiện tại.`);
      if (slots.dress) notifications.push(`Đã thay thế ${slots.dress.name} bằng ${prod.name}.`);
      slots.top = null;
      slots.bottom = null;
      slots.dress = entry;
    } else if (slot === 'top' || slot === 'bottom') {
      if (slots.dress) {
        notifications.push(`Đã bỏ ${slots.dress.name} để phối cùng ${prod.name}.`);
        slots.dress = null;
      }
      if (slots[slot]) notifications.push(`Đã thay thế ${slots[slot].name} bằng ${prod.name}.`);
      slots[slot] = entry;
    } else {
      if (slots.outer) notifications.push(`Đã thay thế ${slots.outer.name} bằng ${prod.name}.`);
      slots.outer = entry;
    }
  }

  const orderedItems = Object.values(slots)
    .filter(Boolean)
    .sort((a, b) => (a.layer_level - b.layer_level) || ((SLOT_ORDER[a.slot] || 9) - (SLOT_ORDER[b.slot] || 9)));

  return { orderedItems, notifications };
}

/**
 * Service 03: AI Stylist, Conversation & Layering (Hoàng Lâm Tùng)
 */
export async function handleStylistRoutes(ctx) {
  const { req, res, m, p, s, store, state, body, json, rate, chatBusy } = ctx;
  const { get } = store;

  if (p.startsWith('/api/conversations/') && m === 'GET') {
    const current = state();
    if (current.conversationId !== p.split('/').at(-1)) throw fail(404, 'NOT_FOUND', 'Không tìm thấy hội thoại.');
    json(res, { conversationId: current.conversationId, messages: current.messages });
    return true;
  }

  if (p === '/api/stylist/validate-outfit' && m === 'POST') {
    const d = await body(req);
    if (!Array.isArray(d.productIds) || d.productIds.length === 0) {
      throw fail(422, 'INVALID_OUTFIT', 'Cần cung cấp danh sách productIds hợp lệ.');
    }
    const result = validateAndOrderOutfit(d.productIds);
    if (result.orderedItems.length === 0) {
      throw fail(422, 'INVALID_OUTFIT', 'Không tìm thấy sản phẩm hợp lệ trong danh mục.');
    }
    json(res, result);
    return true;
  }

  if (p === '/api/chat' && m === 'POST') {
    const d = await body(req);
    const message = typeof d.message === 'string' ? d.message.trim() : '';
    if (!message || message.length > 500) throw fail(422, 'INVALID_MESSAGE', 'Nhập câu hỏi từ 1 đến 500 ký tự.');
    if (chatBusy.has(s.owner)) throw fail(409, 'CHAT_BUSY', 'Stylist đang trả lời.');
    rate('chat:' + s.owner, 20, 60000);
    chatBusy.add(s.owner);
    try {
      const current = state();
      const product = byId.get(d.productId);
      const reply = answer(message, current.profile, product, current.messages);
      const text = await narrate({
        message,
        reply,
        history: current.messages,
        profile: current.profile,
        page: d.page === 'fitting' ? 'fitting' : 'shop',
        current: product,
      });
      if (!get('SELECT token FROM sessions WHERE token=?', digest(s.token))) {
        throw fail(409, 'SESSION_CHANGED', 'Phiên đã thay đổi.');
      }
      const latest = state(), stamp = new Date().toISOString();
      latest.messages = [
        ...latest.messages,
        { id: uuid(), role: 'user', text: message, createdAt: stamp },
        {
          id: uuid(),
          role: 'assistant',
          text: text || reply.text,
          cards: reply.cards.map(r => ({ productId: r.productId, recommendedSize: r.recommendedSize })),
          createdAt: stamp,
        },
      ].slice(-40);
      store.put(s.owner, latest);
      json(res, { conversationId: latest.conversationId, messages: latest.messages });
      return true;
    } finally {
      chatBusy.delete(s.owner);
    }
  }

  return false;
}

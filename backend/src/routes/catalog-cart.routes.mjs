import { byId } from '../../../data/catalog.mjs';
import { fail } from '../platform/store.mjs';
import { ranked } from '../modules/stylist/rules.mjs';

/**
 * Service 02: Catalog, Search & Cart (Nguyễn Xuân Tường)
 */
export async function handleCatalogCartRoutes(ctx) {
  const { req, res, m, p, params, s, store, state, body, json, cartInfo } = ctx;

  if (p === '/api/products' && m === 'GET') {
    const { results } = ranked(params, state().profile);
    const limit = Math.max(1, Math.min(24, Number(params.limit) || 24));
    const page = Math.max(1, Math.floor(Number(params.page) || 1));
    json(res, { items: results.slice((page - 1) * limit, page * limit).map(r => r.product), total: results.length, page });
    return true;
  }

  if (p.startsWith('/api/products/') && m === 'GET') {
    const product = byId.get(p.split('/').at(-1));
    if (!product) throw fail(404, 'NOT_FOUND', 'Sản phẩm không tồn tại.');
    json(res, { product });
    return true;
  }

  if ((p === '/api/recommendations' && m === 'GET') || (p === '/api/search' && m === 'POST')) {
    const filters = m === 'POST' ? await body(req) : params;
    json(res, ranked(filters, state().profile));
    return true;
  }

  if (p === '/api/cart' && m === 'GET') {
    json(res, cartInfo(state().cart));
    return true;
  }

  if (p === '/api/cart/items' && ['POST', 'PATCH', 'DELETE'].includes(m)) {
    const d = await body(req), item = byId.get(d.productId), current = state(), cart = current.cart;
    const index = cart.findIndex(l => l.productId === d.productId && l.size === d.size);
    if (m === 'DELETE') {
      if (index >= 0) cart.splice(index, 1);
    } else {
      const n = d.quantity ?? 1;
      const quantity = n + (m === 'POST' ? (cart[index]?.quantity || 0) : 0);
      if (!item || !Object.hasOwn(item.stock, d.size) || !Number.isInteger(n) || n < 1 || quantity > item.stock[d.size]) {
        throw fail(422, 'INVALID_CART', 'Size hoặc số lượng không còn đủ trong kho.');
      }
      const line = { productId: item.id, size: d.size, quantity };
      if (index < 0) cart.push(line);
      else cart[index] = line;
    }
    store.put(s.owner, current);
    json(res, cartInfo(cart));
    return true;
  }

  return false;
}

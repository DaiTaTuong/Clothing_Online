import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from '../backend/src/server.mjs';
import { byId, products } from '../data/catalog.mjs';
import { sampleProfile, measurements, bodyShape, fitSize } from '../shared/contracts/index.mjs';

test('Doan Duy Loi - Tuan 1 (T13, T14, T15): Backend nen tang, Database, Auth, Ho so, San pham va Gio hang', async t => {
  const { server, store } = await createApp({ file: ':memory:', demo: true });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');

  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
    store.db.close();
  });

  const origin = 'http://127.0.0.1:' + server.address().port;

  function createClient() {
    let cookie = '';
    return async (path, method = 'GET', body = undefined, headers = {}) => {
      const res = await fetch(origin + path, {
        method,
        headers: {
          Cookie: cookie,
          ...(body ? { 'Content-Type': 'application/json' } : {}),
          ...headers,
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      const setCookie = res.headers.get('set-cookie');
      if (setCookie) cookie = setCookie.split(';')[0];
      const data = res.headers.get('content-type')?.startsWith('application/json')
        ? await res.json()
        : null;
      return { status: res.status, headers: res.headers, data };
    };
  }

  // ==========================================
  // [T13] Khung backend, Database, Security & Contracts
  // ==========================================
  await t.test('T13: Health check, Security Headers, Database Tables & Contracts', async () => {
    const client = createClient();

    // 1. Health check & Security headers
    const health = await client('/api/health');
    assert.equal(health.status, 200);
    assert.equal(health.data.status, 'ok');
    assert.equal(health.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(health.headers.get('x-frame-options'), 'DENY');
    assert.equal(health.headers.get('referrer-policy'), 'same-origin');

    // 2. Database tables ton tai
    const tables = store.all("SELECT name FROM sqlite_master WHERE type='table'").map(r => r.name);
    for (const table of ['accounts', 'sessions', 'states', 'media', 'jobs', 'usage']) {
      assert.ok(tables.includes(table), `Table ${table} phai ton tai trong database`);
    }

    // 3. Shared contracts duoc dinh nghia chinh xac
    assert.ok(measurements.height && measurements.waist && measurements.bust && measurements.hip);
    assert.equal(bodyShape({ height: 160, bust: 85, waist: 60, hip: 90 }), 'dáng đồng hồ cát');
    assert.equal(bodyShape({ height: 160, bust: 80, waist: 70, hip: 95 }), 'dáng quả lê');

    // 4. Ma loi tra ve dung chuan { code, message, requestId }
    const notFound = await client('/api/unknown-endpoint');
    assert.equal(notFound.status, 404);
    assert.equal(notFound.data.code, 'NOT_FOUND');
    assert.ok(notFound.data.requestId);
  });

  // ==========================================
  // [T14] Auth, Phien khach va Ho so nguoi dung
  // ==========================================
  await t.test('T14: Phien khach, Dang ky, Dang nhap, Ho so & Gop du lieu (Merge)', async () => {
    const guest = createClient();

    // 1. Khoi tao phien khach (Guest Session)
    const sessionRes = await guest('/api/session');
    assert.equal(sessionRes.status, 200);
    assert.equal(sessionRes.data.user, null);
    assert.equal(sessionRes.data.profile, null);
    assert.equal(sessionRes.data.profileVersion, 0);

    // 2. Cap nhat ho so khach (Profile Validation)
    const invalidProfile = await guest('/api/profile', 'PUT', { ...sampleProfile, height: 250 });
    assert.equal(invalidProfile.status, 422); // Chieu cao vuot gioi han
    assert.equal(invalidProfile.data.code, 'INVALID_PROFILE');

    const validProfile = await guest('/api/profile', 'PUT', sampleProfile);
    assert.equal(validProfile.status, 200);
    assert.equal(validProfile.data.profile.height, 165);
    assert.equal(validProfile.data.profileVersion, 1);

    // 3. Khach them hang vao gio
    const addCart = await guest('/api/cart/items', 'POST', { productId: 'linen-shirt', size: 'S', quantity: 2 });
    assert.equal(addCart.status, 200);
    assert.equal(addCart.data.count, 2);

    // 4. Dang ky tai khoan moi -> Tu dong Merge du lieu khach sang User
    const regRes = await guest('/api/auth/register', 'POST', {
      name: 'Doan Duy Loi',
      email: 'loi.test@forme.vn',
      password: 'MatKhauBaoMat2026!',
    });
    assert.equal(regRes.status, 201);
    assert.equal(regRes.data.user.name, 'Doan Duy Loi');
    assert.equal(regRes.data.user.email, 'loi.test@forme.vn');
    // Du lieu gio hang va profile duoc ke thua thanh cong sau khi merge
    assert.equal(regRes.data.cart.count, 2);
    assert.equal(regRes.data.profile.height, 165);

    // 5. Dang xuat
    const logoutRes = await guest('/api/auth/logout', 'POST');
    assert.equal(logoutRes.status, 200);
    assert.equal(logoutRes.data.user, null);
    assert.equal(logoutRes.data.cart.count, 0);

    // 6. Dang nhap lai
    const loginRes = await guest('/api/auth/login', 'POST', {
      email: 'loi.test@forme.vn',
      password: 'MatKhauBaoMat2026!',
    });
    assert.equal(loginRes.status, 200);
    assert.equal(loginRes.data.user.email, 'loi.test@forme.vn');
    assert.equal(loginRes.data.cart.count, 2);
  });

  // ==========================================
  // [T15] San pham va Gio hang
  // ==========================================
  await t.test('T15: API Danh muc san pham va Quan ly gio hang (Cart)', async () => {
    const client = createClient();

    // 1. API Danh sach san pham co phan trang
    const prodList = await client('/api/products?page=1&limit=8');
    assert.equal(prodList.status, 200);
    assert.equal(prodList.data.items.length, 8);
    assert.equal(prodList.data.total, 24);

    // 2. API Chi tiet san pham
    const detail = await client('/api/products/linen-shirt');
    assert.equal(detail.status, 200);
    assert.equal(detail.data.product.id, 'linen-shirt');
    assert.equal(detail.data.product.price, 489000);

    const notFoundProd = await client('/api/products/san-pham-khong-ton-tai');
    assert.equal(notFoundProd.status, 404);

    // 3. Them san pham vao gio hang va kiem tra tinh tong tien
    const item1 = await client('/api/cart/items', 'POST', { productId: 'linen-shirt', size: 'M', quantity: 1 });
    assert.equal(item1.status, 200);
    assert.equal(item1.data.count, 1);
    assert.equal(item1.data.total, 489000);

    // 4. Kiem tra tinh hop le khi them vuot ton kho (Stock Validation)
    const maxStock = byId.get('linen-shirt').stock.M;
    const overflow = await client('/api/cart/items', 'PATCH', { productId: 'linen-shirt', size: 'M', quantity: maxStock + 10 });
    assert.equal(overflow.status, 422);
    assert.equal(overflow.data.code, 'INVALID_CART');

    // 5. Cap nhat so luong hop le
    const update = await client('/api/cart/items', 'PATCH', { productId: 'linen-shirt', size: 'M', quantity: 2 });
    assert.equal(update.status, 200);
    assert.equal(update.data.count, 2);
    assert.equal(update.data.total, 489000 * 2);

    // 6. Xoa khoi gio hang
    const remove = await client('/api/cart/items', 'DELETE', { productId: 'linen-shirt', size: 'M' });
    assert.equal(remove.status, 200);
    assert.equal(remove.data.count, 0);
    assert.equal(remove.data.total, 0);
  });
});

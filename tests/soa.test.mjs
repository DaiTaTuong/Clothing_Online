import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import sharp from 'sharp';
import { createApp } from '../backend/src/server.mjs';
import { byId } from '../data/catalog.mjs';
import { sampleProfile, measurements, bodyShape } from '../shared/contracts/index.mjs';

test('SOA 5 Services: Identity, Catalog/Cart, Stylist/Layering, Media/Jobs & AI Vision', async t => {
  const prevAiUrl = process.env.AI_SERVICE_URL;
  delete process.env.AI_SERVICE_URL;
  const { server, store } = await createApp({ file: ':memory:', demo: true });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');

  t.after(async () => {
    if (prevAiUrl !== undefined) process.env.AI_SERVICE_URL = prevAiUrl;
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
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          ...headers,
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
      const setCookie = res.headers.get('set-cookie');
      if (setCookie) cookie = setCookie.split(';')[0];
      const data = res.headers.get('content-type')?.startsWith('application/json')
        ? await res.json()
        : null;
      return { status: res.status, headers: res.headers, data };
    };
  }

  await t.test('Service 01 (Loi): Health, Security Headers, OpenAPI JSON, Auth & Profile Merge', async () => {
    const client = createClient();

    const health = await client('/api/health');
    assert.equal(health.status, 200);
    assert.equal(health.data.status, 'ok');
    assert.equal(health.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(health.headers.get('x-frame-options'), 'DENY');
    assert.equal(health.headers.get('referrer-policy'), 'same-origin');

    const specRes = await client('/api/openapi.json');
    assert.equal(specRes.status, 200);
    assert.equal(specRes.data.openapi, '3.0.3');
    for (const p of ['/api/session', '/api/products', '/api/stylist/validate-outfit', '/api/try-ons', '/api/ai/try-on']) {
      assert.ok(specRes.data.paths[p], `OpenAPI spec must include ${p}`);
    }
    assert.ok(!JSON.stringify(specRes.data).includes('./common-schemas.json'), 'External $ref must be resolved');

    const docsRes = await fetch(origin + '/api/docs');
    assert.equal(docsRes.status, 200);
    assert.ok(docsRes.headers.get('content-type')?.includes('text/html'));
    const docsHtml = await docsRes.text();
    assert.ok(docsHtml.includes('SwaggerUIBundle') && docsHtml.includes('/api/openapi.json'));

    const guestAdmin = await client('/api/admin/overview');
    assert.equal(guestAdmin.status, 403);
    assert.equal(guestAdmin.data.code, 'FORBIDDEN');

    const badLogin = await client('/api/auth/login', 'POST', {
      email: 'studio@forme.demo',
      password: 'WrongPassword123!',
    });
    assert.equal(badLogin.status, 401);
    assert.equal(badLogin.data.code, 'INVALID_LOGIN');

    const tables = store.all("SELECT name FROM sqlite_master WHERE type='table'").map(r => r.name);
    for (const table of ['accounts', 'sessions', 'states', 'media', 'jobs', 'usage']) {
      assert.ok(tables.includes(table));
    }

    assert.ok(measurements.height && measurements.waist && measurements.bust && measurements.hip);
    assert.equal(bodyShape({ height: 160, bust: 85, waist: 60, hip: 90 }), 'dáng đồng hồ cát');

    const notFound = await client('/api/unknown-endpoint');
    assert.equal(notFound.status, 404);
    assert.equal(notFound.data.code, 'NOT_FOUND');
    assert.ok(notFound.data.requestId);

    const invalidProfile = await client('/api/profile', 'PUT', { ...sampleProfile, height: 250 });
    assert.equal(invalidProfile.status, 422);
    assert.equal(invalidProfile.data.code, 'INVALID_PROFILE');

    const validProfile = await client('/api/profile', 'PUT', sampleProfile);
    assert.equal(validProfile.status, 200);
    assert.equal(validProfile.data.profileVersion, 1);

    await client('/api/cart/items', 'POST', { productId: 'rose-knit', size: 'S', quantity: 2 });

    const reg = await client('/api/auth/register', 'POST', {
      name: 'Doan Duy Loi',
      email: 'loi.soa@forme.vn',
      password: 'MatKhauBaoMat2026!',
    });
    assert.equal(reg.status, 201);
    assert.equal(reg.data.cart.count, 2);
    assert.equal(reg.data.profile.height, 165);

    const logout = await client('/api/auth/logout', 'POST');
    assert.equal(logout.status, 200);
    assert.equal(logout.data.user, null);

    const login = await client('/api/auth/login', 'POST', {
      email: 'loi.soa@forme.vn',
      password: 'MatKhauBaoMat2026!',
    });
    assert.equal(login.status, 200);
    assert.equal(login.data.cart.count, 2);

    const memberAdmin = await client('/api/admin/overview');
    assert.equal(memberAdmin.status, 403);
    assert.equal(memberAdmin.data.code, 'FORBIDDEN');

    const adminClient = createClient();
    const adminLogin = await adminClient('/api/auth/login', 'POST', {
      email: 'studio@forme.demo',
      password: 'FormeStudio2026!',
    });
    assert.equal(adminLogin.status, 200);
    const overview = await adminClient('/api/admin/overview');
    assert.equal(overview.status, 200);
    assert.equal(overview.data.products, 17);
  });

  await t.test('Service 02 (Tuong): Catalog Pagination, Detail & Cart Stock Integrity', async () => {
    const client = createClient();

    const prodList = await client('/api/products?page=1&limit=8');
    assert.equal(prodList.status, 200);
    assert.equal(prodList.data.items.length, 8);
    assert.equal(prodList.data.total, 17);

    const detail = await client('/api/products/rose-knit');
    assert.equal(detail.status, 200);
    assert.equal(detail.data.product.id, 'rose-knit');

    const missing = await client('/api/products/khong-ton-tai');
    assert.equal(missing.status, 404);

    const added = await client('/api/cart/items', 'POST', { productId: 'rose-knit', size: 'M', quantity: 1 });
    assert.equal(added.status, 200);
    assert.equal(added.data.count, 1);

    const maxStock = byId.get('rose-knit').stock.M;
    const overflow = await client('/api/cart/items', 'PATCH', { productId: 'rose-knit', size: 'M', quantity: maxStock + 10 });
    assert.equal(overflow.status, 422);
    assert.equal(overflow.data.code, 'INVALID_CART');

    const removed = await client('/api/cart/items', 'DELETE', { productId: 'rose-knit', size: 'M' });
    assert.equal(removed.status, 200);
    assert.equal(removed.data.count, 0);
  });

  await t.test('Service 03 (Tung): Stylist Outfit Conflict Resolution & Layering Order', async () => {
    const client = createClient();

    const bad = await client('/api/stylist/validate-outfit', 'POST', { productIds: [] });
    assert.equal(bad.status, 422);
    assert.equal(bad.data.code, 'INVALID_OUTFIT');

    const layered = await client('/api/stylist/validate-outfit', 'POST', {
      productIds: ['navy-blazer', 'blue-jeans', 'black-trouser', 'sage-tee'],
    });
    assert.equal(layered.status, 200);
    assert.deepEqual(
      layered.data.orderedItems.map(i => i.id),
      ['black-trouser', 'sage-tee', 'navy-blazer']
    );
    assert.equal(layered.data.orderedItems.at(-1).layer_level, 2);
    assert.ok(layered.data.notifications.length >= 1);
  });

  await t.test('Service 04 & 05 (Thanh + Tri): AI 2-Stage Pipeline (Full/Half/Portrait), Cache Hit & Saved History', async () => {
    const client = createClient();

    // Extreme panorama / tiny image should be rejected by Step 1
    const panorama = await sharp({ create: { width: 800, height: 220, channels: 3, background: '#cccccc' } }).png().toBuffer();
    const badStep1 = await client('/api/ai/validate-and-matting', 'POST', {
      image: 'data:image/png;base64,' + panorama.toString('base64'),
    });
    assert.equal(badStep1.status, 400);

    // Square / webcam half-body or upper-portrait photo should be ACCEPTED and classified properly
    const webcamPortrait = await sharp({ create: { width: 640, height: 480, channels: 3, background: '#e0e0e0' } }).png().toBuffer();
    const step1Portrait = await client('/api/ai/validate-and-matting', 'POST', {
      image: 'data:image/png;base64,' + webcamPortrait.toString('base64'),
    });
    assert.equal(step1Portrait.status, 200);
    assert.equal(step1Portrait.data.success, true);
    assert.equal(step1Portrait.data.framing, 'portrait_upper');
    assert.deepEqual(step1Portrait.data.supportedSlots, ['top', 'outer']);

    // Portrait upper try-on with top + bottom should composite top and warn about bottom
    const upperTryOn = await client('/api/ai/try-on', 'POST', {
      personImage: step1Portrait.data.image,
      framing: 'portrait_upper',
      items: [
        { id: 'rose-knit', layer_level: 1, slot: 'top' },
        { id: 'blue-jeans', layer_level: 1, slot: 'bottom' },
      ],
    });
    assert.equal(upperTryOn.status, 200);
    assert.equal(upperTryOn.data.framing, 'portrait_upper');
    assert.equal(upperTryOn.data.warnings.length, 1);

    // Full-body vertical image should pass Step 1 and pad to 768x1024
    const portrait = await sharp({ create: { width: 480, height: 720, channels: 3, background: '#dcdcdc' } }).png().toBuffer();
    const step1 = await client('/api/ai/validate-and-matting', 'POST', {
      image: 'data:image/png;base64,' + portrait.toString('base64'),
    });
    assert.equal(step1.status, 200);
    assert.equal(step1.data.success, true);
    assert.equal(step1.data.framing, 'full_body');

    const outMeta = await sharp(Buffer.from(step1.data.image.split(',')[1], 'base64')).metadata();
    assert.deepEqual([outMeta.width, outMeta.height], [768, 1024]);

    // Step 2: multi-layer try-on + cache hit + save to history
    const tryOnPayload = {
      personImage: step1.data.image,
      framing: 'full_body',
      items: [
        { id: 'navy-blazer', layer_level: 2, slot: 'outer' },
        { id: 'rose-knit', layer_level: 1, slot: 'top' },
        { id: 'blue-jeans', layer_level: 1, slot: 'bottom' },
      ],
    };
    const first = await client('/api/ai/try-on', 'POST', tryOnPayload);
    assert.equal(first.status, 200);
    assert.equal(first.data.success, true);
    assert.equal(first.data.cached, false);
    assert.ok(first.data.jobId);
    assert.ok(first.data.imageUrl);

    const second = await client('/api/ai/try-on', 'POST', tryOnPayload);
    assert.equal(second.status, 200);
    assert.equal(second.data.cached, true);
    assert.equal(second.data.jobId, first.data.jobId);
    assert.equal(second.data.image, first.data.image, 'Cached image base64 must be valid and identical to first try-on');

    const saved = await client(`/api/try-ons/${first.data.jobId}`, 'PATCH', {});
    assert.equal(saved.status, 200);
    assert.equal(saved.data.saved, true);

    const hist = await client('/api/try-ons');
    assert.equal(hist.status, 200);
    assert.equal(hist.data.items.length, 1);
    assert.equal(hist.data.items[0].jobId, first.data.jobId);
  });
});

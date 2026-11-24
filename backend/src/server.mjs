import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { randomBytes } from 'node:crypto';
import { byId } from '../../data/catalog.mjs';
import { createStore, hashPassword, day, digest, fail, now, uuid } from './platform/store.mjs';
import { createJobs } from './modules/tryon/jobs.mjs';
import { providerSettings } from './modules/tryon/providers.mjs';
import { handleIdentityRoutes } from './routes/identity.routes.mjs';
import { handleCatalogCartRoutes } from './routes/catalog-cart.routes.mjs';
import { handleStylistRoutes } from './routes/stylist.routes.mjs';
import { handleMediaJobsRoutes } from './routes/media-jobs.routes.mjs';
import { handleAiVisionRoutes } from './routes/ai-vision.routes.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
};
const demoEmail = 'studio@forme.demo';
const demoPassword = 'FormeStudio2026!';
const sessionAge = day * 7;

function cookie(req) {
  return req.headers.cookie?.match(/(?:^|;\s*)forme_sid=([a-f0-9]{64})(?:;|$)/)?.[1];
}

function json(res, data, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(data));
}

async function body(req, limit = 32768) {
  if (!req.headers['content-type']?.startsWith('application/json')) throw fail(415, 'CONTENT_TYPE', 'Yêu cầu phải dùng JSON.');
  if (Number(req.headers['content-length']) > limit) throw fail(413, 'BODY_LIMIT', 'Dữ liệu quá lớn.');
  let length = 0;
  const chunks = [];
  for await (const chunk of req) {
    length += chunk.length;
    if (length > limit) throw fail(413, 'BODY_LIMIT', 'Dữ liệu quá lớn.');
    chunks.push(chunk);
  }
  try {
    const data = JSON.parse(Buffer.concat(chunks));
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw Error();
    return data;
  } catch {
    throw fail(400, 'INVALID_JSON', 'Dữ liệu không hợp lệ.');
  }
}

export async function createApp({ file = resolve(root, '.runtime', 'forme.sqlite'), dev = false, demo = process.env.DEMO_ADMIN !== '0' } = {}) {
  const store = createStore(file);
  const jobs = createJobs(store);
  const { get, run } = store;

  if (demo && !get('SELECT id FROM accounts WHERE email=?', demoEmail)) {
    run('INSERT INTO accounts VALUES (?,?,?,?,?)', uuid(), demoEmail, 'Nhóm FORME', await hashPassword(demoPassword), 'admin');
  }

  const attempts = new Map();
  const chatBusy = new Set();
  const sweep = setInterval(() => {
    store.sweep();
    for (const [key, r] of attempts) if (r.until < now()) attempts.delete(key);
  }, 60000);
  sweep.unref();

  const server = createServer();
  const vite = dev
    ? await (await import('vite')).createServer({
        configFile: resolve(root, 'vite.config.js'),
        server: { middlewareMode: true, hmr: { server } },
        appType: 'spa',
      })
    : null;

  function rate(key, limit, period) {
    const entry = attempts.get(key);
    const r = !entry || entry.until < now() ? { n: 0, until: now() + period } : entry;
    r.n++;
    attempts.set(key, r);
    if (r.n > limit) throw fail(429, 'RATE_LIMIT', 'Bạn thao tác quá nhanh. Hãy thử lại sau.');
  }

  function startSession(res, user = null) {
    const token = randomBytes(32).toString('hex');
    const owner = user ? 'u:' + user.id : 'g:' + uuid();
    run('INSERT INTO sessions VALUES (?,?,?,?)', digest(token), owner, user?.id ?? null, now() + sessionAge);
    res.setHeader(
      'Set-Cookie',
      `forme_sid=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${sessionAge / 1000}${process.env.COOKIE_SECURE === '1' ? '; Secure' : ''}`
    );
    return { owner, user, token };
  }

  function session(req, res) {
    const token = cookie(req);
    const row = token && get('SELECT * FROM sessions WHERE token=? AND expires>?', digest(token), now());
    if (!row) return startSession(res);
    return { owner: row.owner, user: row.user_id ? get('SELECT * FROM accounts WHERE id=?', row.user_id) : null, token };
  }

  function cartInfo(cart) {
    const items = cart.flatMap(line => {
      const product = byId.get(line.productId);
      return product ? [{ ...line, product, subtotal: product.price * line.quantity }] : [];
    });
    return { items, count: items.reduce((n, l) => n + l.quantity, 0), total: items.reduce((n, l) => n + l.subtotal, 0) };
  }

  function payload(s) {
    const state = store.state(s.owner);
    const { profile, profileVersion, conversationId } = state;
    const user = s.user && { id: s.user.id, name: s.user.name, email: s.user.email, role: s.user.role };
    return {
      user,
      profile,
      profileVersion,
      faceId: state.faceId && jobs.readMedia(s.owner, state.faceId) ? state.faceId : null,
      conversationId,
      cart: cartInfo(state.cart),
      settings: { ...providerSettings(), demoAdmin: demo },
    };
  }

  function mergeSession(from, to) {
    if (!from.owner.startsWith('g:')) return;
    store.txn(() => {
      const guest = store.state(from.owner);
      const account = store.state(to.owner);
      for (const line of guest.cart) {
        const existing = account.cart.find(x => x.productId === line.productId && x.size === line.size);
        if (!existing) account.cart.push(line);
        else existing.quantity = Math.min(byId.get(line.productId).stock[line.size], existing.quantity + line.quantity);
      }
      if (!account.profile && guest.profile) {
        account.profile = guest.profile;
        account.profileVersion++;
      }
      if (guest.messages.length) {
        account.messages = [...account.messages, ...guest.messages]
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
          .slice(-40);
      }
      for (const row of jobs.history(from.owner)) {
        const existing = jobs.job(from.owner, row.jobId);
        const data = JSON.parse(existing.payload);
        if (data.faceId) continue;
        run('UPDATE jobs SET owner=?,cache_key=?,expires=? WHERE id=?', to.owner, digest(row.jobId), now() + 30 * day, row.jobId);
        run('UPDATE media SET owner=?,expires=? WHERE id=?', to.owner, now() + 30 * day, data.imageId);
      }
      store.put(to.owner, account);
      run('DELETE FROM states WHERE owner=?', from.owner);
      run('DELETE FROM jobs WHERE owner=?', from.owner);
      run('DELETE FROM media WHERE owner=?', from.owner);
    });
  }

  const routeHandlers = [
    handleIdentityRoutes,
    handleCatalogCartRoutes,
    handleStylistRoutes,
    handleMediaJobsRoutes,
    handleAiVisionRoutes,
  ];

  async function api(req, res, url) {
    const m = req.method;
    const p = url.pathname;
    const params = Object.fromEntries(url.searchParams);

    if (p === '/api/health' && m === 'GET') return json(res, { status: 'ok' });

    if (!['GET', 'HEAD'].includes(m) && req.headers.origin) {
      const protocol = process.env.COOKIE_SECURE === '1' ? 'https' : 'http';
      if (req.headers.origin !== (process.env.PUBLIC_ORIGIN || `${protocol}://${req.headers.host}`)) {
        throw fail(403, 'ORIGIN', 'Nguồn yêu cầu không hợp lệ.');
      }
    }

    const s = session(req, res);
    const ctx = {
      req,
      res,
      m,
      p,
      params,
      s,
      root,
      demo,
      store,
      jobs,
      chatBusy,
      state: () => store.state(s.owner),
      body,
      json,
      rate,
      startSession,
      mergeSession,
      cartInfo,
      payload,
    };

    for (const handle of routeHandlers) {
      if (await handle(ctx)) return;
    }

    throw fail(404, 'NOT_FOUND', 'Không tìm thấy chức năng.');
  }

  server.on('request', async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('X-Frame-Options', 'DENY');
    const requestId = uuid();
    try {
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname.startsWith('/api/')) return await api(req, res, url);
      if (vite) return vite.middlewares(req, res, () => { res.writeHead(404); res.end(); });
      if (!['GET', 'HEAD'].includes(req.method)) throw fail(405, 'METHOD', 'Phương thức không hỗ trợ.');
      const base = resolve(root, 'dist');
      const candidate = resolve(base, '.' + decodeURIComponent(url.pathname));
      if (candidate !== base && !candidate.startsWith(base + sep)) throw fail(404, 'NOT_FOUND', 'Không tìm thấy trang.');
      const path = extname(candidate) ? candidate : resolve(base, 'index.html');
      let data;
      try {
        data = await readFile(path);
      } catch {
        throw fail(404, 'NOT_FOUND', 'Không tìm thấy tệp. Chạy npm run build trước khi khởi động.');
      }
      res.writeHead(200, {
        'Content-Type': types[extname(path)] || 'application/octet-stream',
        'Cache-Control': path.includes(sep + 'assets' + sep) ? 'public,max-age=31536000,immutable' : 'no-cache',
      });
      res.end(req.method === 'HEAD' ? undefined : data);
    } catch (error) {
      if (!error.status) console.error(requestId, error);
      if (!res.headersSent) {
        json(
          res,
          {
            code: error.code && error.status ? error.code : 'INTERNAL',
            message: error.status ? error.message : 'Có lỗi xảy ra. Vui lòng thử lại.',
            requestId,
          },
          error.status || 500
        );
      } else {
        res.end();
      }
    }
  });

  server.on('close', () => {
    clearInterval(sweep);
    void vite?.close();
  });
  return { server, store };
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const args = process.argv.slice(2);
  const portIndex = args.indexOf('--port');
  const port = Number(portIndex < 0 ? process.env.PORT || 5173 : args[portIndex + 1]);
  const host = process.env.HOST || '127.0.0.1';
  const { server } = await createApp({ dev: args.includes('--dev'), file: process.env.DATABASE_PATH || undefined });
  server.listen(port, host, () => console.log(`FORME Studio: http://${host}:${server.address().port}`));
}

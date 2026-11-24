import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { byId } from '../../../data/catalog.mjs';
import { measurements, styles, faceShapes } from '../../../shared/contracts/index.mjs';
import { hashPassword, checkPassword, digest, fail, now, uuid } from '../platform/store.mjs';
import { providerSettings } from '../modules/tryon/providers.mjs';

const SPEC_FILES = [
  '01-identity-profile.json',
  '02-catalog-cart.json',
  '03-stylist-chat.json',
  '04-media-tryon-jobs.json',
  '05-ai-vision.json',
];

function rewriteRefs(node) {
  if (Array.isArray(node)) return node.map(rewriteRefs);
  if (node && typeof node === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(node)) {
      out[k] = k === '$ref' && typeof v === 'string' && v.startsWith('./common-schemas.json#/')
        ? '#/' + v.slice('./common-schemas.json#/'.length)
        : rewriteRefs(v);
    }
    return out;
  }
  return node;
}

async function buildMergedOpenApi(root) {
  const apiDir = resolve(root, 'docs', 'api');
  const common = JSON.parse(await readFile(resolve(apiDir, 'common-schemas.json'), 'utf8'));
  const merged = {
    openapi: '3.0.3',
    info: {
      title: 'FORME Studio SOA API (Merged Specification)',
      version: '2.0.0',
      description: 'Hợp đồng OpenAPI 3.0 JSON hợp nhất từ 5 phân hệ dịch vụ SOA của nhóm.',
    },
    tags: [],
    paths: {},
    components: {
      securitySchemes: common.components?.securitySchemes || {},
      schemas: { ...(common.components?.schemas || {}) },
    },
  };
  for (const name of SPEC_FILES) {
    const spec = rewriteRefs(JSON.parse(await readFile(resolve(apiDir, name), 'utf8')));
    if (Array.isArray(spec.tags)) merged.tags.push(...spec.tags);
    Object.assign(merged.paths, spec.paths || {});
    Object.assign(merged.components.schemas, spec.components?.schemas || {});
  }
  return merged;
}

/**
 * Service 01: Identity, Session, Profile & Admin (Doãn Duy Lợi)
 */
export async function handleIdentityRoutes(ctx) {
  const { req, res, m, p, s, root, demo, store, state, body, json, rate, startSession, mergeSession, payload } = ctx;
  const { get, run } = store;

  if (p === '/api/openapi.json' && m === 'GET') {
    json(res, await buildMergedOpenApi(root));
    return true;
  }

  if (p === '/api/session' && m === 'GET') {
    json(res, payload(s));
    return true;
  }

  if (p.startsWith('/api/auth/') && m === 'POST') {
    if (p === '/api/auth/logout') {
      run('DELETE FROM sessions WHERE token=?', digest(s.token));
      json(res, payload(startSession(res)));
      return true;
    }
    if (p !== '/api/auth/register' && p !== '/api/auth/login') {
      throw fail(404, 'NOT_FOUND', 'Không tìm thấy chức năng.');
    }
    rate('auth:' + req.socket.remoteAddress, 30, 15 * 60000);
    const data = await body(req);
    const email = typeof data.email === 'string' ? data.email.trim().toLowerCase() : '';
    const password = typeof data.password === 'string' ? data.password : '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200 || password.length < 8 || password.length > 128) {
      throw fail(422, 'INVALID_LOGIN', 'Nhập email hợp lệ và mật khẩu từ 8 đến 128 ký tự.');
    }
    let user = get('SELECT * FROM accounts WHERE email=?', email);
    if (p.endsWith('/register')) {
      const name = typeof data.name === 'string' ? data.name.trim() : '';
      if (name.length < 2 || name.length > 60) throw fail(422, 'INVALID_NAME', 'Tên cần từ 2 đến 60 ký tự.');
      if (user) throw fail(409, 'EMAIL_EXISTS', 'Email này đã được sử dụng.');
      user = { id: uuid(), email, name, role: 'member', password: await hashPassword(password) };
      if (get('SELECT id FROM accounts WHERE email=?', email)) throw fail(409, 'EMAIL_EXISTS', 'Email này đã được sử dụng.');
      run('INSERT INTO accounts VALUES (?,?,?,?,?)', user.id, email, name, user.password, user.role);
    } else if (!(await checkPassword(password, user?.password)) || (!demo && user?.role === 'admin')) {
      throw fail(401, 'INVALID_LOGIN', 'Email hoặc mật khẩu chưa đúng.');
    }
    const next = startSession(res, user);
    mergeSession(s, next);
    run('DELETE FROM sessions WHERE token=?', digest(s.token));
    json(res, payload(next), p.endsWith('/register') ? 201 : 200);
    return true;
  }

  if (p === '/api/profile' && m === 'GET') {
    json(res, { profile: state().profile, profileVersion: state().profileVersion });
    return true;
  }

  if (p === '/api/profile' && m === 'PUT') {
    const d = await body(req), old = state(), profile = {};
    for (const [k, [label, min, max]] of Object.entries(measurements)) {
      if (!Number.isInteger(d[k]) || d[k] < min || d[k] > max) {
        throw fail(422, 'INVALID_PROFILE', `${label} phải nằm trong khoảng ${min}–${max}.`);
      }
      profile[k] = d[k];
    }
    if (!Number.isInteger(d.tone) || d.tone < 0 || d.tone > 5) {
      throw fail(422, 'INVALID_PROFILE', 'Tông da không hợp lệ.');
    }
    Object.assign(profile, {
      tone: d.tone,
      style: Object.hasOwn(styles, d.style) ? d.style : '',
      faceShape: Object.hasOwn(faceShapes, d.faceShape) ? d.faceShape : '',
    });
    const changed = [...Object.keys(measurements), 'tone'].some(k => profile[k] !== old.profile?.[k]);
    store.put(s.owner, { ...old, profile, profileVersion: old.profileVersion + Number(changed) });
    json(res, payload(s));
    return true;
  }

  if (p === '/api/admin/overview' && m === 'GET') {
    if (s.user?.role !== 'admin' || !demo) throw fail(403, 'FORBIDDEN', 'Trang này dành cho quản trị demo.');
    json(res, {
      products: byId.size,
      accounts: get('SELECT count(*) AS n FROM accounts').n,
      jobs: get('SELECT count(*) AS n FROM jobs WHERE expires>?', now()).n,
      settings: providerSettings(),
    });
    return true;
  }

  return false;
}

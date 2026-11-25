import { fail } from '../platform/store.mjs';

/**
 * Service 04: Media & Async Try-On Jobs (Nguyễn Phúc Thành)
 */
export async function handleMediaJobsRoutes(ctx) {
  const { req, res, m, p, s, jobs, body, json, rate, payload } = ctx;

  if (p === '/api/media' && m === 'POST') {
    rate('media:' + s.owner, 12, 60000);
    json(res, await jobs.upload(s.owner, await body(req, 7_000_000)), 201);
    return true;
  }

  if (p.startsWith('/api/media/')) {
    const id = p.split('/').at(-1);
    if (m === 'DELETE') {
      jobs.remove(s.owner, id);
      json(res, payload(s));
      return true;
    }
    if (m === 'GET') {
      const image = jobs.readMedia(s.owner, id);
      if (!image) throw fail(404, 'NOT_FOUND', 'Không tìm thấy ảnh.');
      res.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'private, no-store' });
      res.end(Buffer.isBuffer(image.data) ? image.data : Buffer.from(image.data));
      return true;
    }
  }

  if (m === 'POST' && ['/api/avatars', '/api/try-ons'].includes(p)) {
    rate('job:' + s.owner, 35, 60000);
    json(res, jobs.create(s.owner, p === '/api/avatars' ? 'avatar' : 'try-on', await body(req)), 202);
    return true;
  }

  if (p.startsWith('/api/jobs/') && m === 'GET') {
    const row = jobs.job(s.owner, p.split('/').at(-1));
    if (!row) throw fail(404, 'NOT_FOUND', 'Không tìm thấy tác vụ.');
    json(res, jobs.view(row));
    return true;
  }

  if (p === '/api/try-ons' && m === 'GET') {
    json(res, { items: jobs.history(s.owner) });
    return true;
  }

  if (p.startsWith('/api/try-ons/') && m === 'PATCH') {
    json(res, jobs.save(s.owner, p.split('/').at(-1), s.user));
    return true;
  }

  return false;
}

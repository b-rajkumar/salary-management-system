import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { buildApp } from '../src/app';

const FIXTURE_MARKER = '<!-- spa-fixture -->';

describe('SPA serving in buildApp', () => {
  let frontendDist: string;
  let app: ReturnType<typeof buildApp>['app'];

  beforeAll(() => {
    frontendDist = fs.mkdtempSync(path.join(os.tmpdir(), 'spa-fixture-'));
    fs.writeFileSync(
      path.join(frontendDist, 'index.html'),
      `<!doctype html><html><body>${FIXTURE_MARKER}</body></html>`,
    );

    ({ app } = buildApp(':memory:', frontendDist));
  });

  afterAll(() => {
    fs.rmSync(frontendDist, { recursive: true, force: true });
  });

  test('GET / returns the SPA index.html', async () => {
    const res = await request(app).get('/');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/html/);
    expect(res.text).toContain(FIXTURE_MARKER);
  });

  test('GET /some/deep/spa/route falls back to index.html', async () => {
    const res = await request(app).get('/employees/42/edit');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/html/);
    expect(res.text).toContain(FIXTURE_MARKER);
  });

  test('GET /api/unknown returns a JSON error, not HTML', async () => {
    const res = await request(app).get('/api/unknown-route');

    expect(res.status).toBe(404);
    expect(res.headers['content-type']).toMatch(/json/);
    expect(res.text).not.toContain(FIXTURE_MARKER);
  });

  test('GET /api/health returns JSON (regression: API still takes precedence)', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});

describe('buildApp without a frontendDist', () => {
  test('GET / returns 404 — no SPA wiring when frontendDist omitted', async () => {
    const { app } = buildApp(':memory:');

    const res = await request(app).get('/');

    expect(res.status).toBe(404);
  });
});

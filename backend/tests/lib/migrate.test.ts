import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import Database from 'better-sqlite3';
import { migrate } from '../../src/lib/migrate';

describe('migrate', () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mig-'));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  test('applies sql files in lexical order and records them', () => {
    fs.writeFileSync(path.join(dir, '001_a.sql'), 'CREATE TABLE a (id INTEGER PRIMARY KEY);');
    fs.writeFileSync(path.join(dir, '002_b.sql'), 'CREATE TABLE b (id INTEGER PRIMARY KEY);');
    const db = new Database(':memory:');

    migrate(db, dir);

    const tables = db
      .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`)
      .all() as { name: string }[];
    expect(tables.map((t) => t.name)).toEqual(['_migrations', 'a', 'b']);

    const applied = db.prepare(`SELECT name FROM _migrations ORDER BY name`).all() as { name: string }[];
    expect(applied.map((r) => r.name)).toEqual(['001_a.sql', '002_b.sql']);
  });

  test('is idempotent — a second run is a no-op', () => {
    fs.writeFileSync(path.join(dir, '001_a.sql'), 'CREATE TABLE a (id INTEGER PRIMARY KEY);');
    const db = new Database(':memory:');
    migrate(db, dir);
    expect(() => migrate(db, dir)).not.toThrow();
    const count = db.prepare(`SELECT COUNT(*) AS n FROM _migrations`).get() as { n: number };
    expect(count.n).toBe(1);
  });
});

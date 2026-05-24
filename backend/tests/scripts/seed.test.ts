import path from 'node:path';
import Database from 'better-sqlite3';
import { COUNTRIES } from '@app/shared';
import { migrate } from '../../src/lib/migrate';
import { seed } from '../../scripts/seed';

const MIGRATIONS_DIR = path.join(__dirname, '..', '..', 'migrations');

function freshDb(): Database.Database {
  const db = new Database(':memory:');

  migrate(db, MIGRATIONS_DIR);

  return db;
}

describe('seed', () => {
  test('inserts exactly the requested count', () => {
    const db = freshDb();

    const result = seed({ db, count: 100 });

    const { n } = db.prepare('SELECT COUNT(*) AS n FROM employees').get() as { n: number };

    expect(n).toBe(100);
    expect(result.inserted).toBe(100);
    expect(typeof result.ms).toBe('number');
  });

  test('every inserted row has a unique email', () => {
    const db = freshDb();

    seed({ db, count: 100 });

    const rows = db
      .prepare('SELECT email FROM employees')
      .all() as { email: string }[];
    const unique = new Set(rows.map((r) => r.email));

    expect(unique.size).toBe(100);
  });

  test('every inserted row has a country that is a key of COUNTRIES', () => {
    const db = freshDb();

    seed({ db, count: 100 });

    const rows = db
      .prepare('SELECT country FROM employees')
      .all() as { country: string }[];
    const allowed = new Set(Object.keys(COUNTRIES));

    for (const r of rows) {
      expect(allowed.has(r.country)).toBe(true);
    }
  });

  test('every inserted salary is a positive integer', () => {
    const db = freshDb();

    seed({ db, count: 100 });

    const rows = db
      .prepare('SELECT salary FROM employees')
      .all() as { salary: number }[];

    for (const r of rows) {
      expect(Number.isInteger(r.salary)).toBe(true);
      expect(r.salary).toBeGreaterThanOrEqual(1);
    }
  });

  test('reset: true removes pre-existing rows before inserting', () => {
    const db = freshDb();

    seed({ db, count: 50 });
    seed({ db, count: 30, reset: true });

    const { n } = db.prepare('SELECT COUNT(*) AS n FROM employees').get() as { n: number };

    expect(n).toBe(30);
  });
});

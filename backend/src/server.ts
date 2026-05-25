import fs from 'node:fs';
import path from 'node:path';
import { buildApp } from './app';
import { seed } from './lib/seed';

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const FRONTEND_DIST = path.join(__dirname, '..', '..', 'frontend', 'dist');

const dbPath = process.env.DATABASE_PATH ?? path.join(process.cwd(), 'data', 'app.db');
const port = parseInt(process.env.PORT ?? '3000', 10);

fs.mkdirSync(path.dirname(dbPath), { recursive: true });

function readNames(file: string): string[] {
  return fs.readFileSync(file, 'utf-8').split('\n').map((s) => s.trim()).filter(Boolean);
}

const { app, db } = buildApp(dbPath, FRONTEND_DIST);

if (process.env.SEED_ON_EMPTY === '1') {
  const row = db.sqlite.prepare('SELECT COUNT(*) AS count FROM employees').get() as { count: number };

  if (row.count === 0) {
    const firstNames = readNames(path.join(DATA_DIR, 'first_names.txt'));
    const lastNames = readNames(path.join(DATA_DIR, 'last_names.txt'));

    const result = seed({ db: db.sqlite, count: 10_000, firstNames, lastNames });

    console.log(`Seeded ${result.inserted} employees in ${result.ms}ms`);
  }
}

app.listen(port, () => {
  console.log(`Listening on :${port}`);
});

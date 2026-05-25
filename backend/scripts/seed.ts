import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { migrate } from '../src/lib/migrate';
import { seed } from '../src/lib/seed';

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');
const DEFAULT_DB_PATH = process.env.DATABASE_PATH ?? path.join(__dirname, '..', 'data', 'app.db');

function readNames(file: string): string[] {
  const raw = fs.readFileSync(file, 'utf-8');

  return raw.split('\n').map((s) => s.trim()).filter(Boolean);
}

const reset = process.argv.includes('--reset');
const db = new Database(DEFAULT_DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');

migrate(db, MIGRATIONS_DIR);

const firstNames = readNames(path.join(DATA_DIR, 'first_names.txt'));
const lastNames = readNames(path.join(DATA_DIR, 'last_names.txt'));

const result = seed({ db, count: 10_000, reset, firstNames, lastNames });

console.log(`Inserted ${result.inserted} employees in ${result.ms}ms`);

db.close();

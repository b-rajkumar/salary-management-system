import Database from 'better-sqlite3';
import { Kysely, SqliteDialect } from 'kysely';
import type { DB } from './types';

export interface DbHandle {
  sqlite: Database.Database;
  kysely: Kysely<DB>;
}

export function createDb(dbPath: string): DbHandle {
  const sqlite = new Database(dbPath);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  const kysely = new Kysely<DB>({ dialect: new SqliteDialect({ database: sqlite }) });
  return { sqlite, kysely };
}

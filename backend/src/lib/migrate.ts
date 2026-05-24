import fs from 'node:fs';
import path from 'node:path';
import type Database from 'better-sqlite3';

export function migrate(db: Database.Database, migrationsDir: string): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name      TEXT PRIMARY KEY,
      appliedAt TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
    )
  `);

  const applied = new Set(
    (db.prepare(`SELECT name FROM _migrations`).all() as { name: string }[]).map((r) => r.name),
  );

  const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();

  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
    const record = db.prepare(`INSERT INTO _migrations (name) VALUES (?)`);

    db.transaction(() => {
      db.exec(sql);
      record.run(file);
    })();
  }
}

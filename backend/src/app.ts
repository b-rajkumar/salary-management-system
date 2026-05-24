import express, { type Express } from 'express';
import path from 'node:path';
import { createDb, type DbHandle } from './db/client';
import { migrate } from './lib/migrate';
import { errorMiddleware } from './lib/errorMiddleware';
import { EmployeesRepository } from './repositories/EmployeesRepository';
import { EmployeesService } from './services/EmployeesService';
import { EmployeesController } from './controllers/EmployeesController';
import { employeesRouter } from './routes/employees';

const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');

export function buildApp(dbPath: string): { app: Express; db: DbHandle } {
  const db = createDb(dbPath);
  migrate(db.sqlite, MIGRATIONS_DIR);

  const employees = new EmployeesController(
    new EmployeesService(new EmployeesRepository(db.kysely)),
  );

  const app = express();
  app.use(express.json());
  app.get('/api/health', (_req, res) => {
    res.status(200).json({ ok: true });
  });
  app.use('/api/employees', employeesRouter(employees));
  app.use(errorMiddleware);

  return { app, db };
}

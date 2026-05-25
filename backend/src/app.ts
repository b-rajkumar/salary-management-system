import express, { type Express } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { createDb, type DbHandle } from './db/client';
import { migrate } from './lib/migrate';
import { errorMiddleware } from './lib/errorMiddleware';
import { NotFoundError } from './lib/errors';
import { EmployeesRepository } from './repositories/EmployeesRepository';
import { EmployeesService } from './services/EmployeesService';
import { EmployeesController } from './controllers/EmployeesController';
import { employeesRouter } from './routes/employees';
import { InsightsRepository } from './repositories/InsightsRepository';
import { InsightsService } from './services/InsightsService';
import { InsightsController } from './controllers/InsightsController';
import { insightsRouter } from './routes/insights';

const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');

export function buildApp(dbPath: string, frontendDist?: string): { app: Express; db: DbHandle } {
  const db = createDb(dbPath);

  migrate(db.sqlite, MIGRATIONS_DIR);

  const employees = new EmployeesController(
    new EmployeesService(new EmployeesRepository(db.kysely)),
  );
  const insights = new InsightsController(
    new InsightsService(new InsightsRepository(db.kysely)),
  );

  const app = express();

  app.use(express.json());
  app.get('/api/health', (_req, res) => {
    res.status(200).json({ ok: true });
  });
  app.use('/api/employees', employeesRouter(employees));
  app.use('/api/insights', insightsRouter(insights));

  app.use('/api', (_req, _res, next) => {
    next(new NotFoundError('NOT_FOUND', 'Route not found'));
  });

  if (frontendDist && fs.existsSync(frontendDist)) {
    app.use(express.static(frontendDist));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(frontendDist, 'index.html'));
    });
  }

  app.use(errorMiddleware);

  return { app, db };
}

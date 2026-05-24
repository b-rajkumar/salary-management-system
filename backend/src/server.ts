import express from 'express';
import path from 'node:path';
import { createDb } from './db/client';
import { migrate } from './lib/migrate';
import { errorMiddleware } from './lib/errorMiddleware';
import { EmployeesRepository } from './repositories/EmployeesRepository';
import { EmployeesService } from './services/EmployeesService';
import { EmployeesController } from './controllers/EmployeesController';
import { buildRouter } from './routes';

export function buildApp(dbPath: string) {
  const { sqlite, kysely } = createDb(dbPath);
  migrate(sqlite, path.join(__dirname, '..', 'migrations'));

  const repo = new EmployeesRepository(kysely);
  const service = new EmployeesService(repo);
  const controller = new EmployeesController(service);

  const app = express();
  app.use(express.json());
  app.use('/api', buildRouter({ employees: controller }));
  app.use(errorMiddleware);
  return { app, sqlite };
}

if (require.main === module) {
  const dbPath = process.env.DATABASE_PATH ?? path.join(process.cwd(), 'data', 'app.db');
  const { app } = buildApp(dbPath);
  const port = parseInt(process.env.PORT ?? '3000', 10);
  app.listen(port, () => console.log(`Listening on :${port}`));
}

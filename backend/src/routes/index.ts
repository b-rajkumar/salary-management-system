import { Router } from 'express';
import type { EmployeesController } from '../controllers/EmployeesController';

export function buildRouter(controllers: { employees: EmployeesController }): Router {
  const r = Router();
  r.get('/health', (_req, res) => res.status(200).json({ ok: true }));
  r.post('/employees', (req, res, next) => {
    controllers.employees.create(req, res).catch(next);
  });
  return r;
}

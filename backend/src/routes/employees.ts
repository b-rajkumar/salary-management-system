import { Router } from 'express';
import type { EmployeesController } from '../controllers/EmployeesController';

export function employeesRouter(controller: EmployeesController): Router {
  const r = Router();

  r.post('/', (req, res, next) => {
    controller.create(req, res).catch(next);
  });

  return r;
}

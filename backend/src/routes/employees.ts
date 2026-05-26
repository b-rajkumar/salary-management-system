import { Router } from 'express';
import type { EmployeesController } from '../controllers/EmployeesController';

export function employeesRouter(controller: EmployeesController): Router {
  const r = Router();

  r.get('/', (req, res, next) => {
    controller.list(req, res).catch(next);
  });

  r.post('/', (req, res, next) => {
    controller.create(req, res).catch(next);
  });

  r.post('/bulk', (req, res, next) => {
    controller.createBulk(req, res).catch(next);
  });

  r.put('/:id', (req, res, next) => {
    controller.update(req, res).catch(next);
  });

  r.delete('/:id', (req, res, next) => {
    controller.remove(req, res).catch(next);
  });

  return r;
}

import { Router } from 'express';
import type { InsightsController } from '../controllers/InsightsController';

export function insightsRouter(controller: InsightsController): Router {
  const r = Router();

  r.get('/country/:country', (req, res, next) => {
    controller.byCountry(req, res).catch(next);
  });

  return r;
}

import { Router } from 'express';
import type { InsightsController } from '../controllers/InsightsController';

export function insightsRouter(controller: InsightsController): Router {
  const r = Router();

  r.get('/country/:country', (req, res, next) => {
    controller.byCountry(req, res).catch(next);
  });

  r.get('/country/:country/job-titles', (req, res, next) => {
    controller.jobTitles(req, res).catch(next);
  });

  r.get('/country/:country/job-title', (req, res, next) => {
    controller.byCountryAndRole(req, res).catch(next);
  });

  return r;
}

import type { Request, Response } from 'express';
import { z } from 'zod';
import { COUNTRIES } from '@app/shared';
import { ValidationError } from '../lib/errors';
import type { InsightsService } from '../services/InsightsService';

const COUNTRY_CODES = Object.keys(COUNTRIES) as [string, ...string[]];

const paramsSchema = z.object({
  country: z.enum(COUNTRY_CODES),
});

const roleQuerySchema = z.object({
  title: z.string().trim().min(1),
});

export class InsightsController {
  constructor(private readonly service: InsightsService) {}

  async byCountry(req: Request, res: Response): Promise<void> {
    const parsed = paramsSchema.safeParse(req.params);

    if (!parsed.success) {
      throw new ValidationError(parsed.error.flatten());
    }

    const result = await this.service.byCountry(parsed.data.country);

    res.status(200).json(result);
  }

  async jobTitles(req: Request, res: Response): Promise<void> {
    const parsed = paramsSchema.safeParse(req.params);

    if (!parsed.success) {
      throw new ValidationError(parsed.error.flatten());
    }

    const titles = await this.service.jobTitlesByCountry(parsed.data.country);

    res.status(200).json(titles);
  }

  async byCountryAndRole(req: Request, res: Response): Promise<void> {
    const parsedParams = paramsSchema.safeParse(req.params);

    if (!parsedParams.success) {
      throw new ValidationError(parsedParams.error.flatten());
    }

    const parsedQuery = roleQuerySchema.safeParse(req.query);

    if (!parsedQuery.success) {
      throw new ValidationError(parsedQuery.error.flatten());
    }

    const result = await this.service.byCountryAndRole(
      parsedParams.data.country,
      parsedQuery.data.title,
    );

    res.status(200).json(result);
  }
}

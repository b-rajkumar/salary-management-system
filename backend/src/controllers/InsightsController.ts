import type { Request, Response } from 'express';
import { z } from 'zod';
import { COUNTRIES } from '@app/shared';
import { ValidationError } from '../lib/errors';
import type { InsightsService } from '../services/InsightsService';

const COUNTRY_CODES = Object.keys(COUNTRIES) as [string, ...string[]];

const paramsSchema = z.object({
  country: z.enum(COUNTRY_CODES),
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
}

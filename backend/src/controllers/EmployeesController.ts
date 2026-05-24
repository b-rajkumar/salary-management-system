import type { Request, Response } from 'express';
import { z } from 'zod';
import { employeeCreateSchema } from '@app/shared';
import { ValidationError } from '../lib/errors';
import type { EmployeesService } from '../services/EmployeesService';

const listQuerySchema = z.object({
  page:     z.coerce.number().int().min(0).default(0),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
  q:        z.string().trim().max(100).optional().transform((v) => (v === '' ? undefined : v)),
});

const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export class EmployeesController {
  constructor(private readonly service: EmployeesService) {}

  async create(req: Request, res: Response): Promise<void> {
    const parsed = employeeCreateSchema.safeParse(req.body);

    if (!parsed.success) {
      throw new ValidationError(parsed.error.flatten());
    }

    const employee = await this.service.create(parsed.data);

    res.status(201).json(employee);
  }

  async list(req: Request, res: Response): Promise<void> {
    const parsed = listQuerySchema.safeParse(req.query);

    if (!parsed.success) {
      throw new ValidationError(parsed.error.flatten());
    }

    const result = await this.service.list(parsed.data);

    res.status(200).json(result);
  }

  async update(req: Request, res: Response): Promise<void> {
    const parsedParams = idParamSchema.safeParse(req.params);

    if (!parsedParams.success) {
      throw new ValidationError(parsedParams.error.flatten());
    }

    const parsedBody = employeeCreateSchema.safeParse(req.body);

    if (!parsedBody.success) {
      throw new ValidationError(parsedBody.error.flatten());
    }

    const employee = await this.service.update(parsedParams.data.id, parsedBody.data);

    res.status(200).json(employee);
  }
}

import type { Request, Response } from 'express';
import { employeeCreateSchema } from '@app/shared';
import { ValidationError } from '../lib/errors';
import type { EmployeesService } from '../services/EmployeesService';

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
}

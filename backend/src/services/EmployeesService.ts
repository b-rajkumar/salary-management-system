import type { EmployeesRepository } from '../repositories/EmployeesRepository';
import { NotFoundError } from '../lib/errors';
import type { Employee, EmployeeCreateInput, EmployeesListResponse } from '@app/shared';

export class EmployeesService {
  constructor(private readonly repo: EmployeesRepository) {}

  create(input: EmployeeCreateInput): Promise<Employee> {
    return this.repo.insert(input);
  }

  list(args: { page: number; pageSize: number; q?: string }): Promise<EmployeesListResponse> {
    return this.repo.list(args);
  }

  async update(id: number, input: EmployeeCreateInput): Promise<Employee> {
    const row = await this.repo.update(id, input);

    if (!row) {
      throw new NotFoundError('EMPLOYEE_NOT_FOUND', `Employee ${id} not found`);
    }

    return row;
  }
}

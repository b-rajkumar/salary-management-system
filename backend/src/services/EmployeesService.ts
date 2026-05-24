import type { EmployeesRepository } from '../repositories/EmployeesRepository';
import type { Employee, EmployeeCreateInput, EmployeesListResponse } from '@app/shared';

export class EmployeesService {
  constructor(private readonly repo: EmployeesRepository) {}

  create(input: EmployeeCreateInput): Promise<Employee> {
    return this.repo.insert(input);
  }

  list(args: { page: number; pageSize: number; q?: string }): Promise<EmployeesListResponse> {
    return this.repo.list(args);
  }
}

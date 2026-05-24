import type { EmployeesRepository } from '../repositories/EmployeesRepository';
import type { Employee, EmployeeCreateInput } from '@app/shared';

export class EmployeesService {
  constructor(private readonly repo: EmployeesRepository) {}

  create(input: EmployeeCreateInput): Promise<Employee> {
    return this.repo.insert(input);
  }
}

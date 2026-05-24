import type { Employee, EmployeeCreateInput } from '@app/shared';
import { request } from './client';

export function createEmployee(input: EmployeeCreateInput): Promise<Employee> {
  return request<Employee>('/api/employees', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

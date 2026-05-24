import type { Employee, EmployeeCreateInput, EmployeesListResponse } from '@app/shared';
import { request } from './client';

export function createEmployee(input: EmployeeCreateInput): Promise<Employee> {
  return request<Employee>('/api/employees', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function listEmployees(params: {
  page: number;
  pageSize: number;
}): Promise<EmployeesListResponse> {
  const qs = new URLSearchParams({
    page: String(params.page),
    pageSize: String(params.pageSize),
  });

  return request<EmployeesListResponse>(`/api/employees?${qs.toString()}`);
}

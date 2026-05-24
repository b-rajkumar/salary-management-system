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
  q?: string;
}): Promise<EmployeesListResponse> {
  const qs = new URLSearchParams({
    page: String(params.page),
    pageSize: String(params.pageSize),
  });

  if (params.q && params.q.length > 0) {
    qs.set('q', params.q);
  }

  return request<EmployeesListResponse>(`/api/employees?${qs.toString()}`);
}

import type { EmployeeCreateInput } from './schemas';

export interface Employee {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  jobTitle: string;
  department: string;
  country: string;
  salary: number;
  hireDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface EmployeesListResponse {
  rows: Employee[];
  total: number;
}

export type EmployeeUpdateInput = EmployeeCreateInput;

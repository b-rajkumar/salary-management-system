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

export interface CountryInsightsResponse {
  country: string;
  currency: string;
  count: number;
  salary: {
    min: number;
    max: number;
    avg: number;
  };
  tenure: {
    avgYears: number;
    newHiresLast12Months: number;
  };
  departments: Array<{
    department: string;
    headcount: number;
    avgSalary: number;
  }>;
}

export interface RoleInsightsResponse {
  country: string;
  jobTitle: string;
  currency: string;
  count: number;
  salary: {
    min: number;
    max: number;
    avg: number;
  };
  tenure: {
    avgYears: number;
    newHiresLast12Months: number;
  };
}

export interface BulkCreateEmployeesRequest {
  employees: EmployeeCreateInput[];
}

export interface BulkCreateEmployeesResponse {
  inserted: number;
}

export interface BulkErrorItem {
  index: number;
  field: string;
  message: string;
}

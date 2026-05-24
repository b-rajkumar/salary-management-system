import type { Generated } from 'kysely';

export interface EmployeesTable {
  id:         Generated<number>;
  firstName:  string;
  lastName:   string;
  email:      string;
  jobTitle:   string;
  department: string;
  country:    string;
  salary:     number;
  hireDate:   string;
  createdAt:  Generated<string>;
  updatedAt:  Generated<string>;
}

export interface DB {
  employees: EmployeesTable;
}

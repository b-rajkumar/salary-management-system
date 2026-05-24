import { z } from 'zod';
import { COUNTRIES } from './countries';

const countryCodes = Object.keys(COUNTRIES) as [string, ...string[]];

const todayISO = (): string => new Date().toISOString().slice(0, 10);

export const employeeCreateSchema = z.object({
  firstName:  z.string().trim().min(1, 'Required').max(100),
  lastName:   z.string().trim().min(1, 'Required').max(100),
  email:      z.string().trim().email('Must be a valid email').max(254),
  jobTitle:   z.string().trim().min(1, 'Required').max(100),
  department: z.string().trim().min(1, 'Required').max(100),
  country:    z.enum(countryCodes, { errorMap: () => ({ message: 'Select a country' }) }),
  salary:     z.number({ invalid_type_error: 'Required' }).int('Whole numbers only').min(1, 'Must be at least 1'),
  hireDate:   z
    .string()
    .min(1, 'Required')
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
    .refine((d) => d <= todayISO(), { message: 'Hire date cannot be in the future' }),
});

export type EmployeeCreateInput = z.infer<typeof employeeCreateSchema>;

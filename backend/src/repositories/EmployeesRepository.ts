import type { Kysely } from 'kysely';
import type { DB } from '../db/types';
import { ConflictError } from '../lib/errors';
import type { Employee, EmployeeCreateInput } from '@app/shared';

const isUniqueEmailViolation = (err: unknown): boolean =>
  err instanceof Error && /UNIQUE constraint failed: employees\.email/i.test(err.message);

export class EmployeesRepository {
  constructor(private readonly db: Kysely<DB>) {}

  async insert(input: EmployeeCreateInput): Promise<Employee> {
    try {
      return await this.db
        .insertInto('employees')
        .values(input)
        .returningAll()
        .executeTakeFirstOrThrow();
    } catch (err) {
      if (isUniqueEmailViolation(err)) {
        throw new ConflictError('EMAIL_TAKEN', 'Email already in use');
      }
      throw err;
    }
  }
}

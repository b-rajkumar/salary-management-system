import { sql, type Kysely, type ExpressionBuilder } from 'kysely';
import type { DB } from '../db/types';
import { ConflictError } from '../lib/errors';
import {
  COUNTRIES,
  type Employee,
  type EmployeeCreateInput,
  type EmployeesListResponse,
} from '@app/shared';

const isUniqueEmailViolation = (err: unknown): boolean =>
  err instanceof Error && /UNIQUE constraint failed: employees\.email/i.test(err.message);

function countryCodesMatching(qLower: string): string[] {
  return Object.entries(COUNTRIES)
    .filter(([, entry]) => entry.name.toLowerCase().includes(qLower))
    .map(([code]) => code);
}

function searchPredicate(eb: ExpressionBuilder<DB, 'employees'>, q: string) {
  const qLower = q.toLowerCase();
  const pattern = `%${qLower}%`;
  const codeMatches = countryCodesMatching(qLower);

  const textColumnLikes = (
    ['firstName', 'lastName', 'email', 'jobTitle', 'department', 'country'] as const
  ).map((col) => eb(sql<string>`LOWER(${sql.ref(col)})`, 'like', pattern));

  return eb.or([
    ...textColumnLikes,
    ...(codeMatches.length > 0 ? [eb('country', 'in', codeMatches)] : []),
  ]);
}

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

  async list(args: { page: number; pageSize: number; q?: string }): Promise<EmployeesListResponse> {
    const q = args.q?.trim();

    let rowsQuery = this.db.selectFrom('employees').selectAll();
    let countQuery = this.db.selectFrom('employees').select(sql<number>`count(*)`.as('total'));

    if (q) {
      rowsQuery = rowsQuery.where((eb) => searchPredicate(eb, q));
      countQuery = countQuery.where((eb) => searchPredicate(eb, q));
    }

    const rows = await rowsQuery
      .orderBy('id', 'desc')
      .limit(args.pageSize)
      .offset(args.page * args.pageSize)
      .execute();

    const countRow = await countQuery.executeTakeFirstOrThrow();

    return { rows, total: Number(countRow.total) };
  }

  async update(id: number, input: EmployeeCreateInput): Promise<Employee | null> {
    const updatedAt = new Date().toISOString();

    try {
      const row = await this.db
        .updateTable('employees')
        .set({ ...input, updatedAt })
        .where('id', '=', id)
        .returningAll()
        .executeTakeFirst();

      return row ?? null;
    } catch (err) {
      if (isUniqueEmailViolation(err)) {
        throw new ConflictError('EMAIL_TAKEN', 'Email already in use');
      }
      throw err;
    }
  }
}

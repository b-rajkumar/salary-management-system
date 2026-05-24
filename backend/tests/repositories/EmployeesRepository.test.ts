import path from 'node:path';
import Database from 'better-sqlite3';
import { Kysely, SqliteDialect } from 'kysely';
import { migrate } from '../../src/lib/migrate';
import { EmployeesRepository } from '../../src/repositories/EmployeesRepository';
import { ConflictError } from '../../src/lib/errors';
import type { DB } from '../../src/db/types';

function setup(): EmployeesRepository {
  const sqlite = new Database(':memory:');
  migrate(sqlite, path.join(__dirname, '..', '..', 'migrations'));
  const kysely = new Kysely<DB>({ dialect: new SqliteDialect({ database: sqlite }) });
  return new EmployeesRepository(kysely);
}

const validInput = {
  firstName: 'Asha',
  lastName: 'Rao',
  email: 'asha@example.com',
  jobTitle: 'Software Engineer',
  department: 'Engineering',
  country: 'IN',
  salary: 1500000,
  hireDate: '2024-01-15',
};

describe('EmployeesRepository', () => {
  test('insert returns the persisted row with id and timestamps', async () => {
    const repo = setup();
    const created = await repo.insert(validInput);
    expect(created).toMatchObject(validInput);
    expect(created.id).toEqual(expect.any(Number));
    expect(typeof created.createdAt).toBe('string');
    expect(typeof created.updatedAt).toBe('string');
  });

  test('insert with a duplicate email throws ConflictError("EMAIL_TAKEN")', async () => {
    const repo = setup();
    await repo.insert(validInput);
    await expect(repo.insert(validInput)).rejects.toMatchObject({
      constructor: ConflictError,
      code: 'EMAIL_TAKEN',
    });
  });
});

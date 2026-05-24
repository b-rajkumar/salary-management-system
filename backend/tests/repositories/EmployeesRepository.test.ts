import path from 'node:path';
import Database from 'better-sqlite3';
import { Kysely, SqliteDialect } from 'kysely';
import { migrate } from '../../src/lib/migrate';
import { EmployeesRepository } from '../../src/repositories/EmployeesRepository';
import { ConflictError } from '../../src/lib/errors';
import type { DB } from '../../src/db/types';

const input = {
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
  let repo: EmployeesRepository;

  beforeEach(() => {
    const sqlite = new Database(':memory:');
    migrate(sqlite, path.join(__dirname, '..', '..', 'migrations'));
    const kysely = new Kysely<DB>({ dialect: new SqliteDialect({ database: sqlite }) });
    repo = new EmployeesRepository(kysely);
  });

  test('insert returns the persisted row with id and timestamps', async () => {
    const created = await repo.insert(input);
    expect(created).toMatchObject(input);
    expect(created.id).toEqual(expect.any(Number));
    expect(typeof created.createdAt).toBe('string');
    expect(typeof created.updatedAt).toBe('string');
  });

  test('insert with a duplicate email throws ConflictError("EMAIL_TAKEN")', async () => {
    await repo.insert(input);
    await expect(repo.insert(input)).rejects.toMatchObject({
      constructor: ConflictError,
      code: 'EMAIL_TAKEN',
    });
  });
});

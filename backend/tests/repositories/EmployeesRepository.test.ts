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

  describe('list', () => {
    test('returns { rows: [], total: 0 } for an empty table', async () => {
      const result = await repo.list({ page: 0, pageSize: 25 });

      expect(result).toEqual({ rows: [], total: 0 });
    });

    test('returns the first page and the correct total when total > pageSize', async () => {
      for (let i = 0; i < 60; i++) {
        await repo.insert({ ...input, email: `emp${i}@example.com` });
      }

      const result = await repo.list({ page: 0, pageSize: 25 });

      expect(result.rows).toHaveLength(25);
      expect(result.total).toBe(60);
      expect(result.rows[0].email).toBe('emp0@example.com');
      expect(result.rows[24].email).toBe('emp24@example.com');
    });

    test('returns the requested middle page', async () => {
      for (let i = 0; i < 60; i++) {
        await repo.insert({ ...input, email: `emp${i}@example.com` });
      }

      const result = await repo.list({ page: 1, pageSize: 25 });

      expect(result.rows).toHaveLength(25);
      expect(result.total).toBe(60);
      expect(result.rows[0].email).toBe('emp25@example.com');
      expect(result.rows[24].email).toBe('emp49@example.com');
    });

    test('returns a partial last page', async () => {
      for (let i = 0; i < 60; i++) {
        await repo.insert({ ...input, email: `emp${i}@example.com` });
      }

      const result = await repo.list({ page: 2, pageSize: 25 });

      expect(result.rows).toHaveLength(10);
      expect(result.total).toBe(60);
      expect(result.rows[0].email).toBe('emp50@example.com');
      expect(result.rows[9].email).toBe('emp59@example.com');
    });

    test('orders by id ascending — pages do not overlap', async () => {
      for (let i = 0; i < 30; i++) {
        await repo.insert({ ...input, email: `emp${i}@example.com` });
      }

      const page0 = await repo.list({ page: 0, pageSize: 10 });
      const page1 = await repo.list({ page: 1, pageSize: 10 });
      const page2 = await repo.list({ page: 2, pageSize: 10 });

      const ids = [...page0.rows, ...page1.rows, ...page2.rows].map((r) => r.id);
      expect(ids).toEqual([...ids].sort((a, b) => a - b));
      expect(new Set(ids).size).toBe(30);
    });
  });
});

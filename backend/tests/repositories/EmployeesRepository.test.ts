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

    test('returns the first page (newest first) and the correct total when total > pageSize', async () => {
      for (let i = 0; i < 60; i++) {
        await repo.insert({ ...input, email: `emp${i}@example.com` });
      }

      const result = await repo.list({ page: 0, pageSize: 25 });

      expect(result.rows).toHaveLength(25);
      expect(result.total).toBe(60);
      expect(result.rows[0].email).toBe('emp59@example.com');
      expect(result.rows[24].email).toBe('emp35@example.com');
    });

    test('returns the requested middle page', async () => {
      for (let i = 0; i < 60; i++) {
        await repo.insert({ ...input, email: `emp${i}@example.com` });
      }

      const result = await repo.list({ page: 1, pageSize: 25 });

      expect(result.rows).toHaveLength(25);
      expect(result.total).toBe(60);
      expect(result.rows[0].email).toBe('emp34@example.com');
      expect(result.rows[24].email).toBe('emp10@example.com');
    });

    test('returns a partial last page', async () => {
      for (let i = 0; i < 60; i++) {
        await repo.insert({ ...input, email: `emp${i}@example.com` });
      }

      const result = await repo.list({ page: 2, pageSize: 25 });

      expect(result.rows).toHaveLength(10);
      expect(result.total).toBe(60);
      expect(result.rows[0].email).toBe('emp9@example.com');
      expect(result.rows[9].email).toBe('emp0@example.com');
    });

    describe('search (q)', () => {
      beforeEach(async () => {
        await repo.insert({
          firstName: 'Asha', lastName: 'Rao', email: 'asha.rao@example.com',
          jobTitle: 'Software Engineer', department: 'Engineering', country: 'IN',
          salary: 1500000, hireDate: '2024-01-15',
        });
        await repo.insert({
          firstName: 'Bob', lastName: 'Smith', email: 'bob.smith@example.com',
          jobTitle: 'Designer', department: 'Design', country: 'US',
          salary: 120000, hireDate: '2023-06-01',
        });
        await repo.insert({
          firstName: 'Carlos', lastName: 'Garcia', email: 'carlos@example.com',
          jobTitle: 'Engineering Manager', department: 'Engineering', country: 'GB',
          salary: 110000, hireDate: '2022-03-01',
        });
        await repo.insert({
          firstName: 'Diana', lastName: 'Tanaka', email: 'diana@example.com',
          jobTitle: 'Data Scientist', department: 'Data', country: 'JP',
          salary: 9000000, hireDate: '2025-04-01',
        });
      });

      test('matches by firstName, case-insensitive', async () => {
        const result = await repo.list({ page: 0, pageSize: 50, q: 'asha' });

        expect(result.total).toBe(1);
        expect(result.rows[0].firstName).toBe('Asha');
      });

      test('matches by lastName (different case)', async () => {
        const result = await repo.list({ page: 0, pageSize: 50, q: 'SMITH' });

        expect(result.total).toBe(1);
        expect(result.rows[0].lastName).toBe('Smith');
      });

      test('matches by partial email', async () => {
        const result = await repo.list({ page: 0, pageSize: 50, q: 'asha.rao' });

        expect(result.total).toBe(1);
      });

      test('matches by jobTitle substring', async () => {
        const result = await repo.list({ page: 0, pageSize: 50, q: 'engineer' });

        expect(result.total).toBe(2);
        const titles = result.rows.map((r) => r.jobTitle).sort();

        expect(titles).toEqual(['Engineering Manager', 'Software Engineer']);
      });

      test('matches by department', async () => {
        const result = await repo.list({ page: 0, pageSize: 50, q: 'data' });

        expect(result.total).toBe(1);
        expect(result.rows[0].department).toBe('Data');
      });

      test('matches by country ISO code', async () => {
        const result = await repo.list({ page: 0, pageSize: 50, q: 'IN' });

        expect(result.total).toBeGreaterThanOrEqual(1);
        expect(result.rows.some((r) => r.country === 'IN')).toBe(true);
      });

      test('matches by country name (translated to code)', async () => {
        const result = await repo.list({ page: 0, pageSize: 50, q: 'india' });

        expect(result.total).toBe(1);
        expect(result.rows[0].country).toBe('IN');
      });

      test('matches multiple countries by partial name', async () => {
        await repo.insert({
          firstName: 'Eve', lastName: 'Mueller', email: 'eve@example.com',
          jobTitle: 'Designer', department: 'Design', country: 'DE',
          salary: 90000, hireDate: '2024-08-01',
        });

        const result = await repo.list({ page: 0, pageSize: 50, q: 'united' });

        expect(result.total).toBe(2);
        const countries = result.rows.map((r) => r.country).sort();

        expect(countries).toEqual(['GB', 'US']);
      });

      test('does NOT match salary or hireDate', async () => {
        const result = await repo.list({ page: 0, pageSize: 50, q: '1500000' });

        expect(result.total).toBe(0);
      });

      test('returns empty result + total 0 when no match', async () => {
        const result = await repo.list({ page: 0, pageSize: 50, q: 'zzz-no-match' });

        expect(result).toEqual({ rows: [], total: 0 });
      });

      test('q paginates correctly', async () => {
        // 4 employees seeded above. Search "e" hits jobTitle "Engineer" / "Designer" /
        // "Data Scientist" — basically everyone (all titles contain "e"), so 4 results.
        const page0 = await repo.list({ page: 0, pageSize: 2, q: 'e' });
        const page1 = await repo.list({ page: 1, pageSize: 2, q: 'e' });

        expect(page0.total).toBe(4);
        expect(page1.total).toBe(4);
        expect(page0.rows).toHaveLength(2);
        expect(page1.rows).toHaveLength(2);
        const ids0 = new Set(page0.rows.map((r) => r.id));
        const ids1 = new Set(page1.rows.map((r) => r.id));

        expect([...ids0].every((id) => !ids1.has(id))).toBe(true);
      });

      test('omitting q returns all rows', async () => {
        const result = await repo.list({ page: 0, pageSize: 50 });

        expect(result.total).toBe(4);
      });
    });

    test('orders by id descending — pages do not overlap', async () => {
      for (let i = 0; i < 30; i++) {
        await repo.insert({ ...input, email: `emp${i}@example.com` });
      }

      const page0 = await repo.list({ page: 0, pageSize: 10 });
      const page1 = await repo.list({ page: 1, pageSize: 10 });
      const page2 = await repo.list({ page: 2, pageSize: 10 });

      const ids = [...page0.rows, ...page1.rows, ...page2.rows].map((r) => r.id);

      expect(ids).toEqual([...ids].sort((a, b) => b - a));
      expect(new Set(ids).size).toBe(30);
    });
  });

  describe('update', () => {
    test('updates and returns the full row with a fresh updatedAt', async () => {
      const created = await repo.insert(input);

      await new Promise((r) => setTimeout(r, 10));

      const updated = await repo.update(created.id, { ...input, firstName: 'Asha-Updated' });

      expect(updated).not.toBeNull();
      expect(updated!.id).toBe(created.id);
      expect(updated!.firstName).toBe('Asha-Updated');
      expect(updated!.updatedAt > created.updatedAt).toBe(true);
      expect(updated!.createdAt).toBe(created.createdAt);
    });

    test('returns null when no row has the given id', async () => {
      const result = await repo.update(999, input);

      expect(result).toBeNull();
    });

    test('throws ConflictError("EMAIL_TAKEN") when the new email belongs to a different row', async () => {
      const a = await repo.insert({ ...input, email: 'a@example.com' });

      await repo.insert({ ...input, email: 'b@example.com' });

      await expect(
        repo.update(a.id, { ...input, email: 'b@example.com' }),
      ).rejects.toMatchObject({
        constructor: ConflictError,
        code: 'EMAIL_TAKEN',
      });
    });

    test('does not throw when the email is unchanged on the same row', async () => {
      const created = await repo.insert(input);

      const updated = await repo.update(created.id, { ...input, firstName: 'Same-Email-Different-Name' });

      expect(updated!.firstName).toBe('Same-Email-Different-Name');
      expect(updated!.email).toBe(input.email);
    });
  });

  describe('delete', () => {
    test('removes the row and returns true', async () => {
      const created = await repo.insert(input);

      const result = await repo.delete(created.id);

      expect(result).toBe(true);

      const after = await repo.list({ page: 0, pageSize: 50 });

      expect(after.total).toBe(0);
    });

    test('returns false when no row matches the id', async () => {
      const result = await repo.delete(999);

      expect(result).toBe(false);
    });
  });
});

import path from 'node:path';
import Database from 'better-sqlite3';
import { Kysely, SqliteDialect } from 'kysely';
import { migrate } from '../../src/lib/migrate';
import { InsightsRepository } from '../../src/repositories/InsightsRepository';
import { EmployeesRepository } from '../../src/repositories/EmployeesRepository';
import type { DB } from '../../src/db/types';

const baseEmployee = {
  firstName: 'Asha',
  lastName: 'Rao',
  email: 'asha@example.com',
  jobTitle: 'Software Engineer',
  department: 'Engineering',
  country: 'IN',
  salary: 1500000,
  hireDate: '2024-01-15',
};

describe('InsightsRepository.aggregateByCountry', () => {
  let repo: InsightsRepository;
  let employees: EmployeesRepository;

  beforeEach(() => {
    const sqlite = new Database(':memory:');

    migrate(sqlite, path.join(__dirname, '..', '..', 'migrations'));
    const kysely = new Kysely<DB>({ dialect: new SqliteDialect({ database: sqlite }) });

    repo = new InsightsRepository(kysely);
    employees = new EmployeesRepository(kysely);
  });

  test('returns count=0 and nulls when the table is empty', async () => {
    const result = await repo.aggregateByCountry('IN');

    expect(result.count).toBe(0);
    expect(result.min).toBeNull();
    expect(result.max).toBeNull();
    expect(result.avg).toBeNull();
    expect(result.avgTenureYears).toBeNull();
    expect(result.newHiresLast12Months).toBe(0);
  });

  test('returns count=0 when no employees in the requested country', async () => {
    await employees.insert({ ...baseEmployee, email: 'a@x.com', country: 'US' });

    const result = await repo.aggregateByCountry('IN');

    expect(result.count).toBe(0);
    expect(result.min).toBeNull();
  });

  test('returns min/max/avg over salaries in the country, ignoring other countries', async () => {
    await employees.insert({ ...baseEmployee, email: 'a@x.com', country: 'IN', salary: 100 });
    await employees.insert({ ...baseEmployee, email: 'b@x.com', country: 'IN', salary: 200 });
    await employees.insert({ ...baseEmployee, email: 'c@x.com', country: 'IN', salary: 300 });
    await employees.insert({ ...baseEmployee, email: 'd@x.com', country: 'US', salary: 9999 });

    const result = await repo.aggregateByCountry('IN');

    expect(result.count).toBe(3);
    expect(result.min).toBe(100);
    expect(result.max).toBe(300);
    expect(result.avg).toBe(200);
  });

  test('rounds the average to the nearest integer', async () => {
    await employees.insert({ ...baseEmployee, email: 'a@x.com', country: 'IN', salary: 100 });
    await employees.insert({ ...baseEmployee, email: 'b@x.com', country: 'IN', salary: 250 });
    await employees.insert({ ...baseEmployee, email: 'c@x.com', country: 'IN', salary: 350 });
    await employees.insert({ ...baseEmployee, email: 'd@x.com', country: 'IN', salary: 500 });

    const result = await repo.aggregateByCountry('IN');

    expect(result.avg).toBe(300);
  });

  test('computes avgTenureYears from hireDate', async () => {
    const twoYearsAgo = new Date();

    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
    await employees.insert({
      ...baseEmployee, email: 'a@x.com', country: 'IN',
      hireDate: twoYearsAgo.toISOString().slice(0, 10),
    });

    const result = await repo.aggregateByCountry('IN');

    expect(result.avgTenureYears).not.toBeNull();
    expect(result.avgTenureYears!).toBeGreaterThan(1.9);
    expect(result.avgTenureYears!).toBeLessThan(2.1);
  });

  test('counts only employees hired within the last 12 months for newHiresLast12Months', async () => {
    const recent = new Date();

    recent.setMonth(recent.getMonth() - 3);
    const old = new Date();

    old.setFullYear(old.getFullYear() - 2);

    await employees.insert({ ...baseEmployee, email: 'r1@x.com', country: 'IN', hireDate: recent.toISOString().slice(0, 10) });
    await employees.insert({ ...baseEmployee, email: 'r2@x.com', country: 'IN', hireDate: recent.toISOString().slice(0, 10) });
    await employees.insert({ ...baseEmployee, email: 'old@x.com', country: 'IN', hireDate: old.toISOString().slice(0, 10) });

    const result = await repo.aggregateByCountry('IN');

    expect(result.newHiresLast12Months).toBe(2);
  });
});

describe('InsightsRepository.departmentsByCountry', () => {
  let repo: InsightsRepository;
  let employees: EmployeesRepository;

  beforeEach(() => {
    const sqlite = new Database(':memory:');

    migrate(sqlite, path.join(__dirname, '..', '..', 'migrations'));
    const kysely = new Kysely<DB>({ dialect: new SqliteDialect({ database: sqlite }) });

    repo = new InsightsRepository(kysely);
    employees = new EmployeesRepository(kysely);
  });

  test('returns [] when no employees in the country', async () => {
    await employees.insert({ ...baseEmployee, email: 'a@x.com', country: 'US' });

    const result = await repo.departmentsByCountry('IN');

    expect(result).toEqual([]);
  });

  test('returns rows sorted by headcount desc, then department asc, with avgSalary rounded', async () => {
    await employees.insert({ ...baseEmployee, email: 'e1@x.com', country: 'IN', department: 'Engineering', salary: 2000000 });
    await employees.insert({ ...baseEmployee, email: 'e2@x.com', country: 'IN', department: 'Engineering', salary: 2200000 });
    await employees.insert({ ...baseEmployee, email: 's1@x.com', country: 'IN', department: 'Sales',       salary: 1400000 });
    await employees.insert({ ...baseEmployee, email: 'p1@x.com', country: 'IN', department: 'Product',     salary: 1800000 });
    await employees.insert({ ...baseEmployee, email: 'us@x.com', country: 'US', department: 'Engineering', salary: 9999999 });

    const result = await repo.departmentsByCountry('IN');

    expect(result).toEqual([
      { department: 'Engineering', headcount: 2, avgSalary: 2100000 },
      { department: 'Product',     headcount: 1, avgSalary: 1800000 },
      { department: 'Sales',       headcount: 1, avgSalary: 1400000 },
    ]);
  });
});

describe('InsightsRepository.distinctJobTitles', () => {
  let repo: InsightsRepository;
  let employees: EmployeesRepository;

  beforeEach(() => {
    const sqlite = new Database(':memory:');

    migrate(sqlite, path.join(__dirname, '..', '..', 'migrations'));
    const kysely = new Kysely<DB>({ dialect: new SqliteDialect({ database: sqlite }) });

    repo = new InsightsRepository(kysely);
    employees = new EmployeesRepository(kysely);
  });

  test('returns [] when no employees in the country', async () => {
    await employees.insert({ ...baseEmployee, email: 'a@x.com', country: 'US' });

    const result = await repo.distinctJobTitles('IN');

    expect(result).toEqual([]);
  });

  test('returns titles for the country sorted case-insensitively, ignoring other countries', async () => {
    await employees.insert({ ...baseEmployee, email: 'a@x.com', country: 'IN', jobTitle: 'Software Engineer' });
    await employees.insert({ ...baseEmployee, email: 'b@x.com', country: 'IN', jobTitle: 'Product Manager' });
    await employees.insert({ ...baseEmployee, email: 'c@x.com', country: 'IN', jobTitle: 'Designer' });
    await employees.insert({ ...baseEmployee, email: 'd@x.com', country: 'US', jobTitle: 'CFO' });

    const result = await repo.distinctJobTitles('IN');

    expect(result).toEqual(['Designer', 'Product Manager', 'Software Engineer']);
  });

  test('collapses casing variants and returns the lexicographically minimum display string', async () => {
    await employees.insert({ ...baseEmployee, email: 'a@x.com', country: 'IN', jobTitle: 'IT Manager' });
    await employees.insert({ ...baseEmployee, email: 'b@x.com', country: 'IN', jobTitle: 'It Manager' });
    await employees.insert({ ...baseEmployee, email: 'c@x.com', country: 'IN', jobTitle: 'it manager' });

    const result = await repo.distinctJobTitles('IN');

    expect(result).toEqual(['IT Manager']);
  });
});

describe('InsightsRepository.aggregateByCountryAndRole', () => {
  let repo: InsightsRepository;
  let employees: EmployeesRepository;

  beforeEach(() => {
    const sqlite = new Database(':memory:');

    migrate(sqlite, path.join(__dirname, '..', '..', 'migrations'));
    const kysely = new Kysely<DB>({ dialect: new SqliteDialect({ database: sqlite }) });

    repo = new InsightsRepository(kysely);
    employees = new EmployeesRepository(kysely);
  });

  test('returns count=0 when no rows match the (country, title) filter', async () => {
    await employees.insert({ ...baseEmployee, email: 'a@x.com', country: 'IN', jobTitle: 'Software Engineer' });

    const result = await repo.aggregateByCountryAndRole('IN', 'Nope');

    expect(result.count).toBe(0);
    expect(result.min).toBeNull();
    expect(result.avg).toBeNull();
    expect(result.newHiresLast12Months).toBe(0);
  });

  test('returns aggregate over matching rows', async () => {
    await employees.insert({ ...baseEmployee, email: 'a@x.com', country: 'IN', jobTitle: 'Software Engineer', salary: 100 });
    await employees.insert({ ...baseEmployee, email: 'b@x.com', country: 'IN', jobTitle: 'Software Engineer', salary: 300 });
    await employees.insert({ ...baseEmployee, email: 'c@x.com', country: 'IN', jobTitle: 'Designer',          salary: 9999 });

    const result = await repo.aggregateByCountryAndRole('IN', 'Software Engineer');

    expect(result.count).toBe(2);
    expect(result.min).toBe(100);
    expect(result.max).toBe(300);
    expect(result.avg).toBe(200);
  });

  test('matches the title case-insensitively', async () => {
    await employees.insert({ ...baseEmployee, email: 'a@x.com', country: 'IN', jobTitle: 'Software Engineer', salary: 100 });
    await employees.insert({ ...baseEmployee, email: 'b@x.com', country: 'IN', jobTitle: 'software engineer', salary: 200 });

    const result = await repo.aggregateByCountryAndRole('IN', 'SOFTWARE ENGINEER');

    expect(result.count).toBe(2);
    expect(result.avg).toBe(150);
  });

  test('does not bleed across countries', async () => {
    await employees.insert({ ...baseEmployee, email: 'a@x.com', country: 'IN', jobTitle: 'Software Engineer', salary: 100 });
    await employees.insert({ ...baseEmployee, email: 'b@x.com', country: 'US', jobTitle: 'Software Engineer', salary: 9999 });

    const result = await repo.aggregateByCountryAndRole('IN', 'Software Engineer');

    expect(result.count).toBe(1);
    expect(result.max).toBe(100);
  });
});

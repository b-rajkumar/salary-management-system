import type Database from 'better-sqlite3';
import { COUNTRIES } from '@app/shared';

const JOB_TITLES = [
  'Software Engineer',
  'Senior Software Engineer',
  'Engineering Manager',
  'Product Manager',
  'Designer',
  'Data Scientist',
] as const;

type JobTitle = (typeof JOB_TITLES)[number];

const DEPARTMENT_FOR_TITLE: Record<JobTitle, string> = {
  'Software Engineer': 'Engineering',
  'Senior Software Engineer': 'Engineering',
  'Engineering Manager': 'Engineering',
  'Product Manager': 'Product',
  'Designer': 'Design',
  'Data Scientist': 'Data',
};

// Manually-picked ranges in each country's local currency. NOT derived from FX rates —
// each cell is a plausible salary band as someone in that country would experience it.
const SALARY_RANGES: Record<JobTitle, Record<string, [number, number]>> = {
  'Software Engineer': {
    US: [80000, 180000],
    IN: [800000, 3500000],
    GB: [40000, 95000],
    DE: [55000, 110000],
    JP: [5000000, 12000000],
  },
  'Senior Software Engineer': {
    US: [140000, 260000],
    IN: [2500000, 6000000],
    GB: [70000, 140000],
    DE: [85000, 150000],
    JP: [8000000, 16000000],
  },
  'Engineering Manager': {
    US: [180000, 320000],
    IN: [4000000, 9000000],
    GB: [95000, 180000],
    DE: [110000, 180000],
    JP: [10000000, 20000000],
  },
  'Product Manager': {
    US: [130000, 250000],
    IN: [2200000, 5500000],
    GB: [70000, 140000],
    DE: [80000, 150000],
    JP: [8000000, 15000000],
  },
  'Designer': {
    US: [85000, 180000],
    IN: [900000, 3000000],
    GB: [45000, 100000],
    DE: [55000, 110000],
    JP: [5000000, 11000000],
  },
  'Data Scientist': {
    US: [110000, 220000],
    IN: [1800000, 5000000],
    GB: [60000, 130000],
    DE: [70000, 140000],
    JP: [7000000, 14000000],
  },
};

const COUNTRY_CODES = Object.keys(COUNTRIES);

const FALLBACK_FIRST = ['Asha', 'Ravi', 'Priya', 'Arjun', 'Ana', 'Lin', 'Yuki', 'Kenji', 'Hans', 'Emma'];
const FALLBACK_LAST = ['Rao', 'Patel', 'Kumar', 'Singh', 'Garcia', 'Tanaka', 'Sato', 'Mueller', 'Smith', 'Jones'];

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomIntInRange([min, max]: [number, number]): number {
  return Math.floor(min + Math.random() * (max - min + 1));
}

function randomHireDate(): string {
  const today = new Date();
  const tenYearsMs = 10 * 365 * 24 * 60 * 60 * 1000;
  const t = today.getTime() - Math.floor(Math.random() * tenYearsMs);

  return new Date(t).toISOString().slice(0, 10);
}

export interface SeedOptions {
  db: Database.Database;
  count: number;
  reset?: boolean;
  firstNames?: string[];
  lastNames?: string[];
}

export interface SeedResult {
  inserted: number;
  ms: number;
}

export function seed(opts: SeedOptions): SeedResult {
  const start = Date.now();

  if (opts.reset) {
    opts.db.exec('DELETE FROM employees');
  }

  const firstNames = opts.firstNames ?? FALLBACK_FIRST;
  const lastNames = opts.lastNames ?? FALLBACK_LAST;

  const insert = opts.db.prepare(`
    INSERT INTO employees
      (firstName, lastName, email, jobTitle, department, country, salary, hireDate)
    VALUES
      (@firstName, @lastName, @email, @jobTitle, @department, @country, @salary, @hireDate)
  `);

  const tx = opts.db.transaction((count: number) => {
    for (let i = 0; i < count; i++) {
      const firstName = pick(firstNames);
      const lastName = pick(lastNames);
      const jobTitle = pick(JOB_TITLES);
      const country = pick(COUNTRY_CODES);

      insert.run({
        firstName,
        lastName,
        email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@example.com`,
        jobTitle,
        department: DEPARTMENT_FOR_TITLE[jobTitle],
        country,
        salary: randomIntInRange(SALARY_RANGES[jobTitle][country]),
        hireDate: randomHireDate(),
      });
    }
  });

  tx(opts.count);

  return { inserted: opts.count, ms: Date.now() - start };
}

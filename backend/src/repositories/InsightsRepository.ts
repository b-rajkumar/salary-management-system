import { sql, type Kysely } from 'kysely';
import type { DB } from '../db/types';

export interface CountryAggregate {
  count: number;
  min: number | null;
  max: number | null;
  avg: number | null;
  avgTenureYears: number | null;
  newHiresLast12Months: number;
}

export interface DepartmentBreakdownRow {
  department: string;
  headcount: number;
  avgSalary: number;
}

interface AggregateRow {
  count: number;
  min: number | null;
  max: number | null;
  avg: number | null;
  avgTenureYears: number | null;
  newHiresLast12Months: number;
}

export class InsightsRepository {
  constructor(private readonly db: Kysely<DB>) {}

  async aggregateByCountry(country: string): Promise<CountryAggregate> {
    const row = await this.buildAggregateQuery({ country }).executeTakeFirstOrThrow();

    return this.mapAggregateRow(row);
  }

  async aggregateByCountryAndRole(country: string, jobTitle: string): Promise<CountryAggregate> {
    const row = await this.buildAggregateQuery({ country, jobTitle }).executeTakeFirstOrThrow();

    return this.mapAggregateRow(row);
  }

  async departmentsByCountry(country: string): Promise<DepartmentBreakdownRow[]> {
    const rows = await this.db
      .selectFrom('employees')
      .where('country', '=', country)
      .select([
        'department',
        sql<number>`COUNT(*)`.as('headcount'),
        sql<number>`CAST(ROUND(AVG(salary)) AS INTEGER)`.as('avgSalary'),
      ])
      .groupBy('department')
      .orderBy('headcount', 'desc')
      .orderBy('department', 'asc')
      .execute();

    return rows.map((r) => ({
      department: r.department,
      headcount: Number(r.headcount),
      avgSalary: Number(r.avgSalary),
    }));
  }

  async distinctJobTitles(country: string): Promise<string[]> {
    const rows = await this.db
      .selectFrom('employees')
      .where('country', '=', country)
      .select(sql<string>`MIN(jobTitle)`.as('jobTitle'))
      .groupBy(sql`LOWER(jobTitle)`)
      .orderBy(sql`LOWER(jobTitle)`)
      .execute();

    return rows.map((r) => r.jobTitle);
  }

  private buildAggregateQuery(filter: { country: string; jobTitle?: string }) {
    let q = this.db
      .selectFrom('employees')
      .where('country', '=', filter.country)
      .select(({ fn }) => [
        fn.countAll<number>().as('count'),
        fn.min<number | null>('salary').as('min'),
        fn.max<number | null>('salary').as('max'),
        sql<number | null>`CAST(ROUND(AVG(salary)) AS INTEGER)`.as('avg'),
        sql<number | null>`AVG((julianday('now') - julianday(hireDate)) / 365.25)`.as('avgTenureYears'),
        sql<number>`COALESCE(SUM(CASE WHEN hireDate >= date('now','-12 months') THEN 1 ELSE 0 END), 0)`.as('newHiresLast12Months'),
      ]);

    if (filter.jobTitle !== undefined) {
      q = q.where(sql`jobTitle = ${filter.jobTitle} COLLATE NOCASE`);
    }

    return q;
  }

  private mapAggregateRow(row: AggregateRow): CountryAggregate {
    return {
      count: Number(row.count),
      min: row.min === null ? null : Number(row.min),
      max: row.max === null ? null : Number(row.max),
      avg: row.avg === null ? null : Number(row.avg),
      avgTenureYears: row.avgTenureYears === null ? null : Number(row.avgTenureYears),
      newHiresLast12Months: Number(row.newHiresLast12Months),
    };
  }
}

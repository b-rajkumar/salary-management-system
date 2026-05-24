import { COUNTRIES, type CountryInsightsResponse, type RoleInsightsResponse } from '@app/shared';
import { NotFoundError } from '../lib/errors';
import type { InsightsRepository } from '../repositories/InsightsRepository';

export class InsightsService {
  constructor(private readonly repo: InsightsRepository) {}

  async byCountry(country: string): Promise<CountryInsightsResponse> {
    const agg = await this.repo.aggregateByCountry(country);

    if (agg.count === 0) {
      throw new NotFoundError('COUNTRY_NOT_FOUND', `No employees in ${country}`);
    }

    const departments = await this.repo.departmentsByCountry(country);
    const currency = COUNTRIES[country as keyof typeof COUNTRIES].currency;

    return {
      country,
      currency,
      count: agg.count,
      salary: {
        min: agg.min!,
        max: agg.max!,
        avg: agg.avg!,
      },
      tenure: {
        avgYears: Math.round(agg.avgTenureYears! * 10) / 10,
        newHiresLast12Months: agg.newHiresLast12Months,
      },
      departments,
    };
  }

  async byCountryAndRole(country: string, jobTitle: string): Promise<RoleInsightsResponse> {
    const agg = await this.repo.aggregateByCountryAndRole(country, jobTitle);

    if (agg.count === 0) {
      throw new NotFoundError('ROLE_NOT_FOUND', `No employees with title ${jobTitle} in ${country}`);
    }

    const currency = COUNTRIES[country as keyof typeof COUNTRIES].currency;

    return {
      country,
      jobTitle,
      currency,
      count: agg.count,
      salary: {
        min: agg.min!,
        max: agg.max!,
        avg: agg.avg!,
      },
      tenure: {
        avgYears: Math.round(agg.avgTenureYears! * 10) / 10,
        newHiresLast12Months: agg.newHiresLast12Months,
      },
    };
  }

  async jobTitlesByCountry(country: string): Promise<string[]> {
    return this.repo.distinctJobTitles(country);
  }
}

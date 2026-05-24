import { InsightsService } from '../../src/services/InsightsService';
import { NotFoundError } from '../../src/lib/errors';
import type {
  InsightsRepository, CountryAggregate, DepartmentBreakdownRow,
} from '../../src/repositories/InsightsRepository';

describe('InsightsService.byCountry', () => {
  let repo: { aggregateByCountry: jest.Mock; departmentsByCountry: jest.Mock };
  let service: InsightsService;

  beforeEach(() => {
    repo = {
      aggregateByCountry: jest.fn(),
      departmentsByCountry: jest.fn(),
    };
    service = new InsightsService(repo as unknown as InsightsRepository);
  });

  test('throws NotFoundError("COUNTRY_NOT_FOUND") when the aggregate count is 0', async () => {
    repo.aggregateByCountry.mockResolvedValue({
      count: 0, min: null, max: null, avg: null, avgTenureYears: null, newHiresLast12Months: 0,
    } satisfies CountryAggregate);

    await expect(service.byCountry('IN')).rejects.toMatchObject({
      constructor: NotFoundError,
      code: 'COUNTRY_NOT_FOUND',
    });
  });

  test('does not call departmentsByCountry when count is 0 (short-circuit)', async () => {
    repo.aggregateByCountry.mockResolvedValue({
      count: 0, min: null, max: null, avg: null, avgTenureYears: null, newHiresLast12Months: 0,
    } satisfies CountryAggregate);

    await service.byCountry('IN').catch(() => {});
    expect(repo.departmentsByCountry).not.toHaveBeenCalled();
  });

  test('returns the assembled response when count > 0', async () => {
    repo.aggregateByCountry.mockResolvedValue({
      count: 312, min: 600000, max: 4500000, avg: 1820000,
      avgTenureYears: 3.4567, newHiresLast12Months: 47,
    } satisfies CountryAggregate);
    repo.departmentsByCountry.mockResolvedValue([
      { department: 'Engineering', headcount: 180, avgSalary: 2100000 },
    ] satisfies DepartmentBreakdownRow[]);

    const result = await service.byCountry('IN');

    expect(result).toEqual({
      country: 'IN',
      currency: 'INR',
      count: 312,
      salary: { min: 600000, max: 4500000, avg: 1820000 },
      tenure: { avgYears: 3.5, newHiresLast12Months: 47 },
      departments: [
        { department: 'Engineering', headcount: 180, avgSalary: 2100000 },
      ],
    });
  });

  test('rounds avgTenureYears to one decimal — 2.34 → 2.3', async () => {
    repo.aggregateByCountry.mockResolvedValue({
      count: 1, min: 1, max: 1, avg: 1, avgTenureYears: 2.34, newHiresLast12Months: 0,
    } satisfies CountryAggregate);
    repo.departmentsByCountry.mockResolvedValue([]);

    const result = await service.byCountry('IN');

    expect(result.tenure.avgYears).toBe(2.3);
  });

  test('rounds avgTenureYears to one decimal — 2.36 → 2.4', async () => {
    repo.aggregateByCountry.mockResolvedValue({
      count: 1, min: 1, max: 1, avg: 1, avgTenureYears: 2.36, newHiresLast12Months: 0,
    } satisfies CountryAggregate);
    repo.departmentsByCountry.mockResolvedValue([]);

    const result = await service.byCountry('IN');

    expect(result.tenure.avgYears).toBe(2.4);
  });
});

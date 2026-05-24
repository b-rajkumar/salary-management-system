import { getCountryInsights, getJobTitles, getRoleInsights } from './insights';
import type { CountryInsightsResponse, RoleInsightsResponse } from '@app/shared';

const okPayload: CountryInsightsResponse = {
  country: 'IN', currency: 'INR', count: 312,
  salary: { min: 1, max: 2, avg: 3 },
  tenure: { avgYears: 1.0, newHiresLast12Months: 0 },
  departments: [],
};

const rolePayload: RoleInsightsResponse = {
  country: 'IN', jobTitle: 'Software Engineer', currency: 'INR', count: 47,
  salary: { min: 1400000, max: 3800000, avg: 2250000 },
  tenure: { avgYears: 2.8, newHiresLast12Months: 9 },
};

describe('getCountryInsights', () => {
  const originalFetch = global.fetch;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  test('returns { kind: "ok", data } on 200', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => okPayload,
    });

    const result = await getCountryInsights('IN');

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/insights/country/IN',
      expect.anything(),
    );
    expect(result).toEqual({ kind: 'ok', data: okPayload });
  });

  test('returns { kind: "empty" } on 404 COUNTRY_NOT_FOUND', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ error: { code: 'COUNTRY_NOT_FOUND', message: 'no rows' } }),
    });

    const result = await getCountryInsights('IN');

    expect(result).toEqual({ kind: 'empty' });
  });

  test('throws on a 500 server error', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: { code: 'INTERNAL_ERROR', message: 'boom' } }),
    });

    await expect(getCountryInsights('IN')).rejects.toThrow(/boom/);
  });

  test('throws on a 400 VALIDATION_ERROR (not mapped to empty)', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: { code: 'VALIDATION_ERROR', message: 'bad' } }),
    });

    await expect(getCountryInsights('IN')).rejects.toThrow(/bad/);
  });
});

describe('getJobTitles', () => {
  const originalFetch = global.fetch;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  test('returns the titles array on 200', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ['Designer', 'Software Engineer'],
    });

    const result = await getJobTitles('IN');

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/insights/country/IN/job-titles',
      expect.anything(),
    );
    expect(result).toEqual(['Designer', 'Software Engineer']);
  });

  test('throws on a 500 server error', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: { code: 'INTERNAL_ERROR', message: 'boom' } }),
    });

    await expect(getJobTitles('IN')).rejects.toThrow(/boom/);
  });
});

describe('getRoleInsights', () => {
  const originalFetch = global.fetch;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  test('returns { kind: "ok", data } on 200, URL-encoding the title', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => rolePayload,
    });

    const result = await getRoleInsights('IN', 'Software Engineer');

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/insights/country/IN/job-title?title=Software%20Engineer',
      expect.anything(),
    );
    expect(result).toEqual({ kind: 'ok', data: rolePayload });
  });

  test('returns { kind: "empty" } on 404 ROLE_NOT_FOUND', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ error: { code: 'ROLE_NOT_FOUND', message: 'gone' } }),
    });

    const result = await getRoleInsights('IN', 'Nope');

    expect(result).toEqual({ kind: 'empty' });
  });

  test('throws on a 500 server error', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: { code: 'INTERNAL_ERROR', message: 'boom' } }),
    });

    await expect(getRoleInsights('IN', 'X')).rejects.toThrow(/boom/);
  });
});

import { getCountryInsights } from './insights';
import type { CountryInsightsResponse } from '@app/shared';

const okPayload: CountryInsightsResponse = {
  country: 'IN', currency: 'INR', count: 312,
  salary: { min: 1, max: 2, avg: 3 },
  tenure: { avgYears: 1.0, newHiresLast12Months: 0 },
  departments: [],
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

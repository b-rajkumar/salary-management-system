import type { CountryInsightsResponse } from '@app/shared';
import { ApiError, request } from './client';

export type CountryInsightsResult =
  | { kind: 'ok'; data: CountryInsightsResponse }
  | { kind: 'empty' };

export async function getCountryInsights(country: string): Promise<CountryInsightsResult> {
  try {
    const data = await request<CountryInsightsResponse>(`/api/insights/country/${country}`);

    return { kind: 'ok', data };
  } catch (err) {
    if (err instanceof ApiError && err.status === 404 && err.code === 'COUNTRY_NOT_FOUND') {
      return { kind: 'empty' };
    }
    throw err;
  }
}

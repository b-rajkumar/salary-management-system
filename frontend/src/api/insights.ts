import type { CountryInsightsResponse, RoleInsightsResponse } from '@app/shared';
import { ApiError, request } from './client';

export type CountryInsightsResult =
  | { kind: 'ok'; data: CountryInsightsResponse }
  | { kind: 'empty' };

export type RoleInsightsResult =
  | { kind: 'ok'; data: RoleInsightsResponse }
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

export function getJobTitles(country: string): Promise<string[]> {
  return request<string[]>(`/api/insights/country/${country}/job-titles`);
}

export async function getRoleInsights(country: string, jobTitle: string): Promise<RoleInsightsResult> {
  try {
    const data = await request<RoleInsightsResponse>(
      `/api/insights/country/${country}/job-title?title=${encodeURIComponent(jobTitle)}`,
    );

    return { kind: 'ok', data };
  } catch (err) {
    if (err instanceof ApiError && err.status === 404 && err.code === 'ROLE_NOT_FOUND') {
      return { kind: 'empty' };
    }
    throw err;
  }
}

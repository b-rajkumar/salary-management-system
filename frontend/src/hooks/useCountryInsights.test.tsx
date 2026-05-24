import { act, renderHook, waitFor } from '@testing-library/react';
import { useCountryInsights } from './useCountryInsights';
import * as api from '../api/insights';
import type { CountryInsightsResponse } from '@app/shared';

const okPayload: CountryInsightsResponse = {
  country: 'IN', currency: 'INR', count: 1,
  salary: { min: 1, max: 1, avg: 1 },
  tenure: { avgYears: 1, newHiresLast12Months: 0 },
  departments: [],
};

describe('useCountryInsights', () => {
  let spy: jest.SpyInstance;

  beforeEach(() => {
    spy = jest.spyOn(api, 'getCountryInsights');
  });

  afterEach(() => {
    spy.mockRestore();
  });

  test('returns { result: null, isLoading: false } when country is null and does not fetch', () => {
    const { result } = renderHook(() => useCountryInsights(null));

    expect(result.current.result).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(spy).not.toHaveBeenCalled();
  });

  test('fetches when country is provided and exposes result on success', async () => {
    spy.mockResolvedValue({ kind: 'ok', data: okPayload });

    const { result } = renderHook(() => useCountryInsights('IN'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.result).toEqual({ kind: 'ok', data: okPayload });
    expect(spy).toHaveBeenCalledWith('IN');
  });

  test('exposes the empty domain branch when the api returns kind="empty"', async () => {
    spy.mockResolvedValue({ kind: 'empty' });

    const { result } = renderHook(() => useCountryInsights('AQ'));

    await waitFor(() => {
      expect(result.current.result).toEqual({ kind: 'empty' });
    });
    expect(result.current.error).toBeNull();
  });

  test('exposes error message when the api throws', async () => {
    spy.mockRejectedValue(new Error('boom'));

    const { result } = renderHook(() => useCountryInsights('IN'));

    await waitFor(() => {
      expect(result.current.error).toBe('boom');
    });
    expect(result.current.result).toBeNull();
  });

  test('refetches when country changes', async () => {
    spy.mockResolvedValue({ kind: 'ok', data: okPayload });

    const { rerender } = renderHook(({ c }: { c: string | null }) => useCountryInsights(c), {
      initialProps: { c: 'IN' as string | null },
    });

    await waitFor(() => {
      expect(spy).toHaveBeenCalledTimes(1);
    });
    await act(async () => { rerender({ c: 'US' }); });
    await waitFor(() => {
      expect(spy).toHaveBeenCalledWith('US');
    });
  });
});

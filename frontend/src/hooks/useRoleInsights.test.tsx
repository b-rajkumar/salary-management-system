import { act, renderHook, waitFor } from '@testing-library/react';
import { useRoleInsights } from './useRoleInsights';
import * as api from '../api/insights';
import type { RoleInsightsResponse } from '@app/shared';

const rolePayload: RoleInsightsResponse = {
  country: 'IN', jobTitle: 'Software Engineer', currency: 'INR', count: 1,
  salary: { min: 1, max: 1, avg: 1 },
  tenure: { avgYears: 1, newHiresLast12Months: 0 },
};

describe('useRoleInsights', () => {
  let spy: jest.SpyInstance;

  beforeEach(() => {
    spy = jest.spyOn(api, 'getRoleInsights');
  });

  afterEach(() => {
    spy.mockRestore();
  });

  test('does not fetch when role is null', () => {
    const { result } = renderHook(() => useRoleInsights('IN', null));

    expect(result.current.result).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(spy).not.toHaveBeenCalled();
  });

  test('does not fetch when country is null', () => {
    const { result } = renderHook(() => useRoleInsights(null, 'Engineer'));

    expect(result.current.result).toBeNull();
    expect(spy).not.toHaveBeenCalled();
  });

  test('fetches when both country and role are provided', async () => {
    spy.mockResolvedValue({ kind: 'ok', data: rolePayload });

    const { result } = renderHook(() => useRoleInsights('IN', 'Software Engineer'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.result).toEqual({ kind: 'ok', data: rolePayload });
    expect(spy).toHaveBeenCalledWith('IN', 'Software Engineer');
  });

  test('exposes the empty domain branch when api returns kind="empty"', async () => {
    spy.mockResolvedValue({ kind: 'empty' });

    const { result } = renderHook(() => useRoleInsights('IN', 'Nope'));

    await waitFor(() => {
      expect(result.current.result).toEqual({ kind: 'empty' });
    });
  });

  test('exposes error when api throws', async () => {
    spy.mockRejectedValue(new Error('boom'));

    const { result } = renderHook(() => useRoleInsights('IN', 'Engineer'));

    await waitFor(() => {
      expect(result.current.error).toBe('boom');
    });
  });

  test('resets to null state when role transitions back to null', async () => {
    spy.mockResolvedValue({ kind: 'ok', data: rolePayload });

    const { result, rerender } = renderHook(
      ({ r }: { r: string | null }) => useRoleInsights('IN', r),
      { initialProps: { r: 'Engineer' as string | null } },
    );

    await waitFor(() => {
      expect(result.current.result).not.toBeNull();
    });

    await act(async () => { rerender({ r: null }); });

    expect(result.current.result).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });
});

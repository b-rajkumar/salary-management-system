import { act, renderHook, waitFor } from '@testing-library/react';
import { useJobTitles } from './useJobTitles';
import * as api from '../api/insights';

describe('useJobTitles', () => {
  let spy: jest.SpyInstance;

  beforeEach(() => {
    spy = jest.spyOn(api, 'getJobTitles');
  });

  afterEach(() => {
    spy.mockRestore();
  });

  test('returns { titles: [], isLoading: false } when country is null and does not fetch', () => {
    const { result } = renderHook(() => useJobTitles(null));

    expect(result.current.titles).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(spy).not.toHaveBeenCalled();
  });

  test('fetches when country is provided and exposes titles on success', async () => {
    spy.mockResolvedValue(['Designer', 'Software Engineer']);

    const { result } = renderHook(() => useJobTitles('IN'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.titles).toEqual(['Designer', 'Software Engineer']);
    expect(spy).toHaveBeenCalledWith('IN');
  });

  test('exposes error message when the api throws', async () => {
    spy.mockRejectedValue(new Error('boom'));

    const { result } = renderHook(() => useJobTitles('IN'));

    await waitFor(() => {
      expect(result.current.error).toBe('boom');
    });
    expect(result.current.titles).toEqual([]);
  });

  test('refetches when country changes', async () => {
    spy.mockResolvedValue(['X']);

    const { rerender } = renderHook(({ c }: { c: string | null }) => useJobTitles(c), {
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

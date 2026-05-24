import { act, renderHook, waitFor } from '@testing-library/react';
import { useEmployeesList } from './useEmployeesList';
import { listEmployees } from '../api/employees';

jest.mock('../api/employees');

const mockedList = jest.mocked(listEmployees);

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useEmployeesList', () => {
  test('fetches on mount and exposes data and loading state', async () => {
    mockedList.mockResolvedValueOnce({ rows: [], total: 0 });

    const { result } = renderHook(() => useEmployeesList(0, 50));

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toEqual({ rows: [], total: 0 });
    expect(result.current.error).toBeNull();
    expect(mockedList).toHaveBeenCalledWith({ page: 0, pageSize: 50 });
  });

  test('exposes error when the API throws', async () => {
    mockedList.mockRejectedValueOnce(new Error('boom'));

    const { result } = renderHook(() => useEmployeesList(0, 50));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBe('boom');
  });

  test('refetches when page changes', async () => {
    mockedList.mockResolvedValue({ rows: [], total: 0 });

    const { result, rerender } = renderHook(
      ({ page }) => useEmployeesList(page, 50),
      { initialProps: { page: 0 } },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    rerender({ page: 1 });
    await waitFor(() => expect(mockedList).toHaveBeenCalledTimes(2));
    expect(mockedList).toHaveBeenLastCalledWith({ page: 1, pageSize: 50 });
  });

  test('refresh() triggers a refetch with the same args', async () => {
    mockedList.mockResolvedValue({ rows: [], total: 0 });

    const { result } = renderHook(() => useEmployeesList(0, 50));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(mockedList).toHaveBeenCalledTimes(1);

    act(() => result.current.refresh());

    await waitFor(() => expect(mockedList).toHaveBeenCalledTimes(2));
  });
});

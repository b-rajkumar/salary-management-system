import { useCallback, useEffect, useState } from 'react';
import type { EmployeesListResponse } from '@app/shared';
import { listEmployees } from '../api/employees';

export interface UseEmployeesListResult {
  data: EmployeesListResponse;
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useEmployeesList(page: number, pageSize: number, q = ''): UseEmployeesListResult {
  const [data, setData] = useState<EmployeesListResponse>({ rows: [], total: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    setIsLoading(true);
    setError(null);

    listEmployees({ page, pageSize, q: q || undefined })
      .then((res) => {
        if (!cancelled) {
          setData(res);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setError(err.message);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [page, pageSize, q, reloadKey]);

  const refresh = useCallback(() => {
    setReloadKey((k) => k + 1);
  }, []);

  return { data, isLoading, error, refresh };
}

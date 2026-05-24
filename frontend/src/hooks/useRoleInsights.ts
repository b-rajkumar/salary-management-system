import { useEffect, useState } from 'react';
import { getRoleInsights, type RoleInsightsResult } from '../api/insights';

export interface UseRoleInsights {
  result: RoleInsightsResult | null;
  isLoading: boolean;
  error: string | null;
}

export function useRoleInsights(country: string | null, role: string | null): UseRoleInsights {
  const [result, setResult] = useState<RoleInsightsResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (country === null || role === null) {
      setResult(null);
      setError(null);
      setIsLoading(false);

      return;
    }

    let cancelled = false;

    setIsLoading(true);
    setError(null);
    setResult(null);

    getRoleInsights(country, role)
      .then((r) => {
        if (!cancelled) {
          setResult(r);
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
  }, [country, role]);

  return { result, isLoading, error };
}

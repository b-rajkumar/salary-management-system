import { useEffect, useState } from 'react';
import { getCountryInsights, type CountryInsightsResult } from '../api/insights';

export interface UseCountryInsights {
  result: CountryInsightsResult | null;
  isLoading: boolean;
  error: string | null;
}

export function useCountryInsights(country: string | null): UseCountryInsights {
  const [result, setResult] = useState<CountryInsightsResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (country === null) {
      setResult(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    setIsLoading(true);
    setError(null);
    setResult(null);

    getCountryInsights(country)
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
  }, [country]);

  return { result, isLoading, error };
}

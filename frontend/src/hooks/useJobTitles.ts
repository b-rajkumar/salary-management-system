import { useEffect, useState } from 'react';
import { getJobTitles } from '../api/insights';

export interface UseJobTitles {
  titles: string[];
  isLoading: boolean;
  error: string | null;
}

export function useJobTitles(country: string | null): UseJobTitles {
  const [titles, setTitles] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (country === null) {
      setTitles([]);
      setError(null);
      setIsLoading(false);

      return;
    }

    let cancelled = false;

    setIsLoading(true);
    setError(null);
    setTitles([]);

    getJobTitles(country)
      .then((t) => {
        if (!cancelled) {
          setTitles(t);
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

  return { titles, isLoading, error };
}

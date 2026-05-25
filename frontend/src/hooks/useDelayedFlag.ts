import { useEffect, useState } from 'react';

export function useDelayedFlag(flag: boolean, delayMs: number): boolean {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!flag) {
      setShow(false);

      return;
    }

    const t = setTimeout(() => setShow(true), delayMs);

    return () => clearTimeout(t);
  }, [flag, delayMs]);

  return show;
}

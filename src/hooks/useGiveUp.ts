import { useEffect, useState } from 'react';

/**
 * True once `missing` has stayed true for `ms`. Live queries can lag a
 * navigation by a frame or two (start a workout, finish one, save an edit),
 * so screens wait a moment before deciding their record really is gone.
 */
export function useGiveUp(missing: boolean, ms = 1200): boolean {
  const [gaveUp, setGaveUp] = useState(false);
  useEffect(() => {
    if (!missing) {
      setGaveUp(false);
      return;
    }
    const t = setTimeout(() => setGaveUp(true), ms);
    return () => clearTimeout(t);
  }, [missing, ms]);
  return missing && gaveUp;
}

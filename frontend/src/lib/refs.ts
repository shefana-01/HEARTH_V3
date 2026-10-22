import { useMemo, type MutableRefObject, type Ref, type RefCallback } from 'react';

/** Point several refs (callback or object) at the same element. */
export function mergeRefs<T>(...refs: (Ref<T> | undefined)[]): RefCallback<T> {
  return (value) => {
    for (const ref of refs) {
      if (typeof ref === 'function') ref(value);
      else if (ref) (ref as MutableRefObject<T | null>).current = value;
    }
  };
}

/** `mergeRefs`, kept stable between renders so React does not detach and re-attach the refs each time. */
export function useMergedRef<T>(a: Ref<T> | undefined, b: Ref<T> | undefined): RefCallback<T> {
  return useMemo(() => mergeRefs(a, b), [a, b]);
}

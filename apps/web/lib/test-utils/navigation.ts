// A tiny in-memory stand-in for next/navigation, for tests. Unlike a bare vi.fn(), pushing or
// replacing really changes the URL that useSearchParams/usePathname return (components re-render),
// and back()/forward() walk a history stack, so URL-driven behaviour can be tested for real.
import { useMemo, useSyncExternalStore } from "react";

const BASE = "http://localhost";

let entries: string[] = ["/"];
let index = 0;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => void listeners.delete(l);
};
const current = () => entries[index];

export const fakeNavigation = {
  /** Start a test at `url` with a fresh history. */
  reset(url = "/") {
    entries = [url];
    index = 0;
    this.pushed.length = 0;
    this.replaced.length = 0;
    notify();
  },
  get url() {
    return current();
  },
  get search() {
    return new URL(current(), BASE).search;
  },
  get historyLength() {
    return entries.length;
  },
  push(url: string) {
    entries = [...entries.slice(0, index + 1), url];
    index++;
    this.pushed.push(url);
    notify();
  },
  replace(url: string) {
    entries = [...entries.slice(0, index), url, ...entries.slice(index + 1)];
    this.replaced.push(url);
    notify();
  },
  back() {
    if (index > 0) index--;
    notify();
  },
  forward() {
    if (index < entries.length - 1) index++;
    notify();
  },
  pushed: [] as string[],
  replaced: [] as string[],
};

const useUrl = () => useSyncExternalStore(subscribe, current, current);

/** The module shape the app imports from "next/navigation". */
export const navigationModule = {
  useRouter: () =>
    useMemo(
      () => ({
        push: (url: string) => fakeNavigation.push(url),
        replace: (url: string) => fakeNavigation.replace(url),
        back: () => fakeNavigation.back(),
        forward: () => fakeNavigation.forward(),
        prefetch: () => undefined,
        refresh: () => undefined,
      }),
      [],
    ),
  usePathname: () => new URL(useUrl(), BASE).pathname,
  useSearchParams: () => {
    const url = useUrl();
    return useMemo(() => new URL(url, BASE).searchParams, [url]);
  },
};

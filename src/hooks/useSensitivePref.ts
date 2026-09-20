import { useEffect, useState, useCallback } from "react";

export type SensitivePref = "hide" | "blur" | "show";

const KEY = "red-rxxm:sensitive-pref";
const DEFAULT: SensitivePref = "blur";

const read = (): SensitivePref => {
  if (typeof window === "undefined") return DEFAULT;
  const v = window.localStorage.getItem(KEY);
  return v === "hide" || v === "blur" || v === "show" ? v : DEFAULT;
};

// Custom event so same-tab updates also propagate (storage event only fires across tabs)
const EVENT = "red-rxxm:sensitive-pref-change";

export const useSensitivePref = (): [SensitivePref, (p: SensitivePref) => void] => {
  const [pref, setPref] = useState<SensitivePref>(read);

  useEffect(() => {
    const handler = () => setPref(read());
    window.addEventListener("storage", handler);
    window.addEventListener(EVENT, handler);
    return () => {
      window.removeEventListener("storage", handler);
      window.removeEventListener(EVENT, handler);
    };
  }, []);

  const update = useCallback((p: SensitivePref) => {
    window.localStorage.setItem(KEY, p);
    window.dispatchEvent(new Event(EVENT));
    setPref(p);
  }, []);

  return [pref, update];
};

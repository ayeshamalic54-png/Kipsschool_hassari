import { useState, useEffect } from "react";

const KEY = "kips_school_info";

export interface SchoolInfo {
  name: string;
  tagline: string;
  logoUrl: string;
}

const DEFAULTS: SchoolInfo = {
  name: "KIPS School Hassari",
  tagline: "Bright Future",
  logoUrl: "/kips-logo.jpeg",
};

export function getSchoolInfo(): SchoolInfo {
  try {
    const s = localStorage.getItem(KEY);
    if (s) return { ...DEFAULTS, ...JSON.parse(s) };
  } catch {}
  return { ...DEFAULTS };
}

export function saveSchoolInfo(info: Partial<SchoolInfo>) {
  const current = getSchoolInfo();
  const updated = { ...current, ...info };
  localStorage.setItem(KEY, JSON.stringify(updated));
  window.dispatchEvent(new CustomEvent("school-info-changed", { detail: updated }));
}

export function useSchoolInfo(): SchoolInfo {
  const [info, setInfo] = useState<SchoolInfo>(getSchoolInfo);

  useEffect(() => {
    const handler = (e: Event) => {
      setInfo((e as CustomEvent<SchoolInfo>).detail);
    };
    window.addEventListener("school-info-changed", handler);
    return () => window.removeEventListener("school-info-changed", handler);
  }, []);

  return info;
}

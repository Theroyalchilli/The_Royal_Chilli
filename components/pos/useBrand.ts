"use client";

import { useEffect, useState } from "react";
import type { Brand } from "@/lib/brand-client";

// The signed-in business's name / address / logo (GET /api/auth/me), for
// till screens that don't already have it.
export function useBrand(): Brand | null {
  const [brand, setBrand] = useState<Brand | null>(null);
  useEffect(() => {
    let live = true;
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (live) setBrand(d?.brand ?? null); })
      .catch(() => {});
    return () => { live = false; };
  }, []);
  return brand;
}

"use client";

import { useEffect } from "react";

type PdfAutoPrintProps = {
  enabled?: boolean;
};

export function PdfAutoPrint({ enabled = true }: PdfAutoPrintProps) {
  useEffect(() => {
    if (!enabled) return;
    const timer = window.setTimeout(() => {
      window.print();
    }, 250);
    return () => window.clearTimeout(timer);
  }, [enabled]);

  return null;
}

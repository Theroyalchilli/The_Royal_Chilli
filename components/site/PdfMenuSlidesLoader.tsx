"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

// pdfjs-dist's ESM build breaks when Next.js evaluates it during SSR
// ("Object.defineProperty called on non-object") — ssr:false keeps it out
// of the server bundle entirely, only ever loading in the browser. A Server
// Component can't pass ssr:false to next/dynamic directly, hence this small
// client wrapper sitting between the menu page and the real component.
const PdfMenuSlides = dynamic(() => import("./PdfMenuSlides"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[70vh] items-center justify-center">
      <Loader2 className="animate-spin text-primary" size={32} />
    </div>
  ),
});

export default function PdfMenuSlidesLoader({ files }: { files: string[] }) {
  return <PdfMenuSlides files={files} />;
}

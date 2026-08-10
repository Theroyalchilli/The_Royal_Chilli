"use client";

import { useEffect, useState, useCallback } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

// Self-hosting the worker would mean keeping a copy in sync with whatever
// version npm resolves; pinning it to the exact bundled version via CDN
// avoids that drift entirely.
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

// Multiple PDF files (if more ever get added to public/menu-pdf) are
// flattened into one continuous slideshow — advancing past the last page of
// one file moves into the first page of the next, so it reads as a single
// menu rather than separate documents.
export default function PdfMenuSlides({ files }: { files: string[] }) {
  const [fileIndex, setFileIndex] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageWidth, setPageWidth] = useState(800);

  useEffect(() => {
    const update = () => setPageWidth(Math.min(window.innerWidth - 32, 900));
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const goNext = useCallback(() => {
    if (numPages && pageNumber < numPages) {
      setPageNumber((p) => p + 1);
    } else if (fileIndex < files.length - 1) {
      setFileIndex((i) => i + 1);
      setPageNumber(1);
      setNumPages(null);
    }
  }, [numPages, pageNumber, fileIndex, files.length]);

  const goPrev = useCallback(() => {
    if (pageNumber > 1) {
      setPageNumber((p) => p - 1);
    } else if (fileIndex > 0) {
      setFileIndex((i) => i - 1);
      setPageNumber(-1); // resolved to the last page once that file's numPages loads
      setNumPages(null);
    }
  }, [pageNumber, fileIndex]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft") goPrev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goNext, goPrev]);

  const isFirstSlide = fileIndex === 0 && pageNumber === 1;
  const isLastSlide = fileIndex === files.length - 1 && numPages != null && pageNumber === numPages;

  if (files.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center text-muted-foreground">
        No menu is available to view right now — please check back soon, or call us.
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col items-center px-4 pb-20">
      <div className="relative w-full">
        <Document
          key={files[fileIndex]}
          file={files[fileIndex]}
          loading={
            <div className="flex h-[70vh] items-center justify-center">
              <Loader2 className="animate-spin text-primary" size={32} />
            </div>
          }
          error={
            <div className="flex h-[40vh] items-center justify-center text-center text-muted-foreground">
              Couldn&apos;t load the menu. Please refresh, or call us to hear today&apos;s menu.
            </div>
          }
          onLoadSuccess={({ numPages: n }) => {
            setNumPages(n);
            // Coming from "previous file" — land on its last page, not page 1.
            setPageNumber((p) => (p === -1 ? n : p));
          }}
          className="flex justify-center"
        >
          <Page
            pageNumber={pageNumber > 0 ? pageNumber : 1}
            width={pageWidth}
            renderTextLayer={false}
            renderAnnotationLayer={false}
            className="overflow-hidden rounded-xl shadow-lg"
          />
        </Document>

        {!isFirstSlide && (
          <button
            onClick={goPrev}
            aria-label="Previous page"
            className="absolute left-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-background/90 text-foreground shadow-md hover:bg-background sm:-left-4"
          >
            <ChevronLeft size={22} />
          </button>
        )}
        {!isLastSlide && (
          <button
            onClick={goNext}
            aria-label="Next page"
            className="absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-background/90 text-foreground shadow-md hover:bg-background sm:-right-4"
          >
            <ChevronRight size={22} />
          </button>
        )}
      </div>

      {numPages != null && (
        <p className="mt-4 text-sm text-muted-foreground">
          Page {pageNumber} of {numPages}
          {files.length > 1 && ` · Menu ${fileIndex + 1} of ${files.length}`}
        </p>
      )}
    </div>
  );
}

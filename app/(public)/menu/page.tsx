import fs from "fs";
import path from "path";
import Link from "next/link";
import type { Metadata } from "next";
import PdfMenuSlides from "@/components/site/PdfMenuSlidesLoader";

export const metadata: Metadata = {
  title: "Kitchen Menu — The Royal Chilli",
  description: "Browse our full menu of authentic North and South Indian dishes — tandoori, biryani, curries, breads, and more. Order online for collection or delivery.",
};

// PDFs dropped into public/menu-pdf show up here automatically — no code
// change needed to add/replace/remove a menu, just swap the file(s) and
// redeploy (public/ is part of the build output, same as the gallery photos).
function getMenuPdfFiles(): string[] {
  const dir = path.join(process.cwd(), "public", "menu-pdf");
  try {
    return fs
      .readdirSync(dir)
      .filter((f) => f.toLowerCase().endsWith(".pdf"))
      .sort()
      .map((f) => `/menu-pdf/${encodeURIComponent(f)}`);
  } catch {
    return [];
  }
}

export default function MenuPage() {
  const files = getMenuPdfFiles();

  return (
    <div>
      <div className="mx-auto max-w-4xl px-4 py-16 text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-primary">Our Menu</p>
        <h1 className="mt-3 font-[family-name:var(--font-playfair)] text-4xl">
          Taste the <span className="italic text-primary">Royal Difference</span>
        </h1>
        <Link
          href="/order"
          className="mt-8 inline-block border border-primary px-8 py-3 text-xs uppercase tracking-[0.15em] text-primary transition hover:bg-primary hover:text-primary-foreground"
        >
          Order Online
        </Link>
      </div>

      <PdfMenuSlides files={files} />
    </div>
  );
}

import Image from "next/image";
import type { Metadata } from "next";
import fs from "fs";
import path from "path";
import Reveal from "@/components/site/Reveal";
import { siteContent } from "@/lib/site-content";

export const metadata: Metadata = {
  title: "Gallery — The Royal Chilli",
  description: "A taste of what's on the menu at The Royal Chilli, Hounslow — real dishes, real photos.",
};

function captionFromFilename(file: string) {
  return file
    .replace(/\.webp$/, "")
    .replace(/^\d+_/, "") // drop duplicate-upload timestamp prefixes
    .replace(/_/g, " ");
}

// The 6 designed promo posters now live only in the homepage's Most Popular
// Dishes section (siteContent.popularDishes) — excluded here so they don't
// also show up in this page.
const POPULAR_DISH_FILES = siteContent.popularDishes.images.map((src) => src.replace("/gallery/", ""));

export default function GalleryPage() {
  const galleryDir = path.join(process.cwd(), "public", "gallery");
  const files = fs.readdirSync(galleryDir).filter((f) => f.endsWith(".webp"));

  // A few dishes were uploaded twice under different filenames — show each dish once.
  const seen = new Set<string>();
  const photos = files
    .filter((file) => !POPULAR_DISH_FILES.includes(file))
    .map((file) => ({ file, caption: captionFromFilename(file) }))
    .filter(({ caption }) => {
      const key = caption.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.caption.localeCompare(b.caption));

  return (
    <div className="mx-auto max-w-6xl px-4 py-16">
      <Reveal className="text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-primary">Gallery</p>
        <h1 className="mt-3 font-[family-name:var(--font-playfair)] text-4xl">
          A Taste of <span className="italic text-primary">The Royal Chilli</span>
        </h1>
      </Reveal>

      <div className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {photos.map(({ file, caption }, i) => (
          <Reveal key={file} delay={(i % 8) * 60} className="group relative aspect-square overflow-hidden rounded-xl">
            <Image
              src={`/gallery/${file}`}
              alt={caption}
              fill
              sizes="(min-width: 768px) 25vw, (min-width: 640px) 33vw, 50vw"
              className="object-cover transition group-hover:scale-105"
            />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-1.5 opacity-0 transition group-hover:opacity-100">
              <p className="text-xs font-medium text-white">{caption}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </div>
  );
}

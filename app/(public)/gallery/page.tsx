import Image from "next/image";
import type { Metadata } from "next";
import fs from "fs";
import path from "path";
import Reveal from "@/components/site/Reveal";

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

// These are designed promo posters (logo, taglines, callouts) rather than
// plain dish photos, so cropping them into the square grid like the rest of
// the gallery would cut off text. They lead the gallery in this exact order,
// each kept at its full ~4:5 poster shape with nothing cropped off; the rest
// of the gallery (plain dish photos) follows, square-cropped as before.
const FEATURED_FIRST = [
  "Where_Hounslow_Meets_Indian_Soul.webp",
  "Nalli_Gosht_Biryani_Special.webp",
  "Bheja_Fry_Special.webp",
  "Volcano_Garlic_Prawns.webp",
  "Chilli_Chicken_Special.webp",
  "Pistachio_Lamb_Chops.webp",
];

export default function GalleryPage() {
  const galleryDir = path.join(process.cwd(), "public", "gallery");
  const files = fs.readdirSync(galleryDir).filter((f) => f.endsWith(".webp"));

  // A few dishes were uploaded twice under different filenames — show each dish once.
  const seen = new Set<string>();
  const rest = files
    .filter((file) => !FEATURED_FIRST.includes(file))
    .map((file) => ({ file, caption: captionFromFilename(file) }))
    .filter(({ caption }) => {
      const key = caption.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.caption.localeCompare(b.caption));

  const featured = FEATURED_FIRST.filter((file) => files.includes(file)).map((file) => ({
    file,
    caption: captionFromFilename(file),
  }));
  const photos = [...featured, ...rest];

  return (
    <div className="mx-auto max-w-6xl px-4 py-16">
      <Reveal className="text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-primary">Gallery</p>
        <h1 className="mt-3 font-[family-name:var(--font-playfair)] text-4xl">
          A Taste of <span className="italic text-primary">The Royal Chilli</span>
        </h1>
      </Reveal>

      <div className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {photos.map(({ file, caption }, i) => {
          const isFeatured = FEATURED_FIRST.includes(file);
          return (
            <Reveal
              key={file}
              delay={(i % 8) * 60}
              className={`group relative overflow-hidden rounded-xl ${isFeatured ? "aspect-[4/5] bg-neutral-950" : "aspect-square"}`}
            >
              <Image
                src={`/gallery/${file}`}
                alt={caption}
                fill
                className={`transition group-hover:scale-105 ${isFeatured ? "object-contain" : "object-cover"}`}
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-1.5 opacity-0 transition group-hover:opacity-100">
                <p className="text-xs font-medium text-white">{caption}</p>
              </div>
            </Reveal>
          );
        })}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

// Only ever mounts ONE hero image at a time (not all of them stacked with
// opacity-0) — measured via Lighthouse that stacking all 4 competed for
// mobile bandwidth with the one image that actually needs to paint first.
//
// The fade-in animation is deliberately skipped on the very first image:
// Chrome doesn't count an element as "painted" for LCP until its opacity
// animation has progressed, so animating the FIRST hero image in from
// opacity:0 was adding ~1.3s of pure LCP delay for a purely cosmetic effect
// nobody sees anyway (there's nothing to fade in from on initial load).
// Only rotations after that get the fade.
export default function HeroBackground({ images }: { images: string[] }) {
  const [active, setActive] = useState(0);
  const [hasRotated, setHasRotated] = useState(false);

  useEffect(() => {
    if (images.length <= 1) return;
    const interval = setInterval(() => {
      setActive((i) => (i + 1) % images.length);
      setHasRotated(true);
    }, 6000);
    return () => clearInterval(interval);
  }, [images.length]);

  return (
    <Image
      key={active}
      src={images[active]}
      alt=""
      fill
      priority={active === 0}
      fetchPriority={active === 0 ? "high" : "auto"}
      className={`object-cover ${hasRotated ? "animate-hero-fade" : ""}`}
    />
  );
}

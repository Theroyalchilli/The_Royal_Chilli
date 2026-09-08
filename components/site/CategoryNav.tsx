"use client";

import { useEffect, useRef, useState } from "react";
import type { MenuCategory } from "@/lib/menu";

export function slugify(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export function useCategoryNav(categories: MenuCategory[]) {
  const [activeCategory, setActiveCategory] = useState<number | null>(categories[0]?.id ?? null);
  const sectionRefs = useRef<Record<number, HTMLElement | null>>({});
  const navRefs = useRef<Record<number, HTMLAnchorElement | null>>({});
  const navScrollerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) {
          const id = Number(visible.target.getAttribute("data-category-id"));
          setActiveCategory(id);
        }
      },
      { rootMargin: "-110px 0px -70% 0px", threshold: 0 }
    );
    Object.values(sectionRefs.current).forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, [categories]);

  useEffect(() => {
    if (activeCategory == null) return;
    const link = navRefs.current[activeCategory];
    const scroller = navScrollerRef.current;
    if (!link || !scroller) return;
    const linkRect = link.getBoundingClientRect();
    const scrollerRect = scroller.getBoundingClientRect();
    const linkLeft = linkRect.left - scrollerRect.left + scroller.scrollLeft;
    const linkRight = linkLeft + linkRect.width;
    if (linkLeft < scroller.scrollLeft || linkRight > scroller.scrollLeft + scroller.clientWidth) {
      scroller.scrollTo({ left: linkLeft - 16, behavior: "smooth" });
    }
  }, [activeCategory]);

  function jumpTo(id: number) {
    const el = sectionRefs.current[id];
    if (!el) return;
    setActiveCategory(id);
    const offset = window.innerWidth < 768 ? 80 : 120;
    const top = el.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top, behavior: "smooth" });
  }

  return { activeCategory, sectionRefs, navRefs, navScrollerRef, jumpTo };
}

export function CategoryNavBar({
  categories,
  activeCategory,
  navRefs,
  navScrollerRef,
  jumpTo,
}: {
  categories: MenuCategory[];
  activeCategory: number | null;
  navRefs: React.RefObject<Record<number, HTMLAnchorElement | null>>;
  navScrollerRef: React.RefObject<HTMLDivElement | null>;
  jumpTo: (id: number) => void;
}) {
  return (
    <nav
      ref={navScrollerRef}
      className="sticky top-0 z-30 flex w-full gap-2 overflow-x-auto whitespace-nowrap border-y border-border bg-background/95 px-4 py-3 text-sm backdrop-blur [scrollbar-width:none] md:flex-wrap md:justify-center md:overflow-visible md:whitespace-normal [&::-webkit-scrollbar]:hidden"
    >
      {categories.map((category) => {
        const isActive = activeCategory === category.id;
        return (
          <a
            key={category.id}
            ref={(el) => { navRefs.current[category.id] = el; }}
            href={`#${slugify(category.name)}`}
            onClick={(e) => {
              e.preventDefault();
              jumpTo(category.id);
            }}
            className={`flex-shrink-0 rounded-full border px-4 py-1.5 font-medium transition-colors ${
              isActive
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border text-muted-foreground hover:border-primary hover:text-primary"
            }`}
          >
            {category.name}
          </a>
        );
      })}
    </nav>
  );
}

export function CategoryRail({
  categories,
  activeCategory,
  jumpTo,
}: {
  categories: MenuCategory[];
  activeCategory: number | null;
  jumpTo: (id: number) => void;
}) {
  return (
    <nav className="flex flex-col gap-1">
      {categories.map((category) => {
        const isActive = activeCategory === category.id;
        return (
          <button
            key={category.id}
            onClick={() => jumpTo(category.id)}
            className={`rounded-md px-3 py-2 text-left text-sm font-medium transition-colors ${
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-primary/10 hover:text-primary"
            }`}
          >
            {category.name}
          </button>
        );
      })}
    </nav>
  );
}

export function CategoryHeading({ name, count }: { name: string; count: number }) {
  return (
    <div className="flex items-center gap-3 border-b-2 border-primary/30 pb-2">
      <h2 className="font-[family-name:var(--font-playfair)] text-2xl text-primary">{name}</h2>
      <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">{count}</span>
    </div>
  );
}

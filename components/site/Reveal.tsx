"use client";

import { useEffect, useRef, useState } from "react";

// Scroll-triggered reveal — translate-up + fade-in, styled after
// tamarindrestaurant.com's own effect (confirmed via their live CSS:
// `.out-of-view { opacity: 0; transform: translateY(30vh) }` swapping to
// `.out-of-view.am-in-view { opacity: 1; transform: translateY(0) }` via a
// scroll watcher). Same idea, native IntersectionObserver instead of their
// jQuery watcher, and a smaller translate distance (2rem vs their 30% of
// viewport height) so it reads as a polish detail rather than a slow wait.
// Reveals once and stays revealed — doesn't re-hide scrolling back up.
export default function Reveal({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.unobserve(el);
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -10% 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={{ transitionDelay: visible ? `${delay}ms` : "0ms" }}
      className={`transition-all duration-700 ease-[cubic-bezier(0.25,0.1,0.25,1)] ${
        visible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
      } ${className}`}
    >
      {children}
    </div>
  );
}

"use client";

// Adapted from kokonutui.com's free "shimmer-text" component (MIT), restyled
// to sweep through the site's own primary (chilli-red) accent instead of the
// library's default neutral gradient, and stripped of its standalone
// wrapper so it drops straight into the existing hero heading markup.
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

export default function ShimmerHeadline({ text, className }: { text: string; className?: string }) {
  return (
    <motion.span
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="block"
    >
      <motion.span
        animate={{ backgroundPosition: ["200% center", "-200% center"] }}
        transition={{ duration: 3, ease: "linear", repeat: Infinity }}
        className={cn(
          "bg-[length:200%_100%] bg-clip-text text-transparent",
          "bg-gradient-to-r from-primary/90 via-white/80 to-primary/90",
          className
        )}
      >
        {text}
      </motion.span>
    </motion.span>
  );
}

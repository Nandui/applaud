"use client";

import { motion, useReducedMotion } from "framer-motion";

/**
 * Re-mounts on every navigation, so each screen eases in like a native push.
 * Opacity + a few pixels of lift only: enough to feel fluid, short enough
 * (180ms) to never feel slow.
 */
export default function AppTemplate({ children }: { children: React.ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}

"use client";

import { motion, MotionConfig, useReducedMotion } from "motion/react";

export function Reveal({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <MotionConfig reducedMotion="user">
      <motion.div
        className={className}
        initial={reduceMotion ? false : { y: 16 }}
        whileInView={{ y: 0 }}
        viewport={{ once: true, margin: "120px" }}
        transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
      >
        {children}
      </motion.div>
    </MotionConfig>
  );
}

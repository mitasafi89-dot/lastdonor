'use client';

import { type ReactNode } from 'react';
import { motion, type Variants } from 'motion/react';
import { cn } from '@/lib/utils';
import { fadeInUp } from '@/lib/animations';

interface AnimateOnScrollProps {
  children: ReactNode;
  variants?: Variants;
  /** Element tag to render: 'div' | 'section' */
  as?: 'div' | 'section';
  className?: string;
}

export function AnimateOnScroll({
  children,
  variants = fadeInUp,
  className,
  as = 'div',
}: AnimateOnScrollProps) {
  const Component = as === 'section' ? motion.section : motion.div;
  return (
    <Component
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-80px' }}
      variants={variants}
      className={cn(className)}
    >
      {children}
    </Component>
  );
}

"use client"

import { useEffect, useRef, useState, useCallback, type ComponentPropsWithoutRef } from "react"

import { cn } from "@/lib/utils"

interface NumberTickerProps extends ComponentPropsWithoutRef<"span"> {
  value: number
  startValue?: number
  direction?: "up" | "down"
  delay?: number
  decimalPlaces?: number
}

/**
 * Lightweight number ticker using requestAnimationFrame instead of motion/react.
 * Reduces bundle size by ~15KB by eliminating useMotionValue/useSpring/useInView imports.
 */
export function NumberTicker({
  value,
  startValue = 0,
  direction = "up",
  delay = 0,
  className,
  decimalPlaces = 0,
  ...props
}: NumberTickerProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const hasAnimated = useRef(false)
  const [display, setDisplay] = useState(() => startValue)

  const formatter = useCallback(
    (n: number) =>
      Intl.NumberFormat("en-US", {
        minimumFractionDigits: decimalPlaces,
        maximumFractionDigits: decimalPlaces,
      }).format(n),
    [decimalPlaces]
  )

  useEffect(() => {
    const el = ref.current
    if (!el) return

    let timerId: ReturnType<typeof setTimeout> | undefined
    let rafId: number | undefined
    let cancelled = false

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated.current) {
          hasAnimated.current = true
          observer.disconnect()

          const from = direction === "down" ? value : startValue
          const to = direction === "down" ? startValue : value
          const duration = 1200 // ms
          const delayMs = delay * 1000

          timerId = setTimeout(() => {
            const startTime = performance.now()

            function tick(now: number) {
              if (cancelled) return
              const elapsed = now - startTime
              const progress = Math.min(elapsed / duration, 1)
              // Ease-out cubic
              const eased = 1 - Math.pow(1 - progress, 3)
              const current = from + (to - from) * eased

              setDisplay(Number(current.toFixed(decimalPlaces)))

              if (progress < 1) {
                rafId = requestAnimationFrame(tick)
              }
            }

            rafId = requestAnimationFrame(tick)
          }, delayMs)
        }
      },
      { threshold: 0.1 }
    )

    observer.observe(el)
    return () => {
      cancelled = true
      observer.disconnect()
      if (timerId !== undefined) clearTimeout(timerId)
      if (rafId !== undefined) cancelAnimationFrame(rafId)
    }
  }, [value, startValue, direction, delay, decimalPlaces])

  return (
    <span
      ref={ref}
      className={cn(
        "inline-block tracking-wider text-black tabular-nums dark:text-white",
        className
      )}
      {...props}
    >
      {formatter(display)}
    </span>
  )
}

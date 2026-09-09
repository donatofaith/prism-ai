"use client";

import {
  useEffect,
  useRef,
  useState,
} from "react";

type AnimatedMetricProps = {
  label: string;

  value: number;

  prefix?: string;

  suffix?: string;

  decimals?: number;

  detail?: string;

  className?: string;
};

export default function AnimatedMetric({
  label,
  value,
  prefix = "",
  suffix = "",
  decimals = 0,
  detail,
  className = "",
}: AnimatedMetricProps) {
  const [
    displayValue,
    setDisplayValue,
  ] =
    useState(0);

  const [
    flashed,
    setFlashed,
  ] =
    useState(false);

  const previousValueRef =
    useRef(0);

  useEffect(() => {
    const startValue =
      previousValueRef.current;

    const endValue =
      Number.isFinite(value)
        ? value
        : 0;

    const duration =
      700;

    const startTime =
      performance.now();

    let frameId =
      0;

    function animate(
      now: number
    ) {
      const elapsed =
        now - startTime;

      const progress =
        Math.min(
          elapsed /
            duration,
          1
        );

      const eased =
        1 -
        Math.pow(
          1 -
            progress,
          3
        );

      const nextValue =
        startValue +
        (endValue -
          startValue) *
          eased;

      setDisplayValue(
        nextValue
      );

      if (
        progress <
        1
      ) {
        frameId =
          requestAnimationFrame(
            animate
          );
      } else {
        previousValueRef.current =
          endValue;
      }
    }

    frameId =
      requestAnimationFrame(
        animate
      );

    setFlashed(
      true
    );

    const flashTimer =
      window.setTimeout(
        () => {
          setFlashed(
            false
          );
        },
        650
      );

    return () => {
      cancelAnimationFrame(
        frameId
      );

      window.clearTimeout(
        flashTimer
      );
    };
  }, [
    value,
  ]);

  const formattedValue =
    displayValue.toLocaleString(
      undefined,
      {
        minimumFractionDigits:
          decimals,

        maximumFractionDigits:
          decimals,
      }
    );

  return (
    <div
      className={`relative overflow-hidden rounded-[18px] border bg-[#F9FBFC] p-4 transition-all duration-300 hover:-translate-y-1 hover:bg-white hover:shadow-md ${
        flashed
          ? "border-[#BFC8FF] shadow-[0_10px_30px_rgba(70,95,255,0.10)]"
          : "border-[#E3E8EE]"
      } ${className}`}
    >
      <div
        className={`pointer-events-none absolute inset-0 transition-opacity duration-500 ${
          flashed
            ? "opacity-100"
            : "opacity-0"
        }`}
      >
        <div className="absolute -right-8 -top-8 h-20 w-20 rounded-full bg-[#465FFF]/10 blur-2xl" />

        <div className="absolute -bottom-8 -left-8 h-20 w-20 rounded-full bg-[#16B8A6]/10 blur-2xl" />
      </div>

      <div className="relative">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-medium text-[#69788A]">
            {label}
          </p>

          <span
            className={`h-1.5 w-1.5 rounded-full transition-all duration-300 ${
              flashed
                ? "scale-125 bg-[#16B8A6] shadow-[0_0_10px_rgba(22,184,166,0.7)]"
                : "bg-[#CBD3DC]"
            }`}
          />
        </div>

        <p className="mt-2 text-xl font-semibold tracking-[-0.025em] text-[#0D1726]">
          {prefix}
          {formattedValue}
          {suffix}
        </p>

        {detail && (
          <p className="mt-1 text-[11px] leading-5 text-[#98A5B5]">
            {detail}
          </p>
        )}
      </div>
    </div>
  );
}
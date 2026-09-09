"use client";

import {
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";

type ResultRevealProps = {
  children: ReactNode;
  className?: string;
  delay?: number;
  once?: boolean;
};

export default function ResultReveal({
  children,
  className = "",
  delay = 0,
  once = true,
}: ResultRevealProps) {
  const ref =
    useRef<HTMLDivElement | null>(
      null
    );

  const [
    visible,
    setVisible,
  ] =
    useState(false);

  useEffect(() => {
    const element =
      ref.current;

    if (!element) {
      return;
    }

    const observer =
      new IntersectionObserver(
        (entries) => {
          const entry =
            entries[0];

          if (
            entry.isIntersecting
          ) {
            setVisible(
              true
            );

            if (once) {
              observer.disconnect();
            }
          } else if (
            !once
          ) {
            setVisible(
              false
            );
          }
        },
        {
          threshold:
            0.08,

          rootMargin:
            "0px 0px -8% 0px",
        }
      );

    observer.observe(
      element
    );

    return () => {
      observer.disconnect();
    };
  }, [
    once,
  ]);

  return (
    <div
      ref={ref}
      style={{
        transitionDelay:
          `${delay}ms`,
      }}
      className={`transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${
        visible
          ? "translate-y-0 opacity-100"
          : "translate-y-5 opacity-0"
      } ${className}`}
    >
      {children}
    </div>
  );
}
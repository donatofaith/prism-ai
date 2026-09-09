"use client";

import { useEffect, useState } from "react";

type NavItem = {
  id: string;
  label: string;
  shortLabel: string;
};

const items: NavItem[] = [
  {
    id: "scan",
    label: "Scan",
    shortLabel: "Scan",
  },
  {
    id: "market-investigation",
    label: "Market",
    shortLabel: "Market",
  },
  {
    id: "perspective",
    label: "Perspective",
    shortLabel: "View",
  },
  {
    id: "replay",
    label: "Replay",
    shortLabel: "Replay",
  },
  {
    id: "wallet",
    label: "Accounts",
    shortLabel: "Accounts",
  },
  {
    id: "watchlist",
    label: "Watchlist",
    shortLabel: "Saved",
  },
];

export default function InvestigationNav() {
  const [activeSection, setActiveSection] =
    useState("scan");

  useEffect(() => {
    const sections = items
      .map((item) =>
        document.getElementById(item.id)
      )
      .filter(
        (
          section
        ): section is HTMLElement =>
          Boolean(section)
      );

    if (sections.length === 0) {
      return;
    }

    const observer =
      new IntersectionObserver(
        (entries) => {
          const visible = entries
            .filter(
              (entry) =>
                entry.isIntersecting
            )
            .sort(
              (a, b) =>
                b.intersectionRatio -
                a.intersectionRatio
            );

          if (visible.length > 0) {
            setActiveSection(
              visible[0].target.id
            );
          }
        },
        {
          rootMargin:
            "-25% 0px -60% 0px",
          threshold: [
            0,
            0.1,
            0.25,
            0.5,
          ],
        }
      );

    sections.forEach(
      (section) =>
        observer.observe(
          section
        )
    );

    return () => {
      observer.disconnect();
    };
  }, []);

  function goToSection(
    id: string
  ) {
    const element =
      document.getElementById(
        id
      );

    if (!element) {
      return;
    }

    element.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  return (
    <div className="sticky top-[68px] z-40 border-b border-[#E3E8EE] bg-[#F7F9FC]/92 backdrop-blur-xl sm:top-[72px]">
      <div className="prism-container">
        <div className="flex items-center gap-2 overflow-x-auto py-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {items.map(
            (
              item,
              index
            ) => {
              const active =
                activeSection ===
                item.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() =>
                    goToSection(
                      item.id
                    )
                  }
                  className={`group relative flex h-10 shrink-0 items-center gap-2 rounded-xl px-3.5 text-xs font-semibold transition-all duration-200 sm:px-4 ${
                    active
                      ? "bg-[#0D1726] text-white shadow-[0_8px_22px_rgba(13,23,38,0.14)]"
                      : "text-[#69788A] hover:bg-white hover:text-[#0D1726] hover:shadow-sm"
                  }`}
                >
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-md text-[8px] font-bold transition ${
                      active
                        ? "bg-white/10 text-[#8CE2D7]"
                        : "bg-[#EEF1FF] text-[#465FFF]"
                    }`}
                  >
                    {String(
                      index + 1
                    ).padStart(
                      2,
                      "0"
                    )}
                  </span>

                  <span className="hidden sm:inline">
                    {item.label}
                  </span>

                  <span className="sm:hidden">
                    {item.shortLabel}
                  </span>

                  {active && (
                    <span className="ml-0.5 h-1.5 w-1.5 rounded-full bg-[#16B8A6] shadow-[0_0_8px_rgba(22,184,166,0.7)]" />
                  )}
                </button>
              );
            }
          )}

          <div className="ml-auto hidden shrink-0 items-center gap-2 pl-4 text-[10px] font-medium uppercase tracking-[0.1em] text-[#98A5B5] lg:flex">
            <span className="prism-live-dot" />

            Navigation synced
          </div>
        </div>
      </div>
    </div>
  );
}
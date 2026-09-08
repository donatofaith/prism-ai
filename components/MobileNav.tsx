"use client";

import { useEffect, useState } from "react";

type NavItem = {
  label: string;
  href: string;
};

type MobileNavProps = {
  items: NavItem[];
};

export default function MobileNav({
  items,
}: MobileNavProps) {
  const [
    open,
    setOpen,
  ] =
    useState(false);

  useEffect(() => {
    function handleKeyDown(
      event: KeyboardEvent
    ) {
      if (
        event.key ===
        "Escape"
      ) {
        setOpen(false);
      }
    }

    window.addEventListener(
      "keydown",
      handleKeyDown
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyDown
      );
    };
  }, []);

  useEffect(() => {
    if (!open) {
      document.body.style.overflow =
        "";

      return;
    }

    document.body.style.overflow =
      "hidden";

    return () => {
      document.body.style.overflow =
        "";
    };
  }, [open]);

  function closeMenu() {
    setOpen(false);
  }

  return (
    <div className="lg:hidden">
      <button
        type="button"
        aria-label={
          open
            ? "Close navigation"
            : "Open navigation"
        }
        aria-expanded={open}
        onClick={() =>
          setOpen(
            (current) =>
              !current
          )
        }
        className="flex h-10 w-10 items-center justify-center rounded-[13px] border border-[#E3E8EE] bg-white text-[#0D1726] shadow-sm transition hover:bg-[#F7F9FC]"
      >
        <span className="relative h-[16px] w-[18px]">
          <span
            className={`absolute left-0 top-[1px] h-[2px] w-full rounded-full bg-current transition duration-200 ${
              open
                ? "translate-y-[6px] rotate-45"
                : ""
            }`}
          />

          <span
            className={`absolute left-0 top-[7px] h-[2px] w-full rounded-full bg-current transition duration-200 ${
              open
                ? "opacity-0"
                : ""
            }`}
          />

          <span
            className={`absolute left-0 top-[13px] h-[2px] w-full rounded-full bg-current transition duration-200 ${
              open
                ? "-translate-y-[6px] -rotate-45"
                : ""
            }`}
          />
        </span>
      </button>

      {open && (
        <div className="fixed inset-0 z-[100]">
          <button
            type="button"
            aria-label="Close navigation"
            onClick={
              closeMenu
            }
            className="absolute inset-0 bg-[#0D1726]/20 backdrop-blur-[3px]"
          />

          <div className="absolute inset-x-3 top-3 overflow-hidden rounded-[24px] border border-[#E3E8EE] bg-white shadow-[0_24px_80px_rgba(13,23,38,0.18)] sm:left-auto sm:right-4 sm:w-[380px]">
            <div className="flex items-center justify-between border-b border-[#E3E8EE] px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-[13px] bg-[#0D1726]">
                  <div className="absolute -left-2 top-0 h-7 w-7 rounded-full bg-[#465FFF]/70 blur-md" />

                  <div className="absolute -bottom-2 -right-1 h-7 w-7 rounded-full bg-[#16B8A6]/60 blur-md" />

                  <span className="relative text-sm font-bold text-white">
                    P
                  </span>
                </div>

                <div>
                  <p className="text-sm font-bold tracking-[-0.02em] text-[#0D1726]">
                    PRISM
                  </p>

                  <p className="text-[10px] text-[#98A5B5]">
                    Crypto Intelligence Desk
                  </p>
                </div>
              </div>

              <button
                type="button"
                aria-label="Close navigation"
                onClick={
                  closeMenu
                }
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#E3E8EE] bg-[#F9FBFC] text-lg text-[#69788A]"
              >
                ×
              </button>
            </div>

            <div className="p-3">
              <div className="space-y-1">
                {items.map(
                  (
                    item,
                    index
                  ) => (
                    <a
                      key={
                        item.href
                      }
                      href={
                        item.href
                      }
                      onClick={
                        closeMenu
                      }
                      className="group flex items-center gap-4 rounded-[16px] px-4 py-3.5 transition hover:bg-[#F3F6F8]"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#EEF1FF] text-[11px] font-bold text-[#465FFF]">
                        {String(
                          index + 1
                        ).padStart(
                          2,
                          "0"
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-[#0D1726]">
                          {
                            item.label
                          }
                        </p>

                        <p className="mt-0.5 text-[11px] text-[#98A5B5]">
                          {item.label ===
                          "Scan"
                            ? "Start a new investigation"
                            : item.label ===
                              "Perspective"
                            ? "Read the evidence synthesis"
                            : item.label ===
                              "Replay"
                            ? "Compare historical analogues"
                            : item.label ===
                              "Accounts"
                            ? "Inspect on-chain activity"
                            : "Reopen saved intelligence"}
                        </p>
                      </div>

                      <span className="text-sm text-[#CBD3DC] transition group-hover:translate-x-0.5 group-hover:text-[#465FFF]">
                        →
                      </span>
                    </a>
                  )
                )}
              </div>

              <div className="mt-3 rounded-[18px] bg-[#0D1726] p-4 text-white">
                <div className="flex items-center gap-2">
                  <span className="prism-live-dot" />

                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/50">
                    PRISM status
                  </p>
                </div>

                <p className="mt-3 text-sm font-medium">
                  Intelligence engine online
                </p>

                <p className="mt-1 text-[11px] leading-5 text-white/45">
                  Ethereum, Arbitrum and Solana account scanning connected.
                </p>

                <a
                  href="#scan"
                  onClick={
                    closeMenu
                  }
                  className="mt-4 flex h-10 items-center justify-center rounded-xl bg-white text-xs font-semibold text-[#0D1726]"
                >
                  Start new scan
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
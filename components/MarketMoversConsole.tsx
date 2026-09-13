"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

type Source = "all" | "binance" | "bybit" | "okx" | "mexc";
type View = "gainers" | "losers" | "volume";
type DataProvider = "direct" | "coingecko-fallback";

type Mover = {
  id: string;
  symbol: string;
  name: string;
  pair: string;
  price: number;
  change24h: number;
  volume24hUsd: number | null;
  marketCap: number | null;
  image: string | null;
  source: Source;
};

type MoversResponse = {
  source: Source;
  view: View;
  provider?: DataProvider;
  generatedAt: string;
  methodology: string;
  movers: Mover[];
  error?: string;
};

const SOURCES: Array<{ id: Source; label: string }> = [
  { id: "all", label: "All market" },
  { id: "binance", label: "Binance" },
  { id: "bybit", label: "Bybit" },
  { id: "okx", label: "OKX" },
  { id: "mexc", label: "MEXC" },
];

const VIEWS: Array<{ id: View; label: string }> = [
  { id: "gainers", label: "Gainers" },
  { id: "losers", label: "Losers" },
  { id: "volume", label: "Volume" },
];

function formatPrice(value: number) {
  if (value >= 1000) return `$${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  if (value >= 1) return `$${value.toLocaleString(undefined, { maximumFractionDigits: 4 })}`;
  if (value >= 0.01) return `$${value.toLocaleString(undefined, { maximumFractionDigits: 6 })}`;
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: 9 })}`;
}

function formatUsd(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "—";
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function sourceName(source: Source) {
  return SOURCES.find((item) => item.id === source)?.label ?? source;
}

function triggerInvestigation(symbol: string) {
  const input = document.querySelector<HTMLInputElement>(
    'input[aria-label="Search by token name, symbol, or contract address"]'
  );
  if (!input) return;

  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value"
  )?.set;
  setter?.call(input, symbol);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
  input.focus();

  const form = input.closest("form");
  if (form) {
    window.setTimeout(() => form.requestSubmit(), 0);
  } else {
    const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>("button"));
    const scanButton = buttons.find((button) => {
      const text = button.textContent?.toLowerCase() ?? "";
      return text.includes("run scan") || text.includes("investigate") || text.includes("scan token");
    });
    window.setTimeout(() => scanButton?.click(), 0);
  }

  window.setTimeout(() => {
    document.getElementById("scan")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, 80);
}

export default function MarketMoversConsole() {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [source, setSource] = useState<Source>("all");
  const [view, setView] = useState<View>("gainers");
  const [data, setData] = useState<MoversResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const resolveTarget = () => {
      const section = document.getElementById("market-investigation");
      if (!section) return;

      let host = section.querySelector<HTMLElement>("[data-prism-market-movers='true']");
      if (!host) {
        host = document.createElement("div");
        host.dataset.prismMarketMovers = "true";
        host.className = "prism-container min-w-0 overflow-hidden pb-10 sm:pb-12 lg:pb-16";
        section.appendChild(host);
      }
      setTarget(host);
    };

    resolveTarget();
    const observer = new MutationObserver(resolveTarget);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError("");
        setExpanded(false);
        const response = await fetch(`/api/market-movers?source=${source}&view=${view}`, {
          cache: "no-store",
        });
        const payload = (await response.json()) as MoversResponse;
        if (!response.ok) throw new Error(payload.error || "Market movers are temporarily unavailable.");
        if (!cancelled) setData(payload);
      } catch (caught) {
        if (!cancelled) {
          setData(null);
          setError(caught instanceof Error ? caught.message : "Market movers are temporarily unavailable.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [source, view]);

  const visibleMovers = useMemo(
    () => (expanded ? data?.movers ?? [] : (data?.movers ?? []).slice(0, 12)),
    [data, expanded]
  );

  if (!target) return null;

  return createPortal(
    <section className="w-full min-w-0 overflow-hidden rounded-[24px] border border-[#DDE5ED] bg-white shadow-[0_18px_55px_rgba(25,42,70,0.05)] dark:border-[#27384C] dark:bg-[#0E1A29]">
      <div className="border-b border-[#E8EDF2] px-4 py-5 dark:border-[#26364A] sm:px-6 lg:px-7">
        <div className="flex min-w-0 flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EEF1FF] text-sm font-black text-[#465FFF] dark:bg-[#1B2850] dark:text-[#AAB5FF]">M</div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#5A6FFF]">Live market discovery</p>
                <h2 className="mt-1 text-xl font-bold tracking-[-0.03em] text-[#0D1726] dark:text-white sm:text-2xl">Market Movers</h2>
              </div>
            </div>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#69788A] dark:text-[#A9B7C8]">
              Compare whole-market movement with exchange-specific spot markets, then open any token in PRISM for deeper research.
            </p>
          </div>

          <div className="flex w-full min-w-0 flex-col gap-2 xl:w-auto xl:items-end">
            <div className="w-full max-w-full overflow-x-auto rounded-xl bg-[#F5F7FA] p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden dark:bg-[#0A1522] xl:w-auto">
              <div className="flex w-max min-w-full gap-1.5 xl:min-w-0">
                {SOURCES.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSource(item.id)}
                    className={`shrink-0 rounded-lg px-3 py-2 text-xs font-semibold transition ${
                      source === item.id
                        ? "bg-white text-[#172235] shadow-sm dark:bg-[#1A2A3D] dark:text-white"
                        : "text-[#748397] hover:text-[#172235] dark:text-[#8FA0B4] dark:hover:text-white"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {VIEWS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setView(item.id)}
                  className={`rounded-full px-3 py-1.5 text-[11px] font-semibold transition ${
                    view === item.id
                      ? "bg-[#172235] text-white dark:bg-white dark:text-[#0D1726]"
                      : "bg-[#F2F5F8] text-[#66768A] dark:bg-[#142235] dark:text-[#A9B7C8]"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="min-w-0 px-4 py-4 sm:px-6 lg:px-7">
        <div className="mb-3 flex flex-col gap-1.5 text-[11px] text-[#8390A0] dark:text-[#8FA0B4] sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-2">
          <span>
            {source === "all" ? "Whole market · CoinGecko" : `${sourceName(source)} spot markets`} · 24h snapshot
          </span>
          <span>Movement is research context, not a buy/sell signal.</span>
        </div>

        {source === "bybit" && data?.provider === "coingecko-fallback" && !loading && !error ? (
          <div className="mb-3 rounded-xl border border-[#DDE5ED] bg-[#F8FAFC] px-3 py-2 text-[10px] leading-5 text-[#6E7D90] dark:border-[#2A3C52] dark:bg-[#101E2E] dark:text-[#9FB0C3]">
            Bybit&apos;s direct public feed is not reachable from this server region, so PRISM is using CoinGecko&apos;s Bybit exchange feed as a transparent fallback.
          </div>
        ) : null}

        {loading ? (
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 9 }).map((_, index) => (
              <div key={index} className="h-[132px] animate-pulse rounded-2xl bg-[#F3F6F9] dark:bg-[#122033] sm:h-[112px]" />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-[#F0D0D0] bg-[#FFF7F7] p-4 text-sm leading-6 text-[#A85A5A] dark:border-[#693838] dark:bg-[#301D22] dark:text-[#E8A6A6] sm:p-5">
            {error}
          </div>
        ) : (
          <>
            <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {visibleMovers.map((mover) => {
                const positive = mover.change24h >= 0;

                return (
                  <article
                    key={mover.id}
                    className="group min-w-0 overflow-hidden rounded-2xl border border-[#E5EAF0] bg-[#FBFCFD] p-4 transition hover:-translate-y-0.5 hover:border-[#C9D4E2] hover:shadow-[0_10px_30px_rgba(31,45,66,0.06)] dark:border-[#26374B] dark:bg-[#0A1522] dark:hover:border-[#3A506A]"
                  >
                    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-2 sm:gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#EEF1F5] text-[11px] font-bold text-[#536176] dark:bg-[#18283A] dark:text-[#C3CEDA]">
                          {mover.image ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={mover.image} alt="" className="h-full w-full object-cover" />
                          ) : (
                            mover.symbol.slice(0, 2)
                          )}
                        </div>

                        <div className="min-w-0">
                          <span className="block truncate text-sm font-bold text-[#152033] dark:text-white">{mover.symbol}</span>
                          <span className="mt-0.5 block truncate text-[10px] text-[#95A1AF] dark:text-[#73859B]">{mover.pair}</span>
                          <p className="mt-1 truncate text-[11px] text-[#7B899A] dark:text-[#8FA0B4]">
                            {source === "all" ? mover.name : sourceName(source)} · Vol {formatUsd(mover.volume24hUsd)}
                          </p>
                        </div>
                      </div>

                      <span
                        className={`shrink-0 whitespace-nowrap rounded-full px-2 py-1 text-[10px] font-bold sm:px-2.5 sm:text-[11px] ${
                          positive
                            ? "bg-[#E9F8F4] text-[#0F927F] dark:bg-[#10352F] dark:text-[#57D1BE]"
                            : "bg-[#FFF0F0] text-[#C94D4D] dark:bg-[#3A2025] dark:text-[#FF9B9B]"
                        }`}
                      >
                        {positive ? "+" : ""}{mover.change24h.toFixed(2)}%
                      </span>
                    </div>

                    <div className="mt-4 flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                      <div className="min-w-0">
                        <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-[#9AA5B2]">Current price</p>
                        <p className="mt-1 truncate text-sm font-semibold text-[#273448] dark:text-[#D7E0EA]">{formatPrice(mover.price)}</p>
                      </div>

                      <button
                        type="button"
                        onClick={() => triggerInvestigation(mover.symbol)}
                        className="w-full rounded-xl border border-[#DCE3EA] bg-white px-3 py-2.5 text-center text-[11px] font-bold text-[#465FFF] transition group-hover:border-[#BAC7D8] hover:bg-[#F4F6FF] dark:border-[#304258] dark:bg-[#132132] dark:text-[#AAB5FF] dark:hover:bg-[#1A2A3D] sm:w-auto sm:shrink-0 sm:py-2"
                      >
                        Investigate
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>

            {(data?.movers.length ?? 0) > 12 && (
              <div className="mt-4 flex justify-center">
                <button
                  type="button"
                  onClick={() => setExpanded((value) => !value)}
                  className="max-w-full rounded-full bg-[#F2F5F8] px-4 py-2 text-center text-xs font-semibold text-[#596A7F] transition hover:bg-[#E8EDF3] dark:bg-[#142235] dark:text-[#B6C2D0] dark:hover:bg-[#1B2C41]"
                >
                  {expanded ? "Show less" : `Show more ${sourceName(source)} ${view}`}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </section>,
    target
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

type UnlockEvent = {
  id: string;
  date: string;
  daysUntil: number;
  amount: number | null;
  estimatedUsdValue: number | null;
  estimatedPercentOfMarketCap: number | null;
  estimatedPercentOfCirculatingSupply: number | null;
  allocation: string;
  allocationType:
    | "team"
    | "investors"
    | "treasury"
    | "ecosystem"
    | "community"
    | "unknown";
  basis: string | null;
  contractEnforced: boolean | null;
  source: string;
};

type UnlockResponse = {
  token: {
    id?: string;
    symbol?: string;
    name?: string;
  };
  available: boolean;
  provider: string;
  providerUrl?: string;
  lastCheckedAt?: string;
  next?: UnlockEvent | null;
  events: UnlockEvent[];
  summary?: {
    eventCount: number;
    teamOrInvestorEventCount: number;
    nextImpactSize: "large" | "meaningful" | "limited" | "unknown";
    nextAllocationType: UnlockEvent["allocationType"] | null;
  };
  methodology?: {
    valuation?: string;
    circulatingSupply?: string;
    interpretation?: string;
  };
  message?: string;
};

type MarketResponse = {
  id: string;
  name: string;
  symbol: string;
  price: number;
  marketCap: number;
};

function formatUsd(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "Not available";
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function formatAmount(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "Not available";
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function formatPercent(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "Not available";
  if (value < 0.01) return "<0.01%";
  return `${value.toFixed(value < 1 ? 2 : 1)}%`;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown date";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function allocationLabel(value: UnlockEvent["allocationType"]) {
  if (value === "team") return "Team";
  if (value === "investors") return "Investors";
  if (value === "treasury") return "Treasury";
  if (value === "ecosystem") return "Ecosystem";
  if (value === "community") return "Community";
  return "Unspecified";
}

function impactLabel(value?: UnlockResponse["summary"] extends infer T
  ? T extends { nextImpactSize: infer U }
    ? U
    : never
  : never) {
  if (value === "large") return "Large relative to market cap";
  if (value === "meaningful") return "Meaningful relative to market cap";
  if (value === "limited") return "Limited relative to market cap";
  return "Impact size unavailable";
}

function findConsoleTarget() {
  const labels = Array.from(document.querySelectorAll("p"));
  const pipelineLabel = labels.find(
    (node) => node.textContent?.trim().toLowerCase() === "investigation pipeline"
  );

  const pipelineSection = pipelineLabel?.parentElement?.parentElement;
  if (!pipelineSection) return null;

  let mount = pipelineSection.querySelector<HTMLElement>("[data-prism-unlock-mount]");
  if (!mount) {
    mount = document.createElement("div");
    mount.dataset.prismUnlockMount = "true";
    mount.className = "mt-4";
    pipelineSection.appendChild(mount);
  }

  return mount;
}

export default function UnlockIntelligenceConsole() {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<UnlockResponse | null>(null);

  useEffect(() => {
    const resolveTarget = () => {
      const nextTarget = findConsoleTarget();
      if (nextTarget) setTarget(nextTarget);
    };

    resolveTarget();
    const observer = new MutationObserver(resolveTarget);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  const nextUnlock = data?.next ?? data?.events?.[0] ?? null;

  const insight = useMemo(() => {
    if (!data?.available || !nextUnlock) return null;
    const recipient = allocationLabel(nextUnlock.allocationType);
    const supply = formatPercent(nextUnlock.estimatedPercentOfCirculatingSupply);
    const timing = nextUnlock.daysUntil === 0 ? "today" : `in ${nextUnlock.daysUntil} day${nextUnlock.daysUntil === 1 ? "" : "s"}`;
    return `${recipient} allocation scheduled ${timing}. The estimated release is ${supply} of current circulating supply when that estimate is available.`;
  }, [data, nextUnlock]);

  async function loadUnlocks() {
    setOpen(true);
    setError("");

    const input = document.querySelector<HTMLInputElement>(
      'input[aria-label="Search by token name, symbol, or contract address"]'
    );
    const query = input?.value.trim() ?? "";

    if (!query) {
      setError("Run a token investigation first, then open Unlock Intelligence.");
      setData(null);
      return;
    }

    try {
      setLoading(true);
      const marketResponse = await fetch(`/api/market?q=${encodeURIComponent(query)}`, {
        cache: "no-store",
      });
      const marketPayload = await marketResponse.json();
      if (!marketResponse.ok) {
        throw new Error(marketPayload?.error || "PRISM could not resolve this token.");
      }

      const market = marketPayload as MarketResponse;
      const params = new URLSearchParams({
        id: market.id,
        symbol: market.symbol,
        name: market.name,
        price: String(market.price),
        marketCap: String(market.marketCap),
      });

      const response = await fetch(`/api/unlocks?${params.toString()}`, {
        cache: "no-store",
      });
      const payload = (await response.json()) as UnlockResponse & { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Unlock Intelligence is temporarily unavailable.");
      }

      setData(payload);
    } catch (caught) {
      setData(null);
      setError(
        caught instanceof Error
          ? caught.message
          : "Unlock Intelligence is temporarily unavailable."
      );
    } finally {
      setLoading(false);
    }
  }

  if (!target) return null;

  return createPortal(
    <div className="overflow-hidden rounded-[18px] border border-[#DDE4E9] bg-white shadow-sm transition dark:border-[#2B3A4D] dark:bg-[#101C2B]">
      <button
        type="button"
        onClick={() => {
          if (!open || !data) {
            void loadUnlocks();
          } else {
            setOpen(false);
          }
        }}
        className="flex w-full items-center justify-between gap-4 px-4 py-3.5 text-left transition hover:bg-[#F8FAFC] dark:hover:bg-[#142236]"
      >
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#FFF4DE] text-sm font-bold text-[#B56A00] dark:bg-[#3A2B16] dark:text-[#FFC66D]">
            U
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[#0D1726] dark:text-[#F5F8FC]">
              Unlock Intelligence
            </p>
            <p className="mt-1 text-xs leading-5 text-[#69788A] dark:text-[#A9B7C8]">
              Check upcoming releases, allocation and estimated supply impact.
            </p>
          </div>
        </div>
        <span className="shrink-0 rounded-full bg-[#EEF1FF] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-[#465FFF] dark:bg-[#202D54] dark:text-[#AAB5FF]">
          {loading ? "Checking" : open ? "Close" : "Open"}
        </span>
      </button>

      {open && (
        <div className="border-t border-[#E7EBF0] px-4 py-4 dark:border-[#2A394C] sm:px-5 sm:py-5">
          {loading ? (
            <div className="flex items-center gap-3 rounded-2xl bg-[#F8FAFC] px-4 py-4 dark:bg-[#0C1725]">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#465FFF]/20 border-t-[#465FFF]" />
              <div>
                <p className="text-sm font-semibold text-[#0D1726] dark:text-[#F5F8FC]">
                  Checking the unlock schedule...
                </p>
                <p className="mt-1 text-xs text-[#69788A] dark:text-[#A9B7C8]">
                  PRISM is matching this token against the current scheduled-release dataset.
                </p>
              </div>
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-[#F6CACA] bg-[#FFF4F4] px-4 py-4 text-sm leading-6 text-[#B63D3D] dark:border-[#6D3333] dark:bg-[#351D23] dark:text-[#FFAAAA]">
              {error}
            </div>
          ) : data?.available && nextUnlock ? (
            <div className="space-y-4">
              <div className="rounded-2xl bg-gradient-to-br from-[#F7F8FF] via-white to-[#F0FAF8] p-4 dark:from-[#17213A] dark:via-[#101C2B] dark:to-[#112B2B] sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#69788A] dark:text-[#9EACBD]">
                      Next scheduled release
                    </p>
                    <p className="mt-2 text-lg font-bold tracking-[-0.02em] text-[#0D1726] dark:text-white sm:text-xl">
                      {formatDate(nextUnlock.date)}
                    </p>
                    <p className="mt-1 text-xs text-[#69788A] dark:text-[#A9B7C8]">
                      {nextUnlock.daysUntil === 0
                        ? "Scheduled for today"
                        : `${nextUnlock.daysUntil} day${nextUnlock.daysUntil === 1 ? "" : "s"} away`}
                    </p>
                  </div>
                  <span className="rounded-full bg-[#FFF1D8] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-[#9A5A00] dark:bg-[#3A2B16] dark:text-[#FFC66D]">
                    {impactLabel(data.summary?.nextImpactSize)}
                  </span>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <div className="rounded-xl border border-[#E3E8EE] bg-white/80 p-3 dark:border-[#2B3A4D] dark:bg-[#0C1725]/80">
                    <p className="text-[9px] uppercase tracking-[0.1em] text-[#98A5B5]">Tokens</p>
                    <p className="mt-2 text-sm font-semibold text-[#0D1726] dark:text-white">
                      {formatAmount(nextUnlock.amount)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-[#E3E8EE] bg-white/80 p-3 dark:border-[#2B3A4D] dark:bg-[#0C1725]/80">
                    <p className="text-[9px] uppercase tracking-[0.1em] text-[#98A5B5]">Est. current value</p>
                    <p className="mt-2 text-sm font-semibold text-[#0D1726] dark:text-white">
                      {formatUsd(nextUnlock.estimatedUsdValue)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-[#E3E8EE] bg-white/80 p-3 dark:border-[#2B3A4D] dark:bg-[#0C1725]/80">
                    <p className="text-[9px] uppercase tracking-[0.1em] text-[#98A5B5]">Of market cap</p>
                    <p className="mt-2 text-sm font-semibold text-[#0D1726] dark:text-white">
                      {formatPercent(nextUnlock.estimatedPercentOfMarketCap)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-[#E3E8EE] bg-white/80 p-3 dark:border-[#2B3A4D] dark:bg-[#0C1725]/80">
                    <p className="text-[9px] uppercase tracking-[0.1em] text-[#98A5B5]">Of circulating supply</p>
                    <p className="mt-2 text-sm font-semibold text-[#0D1726] dark:text-white">
                      {formatPercent(nextUnlock.estimatedPercentOfCirculatingSupply)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-[#E3E8EE] bg-[#FAFBFC] p-4 dark:border-[#2B3A4D] dark:bg-[#0C1725]">
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#69788A] dark:text-[#9EACBD]">
                    Allocation
                  </p>
                  <p className="mt-2 text-sm font-semibold text-[#0D1726] dark:text-white">
                    {nextUnlock.allocation}
                  </p>
                  <p className="mt-1 text-xs text-[#69788A] dark:text-[#A9B7C8]">
                    Classified as {allocationLabel(nextUnlock.allocationType)}.
                  </p>
                </div>
                <div className="rounded-2xl border border-[#E3E8EE] bg-[#FAFBFC] p-4 dark:border-[#2B3A4D] dark:bg-[#0C1725]">
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#69788A] dark:text-[#9EACBD]">
                    What PRISM sees
                  </p>
                  <p className="mt-2 text-xs leading-6 text-[#405064] dark:text-[#CAD4E0]">
                    {insight}
                  </p>
                </div>
              </div>

              {data.events.length > 1 && (
                <details className="rounded-2xl border border-[#E3E8EE] bg-white dark:border-[#2B3A4D] dark:bg-[#101C2B]">
                  <summary className="cursor-pointer px-4 py-3 text-xs font-semibold text-[#405064] dark:text-[#DDE5EF]">
                    View {Math.min(data.events.length, 12)} upcoming unlock events
                  </summary>
                  <div className="divide-y divide-[#EEF2F5] border-t border-[#EEF2F5] dark:divide-[#27364A] dark:border-[#27364A]">
                    {data.events.slice(0, 6).map((event) => (
                      <div key={event.id} className="grid gap-2 px-4 py-3 text-xs sm:grid-cols-[120px_1fr_auto] sm:items-center">
                        <span className="font-semibold text-[#0D1726] dark:text-white">{formatDate(event.date)}</span>
                        <span className="text-[#69788A] dark:text-[#A9B7C8]">{event.allocation}</span>
                        <span className="font-semibold text-[#405064] dark:text-[#DDE5EF]">{formatUsd(event.estimatedUsdValue)}</span>
                      </div>
                    ))}
                  </div>
                </details>
              )}

              <div className="rounded-2xl border border-[#DDE4E9] bg-[#F8FAFC] px-4 py-3 dark:border-[#2B3A4D] dark:bg-[#0C1725]">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#69788A] dark:text-[#9EACBD]">
                  Evidence boundary
                </p>
                <p className="mt-2 text-xs leading-6 text-[#69788A] dark:text-[#A9B7C8]">
                  {data.methodology?.interpretation ||
                    "A scheduled unlock can increase available token supply, but it does not prove recipients will sell or predict future price direction."}
                </p>
              </div>
            </div>
          ) : data ? (
            <div className="rounded-2xl border border-[#E3E8EE] bg-[#F8FAFC] px-4 py-5 dark:border-[#2B3A4D] dark:bg-[#0C1725]">
              <p className="text-sm font-semibold text-[#0D1726] dark:text-white">
                No scheduled unlock found in the current data window.
              </p>
              <p className="mt-2 text-xs leading-6 text-[#69788A] dark:text-[#A9B7C8]">
                {data.message ||
                  "PRISM did not find a matching scheduled token release in the provider's current window. This does not prove that no vesting or future release exists outside that dataset."}
              </p>
            </div>
          ) : null}
        </div>
      )}
    </div>,
    target
  );
}

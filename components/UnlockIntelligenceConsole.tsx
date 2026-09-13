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
  chain?: string | null;
};

type UnlockResponse = {
  token: { id?: string; symbol?: string; name?: string };
  available: boolean;
  coverage?: "matched" | "modeled" | "not_tracked" | "provider_unavailable";
  provider: string;
  providerUrl?: string;
  secondarySourceUrl?: string | null;
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
  message?: string | null;
};

type MarketResponse = {
  id: string;
  name: string;
  symbol: string;
  price: number;
  marketCap: number;
};

function formatUsd(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "N/A";
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function formatAmount(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "N/A";
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function formatPercent(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "N/A";
  if (Math.abs(value) < 0.01) return "<0.01%";
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
  if (value === "team") return "Team / contributors";
  if (value === "investors") return "Investors";
  if (value === "treasury") return "Treasury";
  if (value === "ecosystem") return "Ecosystem";
  if (value === "community") return "Community";
  return "Multiple / unspecified";
}

function impactLabel(value?: UnlockResponse["summary"] extends infer T
  ? T extends { nextImpactSize: infer U }
    ? U
    : never
  : never) {
  if (value === "large") return "Large relative size";
  if (value === "meaningful") return "Meaningful relative size";
  if (value === "limited") return "Limited relative size";
  return "Size unavailable";
}

function getSearchQuery() {
  return (
    document
      .querySelector<HTMLInputElement>(
        'input[aria-label="Search by token name, symbol, or contract address"]'
      )
      ?.value.trim() ?? ""
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[#E4EAF0] bg-white/90 p-3.5 dark:border-[#2A3A4E] dark:bg-[#0C1725]/90 sm:p-4">
      <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-[#8A99AB] dark:text-[#8294A8]">
        {label}
      </p>
      <p className="mt-2 truncate text-sm font-bold text-[#101A2B] dark:text-white sm:text-base">
        {value}
      </p>
    </div>
  );
}

export default function UnlockIntelligenceConsole() {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<UnlockResponse | null>(null);
  const [market, setMarket] = useState<MarketResponse | null>(null);

  useEffect(() => {
    const resolveTarget = () => {
      const host = document.querySelector<HTMLElement>("[data-prism-unlock-host='true']");
      if (host) setTarget(host);
    };

    resolveTarget();
    const observer = new MutationObserver(resolveTarget);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  const nextUnlock = data?.next ?? data?.events?.[0] ?? null;

  const nextSummary = useMemo(() => {
    if (!nextUnlock) return "";
    const timing =
      nextUnlock.daysUntil === 0
        ? "today"
        : `in ${nextUnlock.daysUntil} day${nextUnlock.daysUntil === 1 ? "" : "s"}`;
    return `${nextUnlock.allocation} has a scheduled release ${timing}.`;
  }, [nextUnlock]);

  async function runUnlockInvestigation() {
    const query = getSearchQuery();
    setError("");

    if (!query) {
      setData(null);
      setMarket(null);
      setError("Run a token scan first so PRISM knows which asset to investigate.");
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

      const resolvedMarket = marketPayload as MarketResponse;
      setMarket(resolvedMarket);

      const params = new URLSearchParams({
        id: resolvedMarket.id,
        symbol: resolvedMarket.symbol,
        name: resolvedMarket.name,
        price: String(resolvedMarket.price),
        marketCap: String(resolvedMarket.marketCap),
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
    <div className="mx-auto w-full max-w-[1180px]">
      <div className="overflow-hidden rounded-[24px] border border-[#DDE5ED] bg-white shadow-[0_18px_55px_rgba(25,42,70,0.06)] dark:border-[#27384C] dark:bg-[#0E1A29]">
        <div className="grid gap-0 lg:grid-cols-[0.82fr_1.18fr]">
          <div className="border-b border-[#E8EDF2] p-5 dark:border-[#26364A] sm:p-7 lg:border-b-0 lg:border-r">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#FFF1D6] text-sm font-black text-[#A96300] dark:bg-[#3A2A14] dark:text-[#FFC66D]">
                U
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#5A6FFF]">
                  Supply schedule
                </p>
                <h2 className="mt-1 text-xl font-bold tracking-[-0.03em] text-[#0D1726] dark:text-white sm:text-2xl">
                  Unlock Intelligence
                </h2>
              </div>
            </div>

            <p className="mt-4 max-w-md text-sm leading-6 text-[#69788A] dark:text-[#A9B7C8]">
              See the next scheduled release, who it is linked to, and its estimated size relative to the token&apos;s current market.
            </p>

            {market && (
              <div className="mt-5 inline-flex max-w-full items-center gap-2 rounded-full border border-[#E1E7ED] bg-[#F8FAFC] px-3 py-2 text-xs text-[#526176] dark:border-[#2B3B4E] dark:bg-[#132132] dark:text-[#B8C5D3]">
                <span className="h-2 w-2 rounded-full bg-[#16B8A6]" />
                <span className="truncate">
                  {market.name} ({market.symbol.toUpperCase()})
                </span>
              </div>
            )}

            <button
              type="button"
              disabled={loading}
              onClick={() => void runUnlockInvestigation()}
              className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-gradient-to-r from-[#465FFF] to-[#3E7EDC] px-5 py-3 text-sm font-semibold text-white shadow-[0_10px_25px_rgba(70,95,255,0.18)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              {loading
                ? "Checking schedule..."
                : data
                ? "Refresh Unlock Intelligence"
                : "Run Unlock Intelligence"}
            </button>
          </div>

          <div className="min-w-0 p-4 sm:p-6 lg:p-7">
            {loading ? (
              <div className="flex min-h-[250px] items-center justify-center rounded-[20px] bg-[#F7F9FC] dark:bg-[#0A1522]">
                <div className="px-5 text-center">
                  <div className="mx-auto h-7 w-7 animate-spin rounded-full border-[3px] border-[#465FFF]/15 border-t-[#465FFF]" />
                  <p className="mt-4 text-sm font-semibold text-[#0D1726] dark:text-white">
                    Checking scheduled releases
                  </p>
                  <p className="mt-2 text-xs text-[#78879A] dark:text-[#94A5B8]">
                    PRISM is checking the primary calendar and verified fallback schedules.
                  </p>
                </div>
              </div>
            ) : error ? (
              <div className="rounded-[20px] border border-[#F0D0D0] bg-[#FFF7F7] p-5 dark:border-[#693838] dark:bg-[#301D22] sm:p-6">
                <p className="font-semibold text-[#A83D3D] dark:text-[#FFB0B0]">Couldn&apos;t run Unlock Intelligence</p>
                <p className="mt-2 text-sm leading-6 text-[#A85A5A] dark:text-[#E8A6A6]">{error}</p>
              </div>
            ) : data?.available && nextUnlock ? (
              <div className="space-y-4">
                <div className="rounded-[20px] bg-gradient-to-br from-[#F5F7FF] via-[#FBFCFF] to-[#F0FAF8] p-4 dark:from-[#17223A] dark:via-[#101C2B] dark:to-[#102B2B] sm:p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#7A899B] dark:text-[#93A3B5]">
                        Next scheduled release
                      </p>
                      <p className="mt-1.5 text-xl font-bold tracking-[-0.03em] text-[#0D1726] dark:text-white sm:text-2xl">
                        {formatDate(nextUnlock.date)}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-[#69788A] dark:text-[#A9B7C8]">
                        {nextSummary}
                      </p>
                    </div>
                    <span className="w-fit rounded-full bg-[#FFF0D5] px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.08em] text-[#9A5A00] dark:bg-[#3A2B16] dark:text-[#FFC66D]">
                      {impactLabel(data.summary?.nextImpactSize)}
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2.5 xl:grid-cols-4">
                    <Metric
                      label={`Tokens${market?.symbol ? ` · ${market.symbol.toUpperCase()}` : ""}`}
                      value={formatAmount(nextUnlock.amount)}
                    />
                    <Metric label="Est. value" value={formatUsd(nextUnlock.estimatedUsdValue)} />
                    <Metric label="Of market cap" value={formatPercent(nextUnlock.estimatedPercentOfMarketCap)} />
                    <Metric label="Of circulating" value={formatPercent(nextUnlock.estimatedPercentOfCirculatingSupply)} />
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-[#E4EAF0] p-4 dark:border-[#2A3A4E]">
                    <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#8A99AB]">Allocation</p>
                    <p className="mt-2 text-sm font-semibold leading-6 text-[#172235] dark:text-white">
                      {nextUnlock.allocation}
                    </p>
                    <p className="mt-1 text-xs text-[#718095] dark:text-[#9CACBE]">
                      {allocationLabel(nextUnlock.allocationType)}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-[#E4EAF0] p-4 dark:border-[#2A3A4E]">
                    <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#8A99AB]">Data basis</p>
                    <p className="mt-2 text-xs leading-6 text-[#526176] dark:text-[#B8C5D3]">
                      {data.coverage === "modeled"
                        ? "Modeled from published cliff and linear vesting terms; dynamic distributions are excluded."
                        : "Scheduled release returned by the connected unlock calendar."}
                    </p>
                  </div>
                </div>

                {data.events.length > 1 && (
                  <details className="group overflow-hidden rounded-2xl border border-[#E4EAF0] dark:border-[#2A3A4E]">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3.5 text-sm font-semibold text-[#334257] dark:text-[#D2DCE7]">
                      <span>Upcoming schedule</span>
                      <span className="rounded-full bg-[#F1F4F8] px-2.5 py-1 text-[10px] text-[#708095] dark:bg-[#172537] dark:text-[#A9B7C8]">
                        {data.events.length} events
                      </span>
                    </summary>
                    <div className="max-h-[290px] overflow-y-auto border-t border-[#E9EEF3] dark:border-[#26364A]">
                      {data.events.slice(0, 12).map((event) => (
                        <div
                          key={event.id}
                          className="grid gap-1 border-b border-[#EEF2F5] px-4 py-3 last:border-b-0 dark:border-[#243347] sm:grid-cols-[130px_1fr_auto] sm:items-center sm:gap-3"
                        >
                          <span className="text-xs font-semibold text-[#172235] dark:text-white">
                            {formatDate(event.date)}
                          </span>
                          <span className="truncate text-xs text-[#718095] dark:text-[#A9B7C8]">
                            {event.allocation}
                          </span>
                          <span className="text-xs font-semibold text-[#405064] dark:text-[#CAD4E0]">
                            {formatAmount(event.amount)} {market?.symbol?.toUpperCase()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </details>
                )}

                <div className="flex flex-col gap-2 rounded-2xl bg-[#F8FAFC] px-4 py-3 text-[10px] leading-5 text-[#7C8B9E] dark:bg-[#0A1522] dark:text-[#8FA1B5] sm:flex-row sm:items-center sm:justify-between">
                  <span>
                    Source: {data.provider}. Current USD estimates are not future-price estimates.
                  </span>
                  {data.message && <span className="sm:max-w-[48%] sm:text-right">{data.message}</span>}
                </div>
              </div>
            ) : data ? (
              <div className="rounded-[20px] border border-[#DFE6ED] bg-[#F9FBFD] p-5 dark:border-[#2A3A4E] dark:bg-[#0A1522] sm:p-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-[#64748A] shadow-sm dark:bg-[#142235] dark:text-[#AAB8C8]">
                  ◇
                </div>
                <p className="mt-4 text-base font-semibold text-[#172235] dark:text-white">
                  {data.coverage === "provider_unavailable"
                    ? "The unlock provider is temporarily unavailable."
                    : "No verified fixed schedule is available for this token yet."}
                </p>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-[#718095] dark:text-[#A9B7C8]">
                  {data.message ??
                    "PRISM did not receive a verified future release. Missing coverage is not evidence that a token has no vesting schedule."}
                </p>
                <button
                  type="button"
                  onClick={() => void runUnlockInvestigation()}
                  className="mt-4 rounded-xl border border-[#D7DFE8] bg-white px-4 py-2.5 text-sm font-semibold text-[#334257] transition hover:bg-[#F4F7FA] dark:border-[#33465D] dark:bg-[#132132] dark:text-white dark:hover:bg-[#17283B]"
                >
                  Check again
                </button>
              </div>
            ) : (
              <div className="flex min-h-[230px] items-center rounded-[20px] border border-dashed border-[#DCE4EC] bg-[#FAFBFD] p-5 dark:border-[#2A3A4E] dark:bg-[#0A1522] sm:p-6">
                <div>
                  <p className="text-sm font-semibold text-[#172235] dark:text-white">
                    Ready when your token scan is complete
                  </p>
                  <p className="mt-2 max-w-xl text-sm leading-6 text-[#718095] dark:text-[#A9B7C8]">
                    Run Unlock Intelligence to check scheduled supply releases without leaving your PRISM investigation.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    target
  );
}

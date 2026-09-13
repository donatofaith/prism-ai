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
  coverage?: "matched" | "not_tracked" | "provider_unavailable";
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
  return "Size being evaluated";
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

export default function UnlockIntelligenceConsole() {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<UnlockResponse | null>(null);
  const [market, setMarket] = useState<MarketResponse | null>(null);
  const [lastQuery, setLastQuery] = useState("");

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

  const summary = useMemo(() => {
    if (!data?.available || !nextUnlock) return null;
    const recipient = allocationLabel(nextUnlock.allocationType);
    const timing =
      nextUnlock.daysUntil === 0
        ? "today"
        : `in ${nextUnlock.daysUntil} day${nextUnlock.daysUntil === 1 ? "" : "s"}`;
    const supply = formatPercent(nextUnlock.estimatedPercentOfCirculatingSupply);
    return `${recipient} allocation scheduled ${timing}. The release is estimated at ${supply} of current circulating supply when that estimate is available.`;
  }, [data, nextUnlock]);

  async function runUnlockInvestigation() {
    const query = getSearchQuery();
    setError("");

    if (!query) {
      setData(null);
      setMarket(null);
      setError("Run a token scan first, then open Unlock Intelligence.");
      return;
    }

    try {
      setLoading(true);
      setLastQuery(query);

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
    <div>
      <div className="grid gap-8 lg:grid-cols-[0.72fr_1.28fr] lg:items-start">
        <div>
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[#FFF4DE] font-bold text-[#B56A00] dark:bg-[#3A2B16] dark:text-[#FFC66D]">
            U
          </div>
          <p className="prism-eyebrow mt-5">Supply schedule</p>
          <h2 className="prism-section-title mt-3">Unlock Intelligence</h2>
          <p className="prism-section-copy mt-5 max-w-lg">
            Check scheduled token releases, who the allocation is linked to, and how large the release is relative to the token&apos;s current market size.
          </p>

          <button
            type="button"
            disabled={loading}
            onClick={() => void runUnlockInvestigation()}
            className="prism-button-primary mt-6 px-5 py-3 text-sm font-semibold disabled:opacity-60"
          >
            {loading ? "Checking unlock schedule..." : data ? "Refresh Unlock Intelligence" : "Run Unlock Intelligence"}
          </button>

          {lastQuery && market && (
            <p className="mt-3 text-xs text-[#98A5B5] dark:text-[#8FA1B5]">
              Current investigation: {market.name} ({market.symbol.toUpperCase()})
            </p>
          )}
        </div>

        <div>
          {loading ? (
            <div className="flex min-h-[360px] items-center justify-center rounded-[24px] border border-[#DDE4E9] bg-white dark:border-[#2B3A4D] dark:bg-[#101C2B]">
              <div className="text-center">
                <div className="mx-auto h-8 w-8 animate-spin rounded-full border-[3px] border-[#465FFF]/15 border-t-[#465FFF]" />
                <p className="mt-4 text-sm font-semibold text-[#0D1726] dark:text-white">
                  Reading scheduled releases...
                </p>
                <p className="mt-2 text-xs text-[#69788A] dark:text-[#A9B7C8]">
                  Matching the token to the provider&apos;s current unlock calendar.
                </p>
              </div>
            </div>
          ) : error ? (
            <div className="rounded-[24px] border border-[#F6CACA] bg-[#FFF4F4] p-6 dark:border-[#6D3333] dark:bg-[#351D23]">
              <p className="font-semibold text-[#B63D3D] dark:text-[#FFAAAA]">Unlock Intelligence could not run</p>
              <p className="mt-3 text-sm leading-7 text-[#B63D3D] dark:text-[#FFAAAA]">{error}</p>
            </div>
          ) : data?.available && nextUnlock ? (
            <div className="overflow-hidden rounded-[24px] border border-[#DDE4E9] bg-white shadow-sm dark:border-[#2B3A4D] dark:bg-[#101C2B]">
              <div className="bg-gradient-to-br from-[#F7F8FF] via-white to-[#F0FAF8] p-5 dark:from-[#17213A] dark:via-[#101C2B] dark:to-[#112B2B] sm:p-7">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#69788A] dark:text-[#9EACBD]">
                      Next scheduled release
                    </p>
                    <p className="mt-2 text-2xl font-bold tracking-[-0.03em] text-[#0D1726] dark:text-white">
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

                <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <Metric label="Tokens" value={formatAmount(nextUnlock.amount)} />
                  <Metric label="Est. current value" value={formatUsd(nextUnlock.estimatedUsdValue)} />
                  <Metric label="Of market cap" value={formatPercent(nextUnlock.estimatedPercentOfMarketCap)} />
                  <Metric label="Of circulating supply" value={formatPercent(nextUnlock.estimatedPercentOfCirculatingSupply)} />
                </div>
              </div>

              <div className="grid border-t border-[#E3E8EE] dark:border-[#2B3A4D] md:grid-cols-3">
                <InfoBlock
                  title="Allocation"
                  body={`${nextUnlock.allocation} · ${allocationLabel(nextUnlock.allocationType)}`}
                />
                <InfoBlock title="What PRISM sees" body={summary ?? "Scheduled release identified."} bordered />
                <InfoBlock
                  title="Evidence boundary"
                  body="A scheduled unlock describes token availability. It does not prove recipients will sell or predict a particular market direction."
                  bordered
                />
              </div>

              {data.events.length > 1 && (
                <details className="border-t border-[#E3E8EE] dark:border-[#2B3A4D]">
                  <summary className="cursor-pointer px-5 py-4 text-sm font-semibold text-[#405064] dark:text-[#CAD4E0] sm:px-7">
                    View upcoming schedule ({data.events.length})
                  </summary>
                  <div className="divide-y divide-[#EEF2F5] border-t border-[#EEF2F5] dark:divide-[#26364A] dark:border-[#26364A]">
                    {data.events.slice(0, 8).map((event) => (
                      <div key={event.id} className="grid gap-2 px-5 py-4 text-xs sm:grid-cols-[140px_1fr_auto] sm:px-7">
                        <span className="font-semibold text-[#0D1726] dark:text-white">{formatDate(event.date)}</span>
                        <span className="text-[#69788A] dark:text-[#A9B7C8]">{event.allocation}</span>
                        <span className="font-semibold text-[#405064] dark:text-[#CAD4E0]">
                          {formatAmount(event.amount)} {market?.symbol?.toUpperCase()}
                        </span>
                      </div>
                    ))}
                  </div>
                </details>
              )}

              <div className="border-t border-[#E3E8EE] px-5 py-4 text-[11px] leading-5 text-[#98A5B5] dark:border-[#2B3A4D] dark:text-[#8FA1B5] sm:px-7">
                Source: {data.provider}. USD estimates use PRISM&apos;s current token price and are not future-price estimates.
              </div>
            </div>
          ) : data ? (
            <div className="rounded-[24px] border border-[#DDE4E9] bg-white p-6 dark:border-[#2B3A4D] dark:bg-[#101C2B] sm:p-8">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#F1F4F7] text-[#69788A] dark:bg-[#172537] dark:text-[#A9B7C8]">
                ◇
              </div>
              <p className="mt-5 text-lg font-semibold text-[#0D1726] dark:text-white">
                {data.coverage === "not_tracked"
                  ? "Unlock coverage is not available for this token yet."
                  : data.coverage === "provider_unavailable"
                  ? "Unlock provider is temporarily unavailable."
                  : "No future release is listed in the current schedule."}
              </p>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-[#69788A] dark:text-[#A9B7C8]">
                {data.message ??
                  "PRISM did not receive a future scheduled release for this token. This is not evidence that no vesting or future release exists."}
              </p>
              <button
                type="button"
                onClick={() => void runUnlockInvestigation()}
                className="prism-button-secondary mt-5 px-4 py-2.5 text-xs font-semibold"
              >
                Check again
              </button>
            </div>
          ) : (
            <div className="flex min-h-[360px] items-center justify-center rounded-[24px] border border-dashed border-[#CFD7E1] bg-[#F9FBFC] p-7 text-center dark:border-[#314257] dark:bg-[#0C1725]">
              <div className="max-w-md">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FFF4DE] font-bold text-[#B56A00] dark:bg-[#3A2B16] dark:text-[#FFC66D]">U</div>
                <p className="mt-5 text-base font-semibold text-[#0D1726] dark:text-white">Check this token&apos;s unlock schedule</p>
                <p className="mt-2 text-sm leading-6 text-[#69788A] dark:text-[#A9B7C8]">
                  Run a normal PRISM token scan first. Unlock Intelligence will use that token&apos;s identity, price and market cap to build the release view.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    target
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#E3E8EE] bg-white/80 p-3 dark:border-[#2B3A4D] dark:bg-[#0C1725]/80">
      <p className="text-[9px] uppercase tracking-[0.1em] text-[#98A5B5]">{label}</p>
      <p className="mt-2 text-sm font-semibold text-[#0D1726] dark:text-white">{value}</p>
    </div>
  );
}

function InfoBlock({
  title,
  body,
  bordered = false,
}: {
  title: string;
  body: string;
  bordered?: boolean;
}) {
  return (
    <div className={`p-5 sm:p-6 ${bordered ? "border-t border-[#E3E8EE] dark:border-[#2B3A4D] md:border-l md:border-t-0" : ""}`}>
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#405064] dark:text-[#9EACBD]">{title}</p>
      <p className="mt-3 text-sm leading-7 text-[#69788A] dark:text-[#CAD4E0]">{body}</p>
    </div>
  );
}

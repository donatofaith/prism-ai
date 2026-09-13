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
  if (value === null || !Number.isFinite(value)) return "Not available";
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function formatAmount(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "Not available";
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
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
  if (value === "large") return "Large release";
  if (value === "meaningful") return "Meaningful release";
  if (value === "limited") return "Smaller release";
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
    <div className="min-w-0 rounded-2xl border border-[#E4EAF0] bg-white/90 p-3.5 dark:border-[#2A3A4E] dark:bg-[#0C1725]/90 sm:p-4">
      <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-[#8A99AB] dark:text-[#8294A8]">
        {label}
      </p>
      <p className="mt-2 break-words text-sm font-bold text-[#101A2B] dark:text-white sm:text-base">
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
  const [showAll, setShowAll] = useState(false);

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
  const visibleEvents = showAll ? data?.events ?? [] : (data?.events ?? []).slice(0, 5);

  const beginnerSummary = useMemo(() => {
    if (!nextUnlock) return "";

    const timing =
      nextUnlock.daysUntil === 0
        ? "today"
        : `in ${nextUnlock.daysUntil} day${nextUnlock.daysUntil === 1 ? "" : "s"}`;

    const amount = formatAmount(nextUnlock.amount);
    const symbol = market?.symbol?.toUpperCase() ?? "tokens";
    const recipient = allocationLabel(nextUnlock.allocationType);
    const supply = formatPercent(nextUnlock.estimatedPercentOfCirculatingSupply);

    return `${amount} ${symbol} are scheduled to become available ${timing}. The release is linked to ${recipient.toLowerCase()} and is about ${supply} of the currently circulating supply when that estimate is available.`;
  }, [nextUnlock, market]);

  const watchText = useMemo(() => {
    if (!nextUnlock) return "";

    const marketShare = nextUnlock.estimatedPercentOfMarketCap;
    const circulatingShare = nextUnlock.estimatedPercentOfCirculatingSupply;

    if (
      (marketShare !== null && marketShare >= 10) ||
      (circulatingShare !== null && circulatingShare >= 10)
    ) {
      return "This is a relatively large scheduled release. It may be worth watching project-linked wallet activity around the release date, while remembering that an unlock does not prove selling.";
    }

    if (
      (marketShare !== null && marketShare >= 3) ||
      (circulatingShare !== null && circulatingShare >= 3)
    ) {
      return "This release is meaningful relative to the token's current size. PRISM treats it as context to monitor, not as a prediction of price direction.";
    }

    return "The next release appears smaller relative to the token's current size. PRISM still keeps it visible as supply context, without treating it as a trading signal.";
  }, [nextUnlock]);

  async function runUnlockInvestigation() {
    const query = getSearchQuery();
    setError("");
    setShowAll(false);

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
    <div className="mx-auto w-full max-w-[1160px]">
      <div className="overflow-hidden rounded-[22px] border border-[#DDE5ED] bg-white shadow-[0_18px_55px_rgba(25,42,70,0.06)] dark:border-[#27384C] dark:bg-[#0E1A29]">
        <div className="grid lg:grid-cols-[0.72fr_1.28fr]">
          <div className="border-b border-[#E8EDF2] p-5 dark:border-[#26364A] sm:p-6 lg:border-b-0 lg:border-r lg:p-7">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#FFF1D6] text-sm font-black text-[#A96300] dark:bg-[#3A2A14] dark:text-[#FFC66D]">
                U
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#5A6FFF]">
                  Supply schedule
                </p>
                <h2 className="mt-1 text-xl font-bold tracking-[-0.03em] text-[#0D1726] dark:text-white sm:text-2xl">
                  Unlock Intelligence
                </h2>
              </div>
            </div>

            <p className="mt-4 max-w-md text-sm leading-6 text-[#69788A] dark:text-[#A9B7C8]">
              See when tokens are scheduled to become available, who the release is linked to, and how large it is relative to the token&apos;s current size.
            </p>

            {market && (
              <div className="mt-5 inline-flex max-w-full items-center gap-2 rounded-full border border-[#E1E7ED] bg-[#F8FAFC] px-3 py-2 text-xs text-[#526176] dark:border-[#2B3B4E] dark:bg-[#132132] dark:text-[#B8C5D3]">
                <span className="h-2 w-2 shrink-0 rounded-full bg-[#16B8A6]" />
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

            <div className="mt-5 rounded-2xl bg-[#F7F9FC] p-4 dark:bg-[#0A1522]">
              <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#8290A2] dark:text-[#8294A8]">
                What this section answers
              </p>
              <div className="mt-3 space-y-2 text-xs leading-5 text-[#5F6F83] dark:text-[#A9B7C8]">
                <p>• When is the next scheduled release?</p>
                <p>• How many tokens are involved?</p>
                <p>• Who is the allocation linked to?</p>
                <p>• How large is it relative to current supply and market cap?</p>
              </div>
            </div>
          </div>

          <div className="min-w-0 p-4 sm:p-5 lg:p-6">
            {loading ? (
              <div className="flex min-h-[260px] items-center justify-center rounded-[18px] bg-[#F7F9FC] dark:bg-[#0A1522]">
                <div className="px-5 text-center">
                  <div className="mx-auto h-7 w-7 animate-spin rounded-full border-[3px] border-[#465FFF]/15 border-t-[#465FFF]" />
                  <p className="mt-4 text-sm font-semibold text-[#0D1726] dark:text-white">
                    Checking scheduled releases
                  </p>
                  <p className="mt-2 text-xs text-[#78879A] dark:text-[#94A5B8]">
                    PRISM is checking available schedule data and verified project information.
                  </p>
                </div>
              </div>
            ) : error ? (
              <div className="rounded-[18px] border border-[#F0D0D0] bg-[#FFF7F7] p-5 dark:border-[#693838] dark:bg-[#301D22] sm:p-6">
                <p className="font-semibold text-[#A83D3D] dark:text-[#FFB0B0]">
                  Unlock Intelligence could not run
                </p>
                <p className="mt-2 text-sm leading-6 text-[#A85A5A] dark:text-[#E8A6A6]">{error}</p>
              </div>
            ) : data?.available && nextUnlock ? (
              <div className="space-y-4">
                <div className="rounded-[18px] bg-gradient-to-br from-[#F5F7FF] via-[#FBFCFF] to-[#F0FAF8] p-4 dark:from-[#17223A] dark:via-[#101C2B] dark:to-[#102B2B] sm:p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#7A899B] dark:text-[#93A3B5]">
                        Next scheduled release
                      </p>
                      <p className="mt-1.5 text-xl font-bold tracking-[-0.03em] text-[#0D1726] dark:text-white sm:text-2xl">
                        {formatDate(nextUnlock.date)}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-[#69788A] dark:text-[#A9B7C8]">
                        {nextUnlock.daysUntil === 0
                          ? "Scheduled for today"
                          : `${nextUnlock.daysUntil} day${nextUnlock.daysUntil === 1 ? "" : "s"} away`}
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
                    <Metric label="Estimated current value" value={formatUsd(nextUnlock.estimatedUsdValue)} />
                    <Metric label="Of market cap" value={formatPercent(nextUnlock.estimatedPercentOfMarketCap)} />
                    <Metric label="Of circulating supply" value={formatPercent(nextUnlock.estimatedPercentOfCirculatingSupply)} />
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-[#E4EAF0] p-4 dark:border-[#2A3A4E]">
                    <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#8A99AB]">
                      Who is this linked to?
                    </p>
                    <p className="mt-2 text-sm font-semibold leading-6 text-[#172235] dark:text-white">
                      {nextUnlock.allocation}
                    </p>
                    <p className="mt-1 text-xs text-[#718095] dark:text-[#9CACBE]">
                      {allocationLabel(nextUnlock.allocationType)}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-[#E4EAF0] p-4 dark:border-[#2A3A4E]">
                    <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#8A99AB]">
                      Schedule source
                    </p>
                    <p className="mt-2 text-sm font-semibold leading-6 text-[#172235] dark:text-white">
                      {data.coverage === "modeled"
                        ? "Published project tokenomics"
                        : "Connected unlock calendar"}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-[#718095] dark:text-[#9CACBE]">
                      {data.coverage === "modeled"
                        ? "PRISM modeled only the fixed vesting terms described by the project. Variable or discretionary distributions are not included."
                        : "PRISM matched this token to a scheduled-release record from the connected data source."}
                    </p>
                  </div>
                </div>

                <div className="grid gap-3 lg:grid-cols-2">
                  <div className="rounded-2xl border border-[#DDE7F4] bg-[#F7FAFF] p-4 dark:border-[#2B3D55] dark:bg-[#101D2D]">
                    <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#5A6FFF]">
                      Beginner summary
                    </p>
                    <p className="mt-2 text-sm leading-6 text-[#405064] dark:text-[#C3CEDA]">
                      {beginnerSummary}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-[#DCEBE7] bg-[#F4FBF9] p-4 dark:border-[#27463F] dark:bg-[#102521]">
                    <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#159786]">
                      Why it may matter
                    </p>
                    <p className="mt-2 text-sm leading-6 text-[#405064] dark:text-[#C3CEDA]">
                      {watchText}
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl border border-[#E4EAF0] dark:border-[#2A3A4E]">
                  <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5">
                    <div>
                      <p className="text-sm font-semibold text-[#172235] dark:text-white">
                        Upcoming schedule
                      </p>
                      <p className="mt-1 text-[11px] text-[#7B899A] dark:text-[#8FA0B4]">
                        {data.events.length} scheduled event{data.events.length === 1 ? "" : "s"} available
                      </p>
                    </div>
                    {data.events.length > 5 && (
                      <button
                        type="button"
                        onClick={() => setShowAll((value) => !value)}
                        className="rounded-full bg-[#F0F3F8] px-3 py-1.5 text-[10px] font-bold text-[#516175] transition hover:bg-[#E7EBF3] dark:bg-[#18283A] dark:text-[#B8C5D3]"
                      >
                        {showAll ? "Show less" : "Show all"}
                      </button>
                    )}
                  </div>

                  <div className="max-h-[360px] overflow-y-auto border-t border-[#E8EDF2] dark:border-[#26364A]">
                    {visibleEvents.map((event) => (
                      <div
                        key={event.id}
                        className="grid gap-2 border-b border-[#EEF2F5] px-4 py-3 text-xs last:border-b-0 dark:border-[#223247] sm:grid-cols-[120px_1fr_auto] sm:items-center"
                      >
                        <span className="font-semibold text-[#172235] dark:text-white">
                          {formatDate(event.date)}
                        </span>
                        <span className="min-w-0 break-words text-[#66768A] dark:text-[#A9B7C8]">
                          {event.allocation}
                        </span>
                        <span className="font-semibold text-[#405064] dark:text-[#C3CEDA]">
                          {formatAmount(event.amount)} {market?.symbol?.toUpperCase()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl bg-[#F8FAFC] px-4 py-3 text-[11px] leading-5 text-[#7B899A] dark:bg-[#0A1522] dark:text-[#8FA0B4]">
                  <span className="font-semibold text-[#5E6C7E] dark:text-[#AAB7C6]">Evidence note:</span>{" "}
                  A scheduled unlock means tokens may become available according to a published or indexed schedule. It does not prove that recipients will move or sell those tokens, and it does not predict price direction.
                </div>
              </div>
            ) : data ? (
              <div className="rounded-[18px] border border-[#DDE4E9] bg-[#F8FAFC] p-5 dark:border-[#2B3A4D] dark:bg-[#0A1522] sm:p-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-[#69788A] shadow-sm dark:bg-[#152538] dark:text-[#A9B7C8]">
                  ◇
                </div>
                <p className="mt-4 text-base font-semibold text-[#0D1726] dark:text-white">
                  {data.coverage === "provider_unavailable"
                    ? "Schedule data is temporarily unavailable."
                    : data.coverage === "not_tracked"
                    ? "This token is not covered by the current unlock dataset."
                    : "No future scheduled release was returned."}
                </p>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-[#69788A] dark:text-[#A9B7C8]">
                  PRISM does not treat missing schedule data as proof that no vesting or future release exists. We only show unlock information when we can tie it to an indexed schedule or a verified published tokenomics source.
                </p>
                <button
                  type="button"
                  onClick={() => void runUnlockInvestigation()}
                  className="mt-4 rounded-xl border border-[#DCE3EA] bg-white px-4 py-2.5 text-sm font-semibold text-[#172235] transition hover:bg-[#F4F6F8] dark:border-[#304258] dark:bg-[#132132] dark:text-white"
                >
                  Check again
                </button>
              </div>
            ) : (
              <div className="flex min-h-[260px] items-center justify-center rounded-[18px] border border-dashed border-[#D8E0E8] bg-[#FBFCFD] p-6 text-center dark:border-[#2A3B4F] dark:bg-[#0A1522]">
                <div className="max-w-sm">
                  <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-[#EEF1FF] text-[#465FFF] dark:bg-[#1B2850] dark:text-[#AAB5FF]">
                    ↗
                  </div>
                  <p className="mt-4 text-sm font-semibold text-[#172235] dark:text-white">
                    Run Unlock Intelligence for the scanned token
                  </p>
                  <p className="mt-2 text-xs leading-5 text-[#7B899A] dark:text-[#8FA0B4]">
                    PRISM will show the next release, estimated size, allocation, schedule source, and upcoming events when reliable data is available.
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

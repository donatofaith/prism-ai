"use client";

import { useEffect, useState } from "react";

type HistoricalMatch = {
  startTimestamp: number;
  endTimestamp: number;

  startDate: string;
  endDate: string;

  startPrice: number;
  endPrice: number;

  periodReturn: number;

  similarityDifference: number;

  forwardReturn: number | null;

  forwardEndDate: string | null;

  forwardEndPrice: number | null;
};

type ReplayData = {
  coinId: string;

  model: "historical-pattern-replay";

  currentPattern: {
    lookbackDays: number;

    startDate: string;
    endDate: string;

    startPrice: number;
    endPrice: number;

    return: number;
  };

  forwardWindowDays: number;

  matchCount: number;

  summary: {
    headline: string;

    positiveAfter: number;
    negativeAfter: number;
    flatAfter: number;

    averageForwardReturn: number;
    medianForwardReturn: number;
  };

  matches: HistoricalMatch[];

  interpretationPolicy: string;

  methodology: string;
};

type ReplaySectionProps = {
  coinId: string | null;

  tokenName?: string;

  tokenSymbol?: string;
};

function formatPrice(value: number) {
  if (value >= 1000) {
    return `$${value.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  if (value >= 1) {
    return `$${value.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    })}`;
  }

  return `$${value.toLocaleString(undefined, {
    maximumFractionDigits: 8,
  })}`;
}

function formatPercent(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function returnTextClass(value: number) {
  if (value > 0) {
    return "text-[#16B8A6]";
  }

  if (value < 0) {
    return "text-[#EF5B5B]";
  }

  return "text-[#69788A]";
}

function returnSurfaceClass(value: number | null) {
  if (value === null) {
    return "border-[#E3E8EE] bg-[#F9FBFC]";
  }

  if (value > 0) {
    return "border-[#BCEBE5] bg-[#E8F9F6]";
  }

  if (value < 0) {
    return "border-[#F6CACA] bg-[#FFF1F1]";
  }

  return "border-[#E3E8EE] bg-[#F9FBFC]";
}

function outcomeLabel(value: number | null) {
  if (value === null) {
    return "No forward data";
  }

  if (value > 0) {
    return "Higher after";
  }

  if (value < 0) {
    return "Lower after";
  }

  return "Flat after";
}

function similarityScore(difference: number) {
  return Math.max(
    0,
    Math.min(
      100,
      100 - difference * 8
    )
  );
}

function SimilarityMeter({
  difference,
}: {
  difference: number;
}) {
  const score =
    similarityScore(difference);

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-medium text-[#98A5B5]">
          Similarity
        </p>

        <p className="text-[11px] font-semibold text-[#405064]">
          {score.toFixed(0)}%
        </p>
      </div>

      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#E3E8EE]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#465FFF] via-[#3F70DF] to-[#16B8A6]"
          style={{
            width: `${score}%`,
          }}
        />
      </div>
    </div>
  );
}

function ReplayMetric({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string | number;
  tone?:
    | "default"
    | "positive"
    | "negative"
    | "primary";
}) {
  const valueClass =
    tone === "positive"
      ? "text-[#16B8A6]"
      : tone === "negative"
      ? "text-[#EF5B5B]"
      : tone === "primary"
      ? "text-[#465FFF]"
      : "text-[#0D1726]";

  return (
    <div className="rounded-[18px] border border-[#E3E8EE] bg-white p-4 shadow-sm">
      <p className="text-xs font-medium text-[#69788A]">
        {label}
      </p>

      <p
        className={`mt-2 text-2xl font-bold tracking-[-0.03em] ${valueClass}`}
      >
        {value}
      </p>
    </div>
  );
}

export default function ReplaySection({
  coinId,
  tokenName,
  tokenSymbol,
}: ReplaySectionProps) {
  const [
    replay,
    setReplay,
  ] =
    useState<ReplayData | null>(
      null
    );

  const [
    loading,
    setLoading,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState("");

  const [
    lookbackDays,
    setLookbackDays,
  ] =
    useState<7 | 14 | 30>(
      7
    );

  const [
    forwardDays,
    setForwardDays,
  ] =
    useState<7 | 14 | 30>(
      7
    );

  async function loadReplay(
    id: string,
    lookback: number,
    forward: number
  ) {
    try {
      setLoading(true);

      setError("");

      const response =
        await fetch(
          `/api/replay?id=${encodeURIComponent(
            id
          )}&lookback=${lookback}&forward=${forward}`,
          {
            cache: "no-store",
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Unable to run PRISM Replay."
        );
      }

      setReplay(data);
    } catch (err) {
      setReplay(null);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to analyze historical patterns."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!coinId) {
      setReplay(null);

      setError("");

      return;
    }

    loadReplay(
      coinId,
      lookbackDays,
      forwardDays
    );
  }, [
    coinId,
    lookbackDays,
    forwardDays,
  ]);

  const displayName =
    tokenName ||
    tokenSymbol ||
    "this token";

  return (
    <section
      id="replay"
      className="scroll-mt-24 py-20"
    >
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[#EEF1FF] text-lg text-[#465FFF]">
            ↺
          </div>

          <p className="prism-eyebrow mt-5">
            Historical pattern intelligence
          </p>

          <h2 className="prism-section-title mt-3">
            PRISM Replay
          </h2>

          <p className="prism-section-copy mt-4 max-w-2xl">
            Compare the current price pattern with
            similar periods from the past and inspect
            what happened afterward.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="flex items-center gap-3 rounded-[14px] border border-[#E3E8EE] bg-white px-3 shadow-sm">
            <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#98A5B5]">
              Pattern
            </span>

            <select
              value={lookbackDays}
              onChange={(event) =>
                setLookbackDays(
                  Number(
                    event.target.value
                  ) as 7 | 14 | 30
                )
              }
              className="h-11 bg-transparent text-xs font-semibold text-[#405064] outline-none"
            >
              <option value={7}>
                7 days
              </option>

              <option value={14}>
                14 days
              </option>

              <option value={30}>
                30 days
              </option>
            </select>
          </label>

          <label className="flex items-center gap-3 rounded-[14px] border border-[#E3E8EE] bg-white px-3 shadow-sm">
            <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#98A5B5]">
              After
            </span>

            <select
              value={forwardDays}
              onChange={(event) =>
                setForwardDays(
                  Number(
                    event.target.value
                  ) as 7 | 14 | 30
                )
              }
              className="h-11 bg-transparent text-xs font-semibold text-[#405064] outline-none"
            >
              <option value={7}>
                7 days
              </option>

              <option value={14}>
                14 days
              </option>

              <option value={30}>
                30 days
              </option>
            </select>
          </label>
        </div>
      </div>

      {!coinId ? (
        <div className="mt-8 flex min-h-[340px] items-center justify-center rounded-[28px] border border-dashed border-[#CFD7E1] bg-white/70">
          <div className="max-w-md px-6 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EEF1FF] text-xl text-[#465FFF]">
              ↺
            </div>

            <p className="mt-5 text-base font-semibold text-[#0D1726]">
              Replay is waiting for a token
            </p>

            <p className="mt-2 text-sm leading-6 text-[#69788A]">
              Run a market scan first. PRISM will then
              search for historical price periods that
              resemble the current pattern.
            </p>
          </div>
        </div>
      ) : loading ? (
        <div className="mt-8 flex min-h-[340px] items-center justify-center rounded-[28px] border border-[#E3E8EE] bg-white shadow-sm">
          <div className="text-center">
            <div className="mx-auto h-9 w-9 animate-spin rounded-full border-[3px] border-[#465FFF]/15 border-t-[#465FFF]" />

            <p className="mt-4 text-sm font-medium text-[#69788A]">
              Replaying historical patterns...
            </p>

            <p className="mt-1 text-xs text-[#98A5B5]">
              Comparing previous market windows
            </p>
          </div>
        </div>
      ) : error ? (
        <div className="mt-8 rounded-[24px] border border-[#F6CACA] bg-[#FFF1F1] p-6">
          <p className="text-sm font-semibold text-[#C03E3E]">
            Replay unavailable
          </p>

          <p className="mt-2 text-sm text-[#C03E3E]">
            {error}
          </p>
        </div>
      ) : replay ? (
        <div className="mt-8 space-y-6">
          <div className="overflow-hidden rounded-[30px] border border-[#DCE3E9] bg-gradient-to-br from-[#F7F9FF] via-white to-[#F0FAF8] shadow-[0_20px_55px_rgba(13,23,38,0.08)]">
            <div className="grid lg:grid-cols-[1.3fr_0.7fr]">
              <div className="p-6 sm:p-8">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="prism-chip prism-chip-primary">
                    <span className="h-2 w-2 rounded-full bg-[#465FFF]" />

                    Historical analogue
                  </span>

                  <span className="prism-chip prism-chip-success">
                    {replay.matchCount} matches
                  </span>
                </div>

                <p className="mt-6 text-xs font-bold uppercase tracking-[0.12em] text-[#98A5B5]">
                  Replay summary
                </p>

                <h3 className="mt-3 max-w-3xl text-2xl font-bold leading-9 tracking-[-0.03em] text-[#0D1726] sm:text-[28px]">
                  {replay.summary.headline}
                </h3>

                <p className="mt-4 max-w-2xl text-sm leading-7 text-[#69788A]">
                  PRISM compared the current{" "}
                  {lookbackDays}-day move in{" "}
                  {displayName} with the closest
                  historical periods available.
                </p>
              </div>

              <div className="border-t border-[#E3E8EE] bg-white/70 p-6 sm:p-8 lg:border-l lg:border-t-0">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#98A5B5]">
                  Current pattern
                </p>

                <p
                  className={`mt-4 text-4xl font-bold tracking-[-0.04em] ${returnTextClass(
                    replay.currentPattern.return
                  )}`}
                >
                  {formatPercent(
                    replay.currentPattern.return
                  )}
                </p>

                <p className="mt-3 text-sm text-[#69788A]">
                  {replay.currentPattern.startDate}
                  {" → "}
                  {replay.currentPattern.endDate}
                </p>

                <div className="mt-5 rounded-xl border border-[#E3E8EE] bg-white px-4 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#98A5B5]">
                    Price range
                  </p>

                  <p className="mt-2 text-sm font-semibold text-[#405064]">
                    {formatPrice(
                      replay.currentPattern.startPrice
                    )}
                    {" → "}
                    {formatPrice(
                      replay.currentPattern.endPrice
                    )}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <ReplayMetric
              label="Similar periods"
              value={replay.matchCount}
              tone="primary"
            />

            <ReplayMetric
              label="Higher afterward"
              value={
                replay.summary.positiveAfter
              }
              tone="positive"
            />

            <ReplayMetric
              label="Lower afterward"
              value={
                replay.summary.negativeAfter
              }
              tone="negative"
            />

            <ReplayMetric
              label="Median next move"
              value={formatPercent(
                replay.summary.medianForwardReturn
              )}
              tone={
                replay.summary.medianForwardReturn >=
                0
                  ? "positive"
                  : "negative"
              }
            />
          </div>

          <div className="overflow-hidden rounded-[28px] border border-[#E3E8EE] bg-white shadow-sm">
            <div className="flex flex-col gap-4 border-b border-[#E3E8EE] p-5 sm:flex-row sm:items-end sm:justify-between sm:p-6">
              <div>
                <p className="text-lg font-semibold tracking-[-0.02em] text-[#0D1726]">
                  Closest historical matches
                </p>

                <p className="mt-1 text-xs leading-5 text-[#98A5B5]">
                  Ranked by similarity to the current{" "}
                  {lookbackDays}-day market move.
                </p>
              </div>

              <span className="prism-chip">
                Looking {forwardDays} days forward
              </span>
            </div>

            <div className="divide-y divide-[#EEF2F5]">
              {replay.matches.map(
                (
                  match,
                  index
                ) => (
                  <div
                    key={`${match.startTimestamp}-${match.endTimestamp}`}
                    className="grid gap-5 p-5 transition hover:bg-[#FAFBFC] sm:p-6 lg:grid-cols-[58px_1fr_190px_160px]"
                  >
                    <div>
                      <div className="flex h-10 w-10 items-center justify-center rounded-[13px] border border-[#E3E8EE] bg-[#F9FBFC] text-xs font-bold text-[#69788A]">
                        {String(
                          index + 1
                        ).padStart(
                          2,
                          "0"
                        )}
                      </div>
                    </div>

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-[#0D1726]">
                          {match.startDate}
                          {" → "}
                          {match.endDate}
                        </p>

                        <span
                          className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                            match.periodReturn >= 0
                              ? "bg-[#E8F9F6] text-[#0F8F82]"
                              : "bg-[#FFF1F1] text-[#C03E3E]"
                          }`}
                        >
                          {formatPercent(
                            match.periodReturn
                          )}
                        </span>
                      </div>

                      <p className="mt-2 text-xs text-[#98A5B5]">
                        {formatPrice(
                          match.startPrice
                        )}
                        {" → "}
                        {formatPrice(
                          match.endPrice
                        )}
                      </p>

                      <div className="mt-4 max-w-md">
                        <SimilarityMeter
                          difference={
                            match.similarityDifference
                          }
                        />
                      </div>
                    </div>

                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#98A5B5]">
                        What happened next
                      </p>

                      {match.forwardReturn !== null ? (
                        <>
                          <p
                            className={`mt-2 text-xl font-bold tracking-[-0.03em] ${returnTextClass(
                              match.forwardReturn
                            )}`}
                          >
                            {formatPercent(
                              match.forwardReturn
                            )}
                          </p>

                          <p className="mt-1 text-xs text-[#98A5B5]">
                            by{" "}
                            {match.forwardEndDate}
                          </p>
                        </>
                      ) : (
                        <p className="mt-2 text-sm text-[#98A5B5]">
                          Not enough data
                        </p>
                      )}
                    </div>

                    <div className="lg:text-right">
                      <span
                        className={`inline-flex rounded-full border px-3 py-1.5 text-xs font-semibold ${returnSurfaceClass(
                          match.forwardReturn
                        )} ${returnTextClass(
                          match.forwardReturn ??
                            0
                        )}`}
                      >
                        {outcomeLabel(
                          match.forwardReturn
                        )}
                      </span>
                    </div>
                  </div>
                )
              )}
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-[22px] border border-[#E3E8EE] bg-white p-5 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#EEF1FF] text-sm text-[#465FFF]">
                  i
                </div>

                <div>
                  <p className="text-sm font-semibold text-[#0D1726]">
                    How Replay works
                  </p>

                  <p className="mt-2 text-xs leading-6 text-[#69788A]">
                    {replay.methodology}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-[22px] border border-[#F4D79F] bg-[#FFF7E8] p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-sm text-[#A35C00] shadow-sm">
                  !
                </div>

                <div>
                  <p className="text-sm font-semibold text-[#7A4300]">
                    Interpretation limit
                  </p>

                  <p className="mt-2 text-xs leading-6 text-[#A35C00]">
                    {replay.interpretationPolicy}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
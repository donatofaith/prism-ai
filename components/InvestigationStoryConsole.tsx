"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type MarketData = {
  id: string;
  name: string;
  symbol: string;
  price: number;
  marketCap: number;
  volume24h: number;
  change24h: number;
};

type HistoryData = {
  coinId: string;
  days: number;
  rangeChange: number;
};

type ReplayPreview = {
  matchCount: number;
  summary: {
    headline: string;
    positiveAfter: number;
    negativeAfter: number;
    medianForwardReturn: number;
  };
};

type ProjectAccount = {
  label: string;
  chain: string;
  accountType: string;
  confidence: string;
};

type ProjectAccountResponse = {
  count: number;
  accounts: ProjectAccount[];
};

type PerspectiveData = {
  status: "quiet" | "watch" | "attention";
  headline: string;
  whatPrismSees: string;
  whyItMayMatter: string;
  whatWeCannotConclude: string;
  evidenceCount: number;
};

type InvestigationReport = {
  query: string;
  market: MarketData;
  history: HistoryData | null;
  replay: ReplayPreview | null;
  accounts: ProjectAccountResponse | null;
  perspective: PerspectiveData | null;
};

function currentQuery() {
  return (
    document
      .querySelector<HTMLInputElement>(
        'input[aria-label="Search by token name, symbol, or contract address"]'
      )
      ?.value.trim() ?? ""
  );
}

function formatPrice(value: number) {
  if (value >= 1000) {
    return `$${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  }
  if (value >= 1) {
    return `$${value.toLocaleString(undefined, { maximumFractionDigits: 4 })}`;
  }
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: 8 })}`;
}

function signed(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function humanChain(value: string) {
  if (value === "bnb") return "BNB Smart Chain";
  if (value === "arbitrum") return "Arbitrum";
  if (value === "optimism") return "Optimism";
  if (value === "polygon") return "Polygon";
  if (value === "avalanche") return "Avalanche";
  if (value === "ethereum") return "Ethereum";
  if (value === "solana") return "Solana";
  if (value === "base") return "Base";
  return value;
}

function jumpTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function ReportBlock({
  number,
  title,
  question,
  children,
}: {
  number: string;
  title: string;
  question: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[20px] border border-[#E1E7ED] bg-white p-4 dark:border-[#2B3B4E] dark:bg-[#0A1522] sm:p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#0D1726] text-[10px] font-black text-white dark:bg-white dark:text-[#0D1726]">
          {number}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-bold text-[#101A2B] dark:text-white">{title}</p>
          <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#8795A7] dark:text-[#7E91A7]">
            {question}
          </p>
        </div>
      </div>
      <div className="mt-4 text-sm leading-6 text-[#5F6F83] dark:text-[#A9B7C8]">{children}</div>
    </div>
  );
}

export default function InvestigationStoryConsole() {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [report, setReport] = useState<InvestigationReport | null>(null);
  const requestId = useRef(0);

  useEffect(() => {
    const ensureTarget = () => {
      const scan = document.getElementById("scan");
      if (!scan?.parentElement) return;

      let section = document.getElementById("investigation-report");
      if (!(section instanceof HTMLElement)) {
        section = document.createElement("section");
        section.id = "investigation-report";
        section.className =
          "scroll-mt-36 border-y border-[#E3E8EE] bg-[#F7F9FC] py-10 dark:border-[#223247] dark:bg-[#08131F] sm:py-14";
        scan.insertAdjacentElement("afterend", section);
      }

      let host = section.querySelector<HTMLElement>("[data-prism-investigation-story='true']");
      if (!host) {
        host = document.createElement("div");
        host.dataset.prismInvestigationStory = "true";
        host.className = "prism-container";
        section.appendChild(host);
      }

      setTarget(host);
    };

    ensureTarget();
    const observer = new MutationObserver(ensureTarget);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  async function buildReport(query: string) {
    const clean = query.trim();
    if (!clean) return;

    const id = ++requestId.current;
    setLoading(true);
    setError("");

    try {
      const marketResponse = await fetch(`/api/market?q=${encodeURIComponent(clean)}`, {
        cache: "no-store",
      });
      const marketPayload = await marketResponse.json();
      if (!marketResponse.ok) {
        throw new Error(marketPayload?.error || "PRISM could not resolve this asset.");
      }
      const market = marketPayload as MarketData;

      const [historyResponse, replayResponse, accountsResponse] = await Promise.all([
        fetch(`/api/history?id=${encodeURIComponent(market.id)}&days=7`, { cache: "no-store" }),
        fetch(`/api/replay?id=${encodeURIComponent(market.id)}&lookback=7&forward=7`, {
          cache: "no-store",
        }),
        fetch(`/api/project-wallets?project=${encodeURIComponent(market.symbol)}`, {
          cache: "no-store",
        }),
      ]);

      const history = historyResponse.ok
        ? ((await historyResponse.json()) as HistoryData)
        : null;
      const replay = replayResponse.ok
        ? ((await replayResponse.json()) as ReplayPreview)
        : null;

      let accounts: ProjectAccountResponse | null = accountsResponse.ok
        ? ((await accountsResponse.json()) as ProjectAccountResponse)
        : null;

      if (accounts && accounts.count === 0) {
        const fallback = await fetch(
          `/api/project-wallets?project=${encodeURIComponent(market.name)}`,
          { cache: "no-store" }
        );
        if (fallback.ok) accounts = (await fallback.json()) as ProjectAccountResponse;
      }

      let perspective: PerspectiveData | null = null;
      try {
        const perspectiveResponse = await fetch("/api/perspective", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token: {
              id: market.id,
              name: market.name,
              symbol: market.symbol,
              price: market.price,
              change24h: market.change24h,
              marketCap: market.marketCap,
              volume24h: market.volume24h,
              rangeChange: history?.rangeChange,
              rangeDays: history?.days,
            },
            projectAccounts: accounts?.accounts ?? [],
          }),
        });
        if (perspectiveResponse.ok) {
          perspective = (await perspectiveResponse.json()) as PerspectiveData;
        }
      } catch {
        perspective = null;
      }

      if (id !== requestId.current) return;
      setReport({ query: clean, market, history, replay, accounts, perspective });
    } catch (caught) {
      if (id !== requestId.current) return;
      setError(
        caught instanceof Error
          ? caught.message
          : "PRISM could not build the investigation report."
      );
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const element = event.target;
      if (!(element instanceof Element)) return;
      const button = element.closest<HTMLButtonElement>("button");
      if (!button) return;

      const text = button.textContent?.replace(/\s+/g, " ").trim().toLowerCase() ?? "";
      const isScan = text.includes("run prism scan") || text === "run scan";
      const isMoverInvestigation =
        text === "investigate" && Boolean(button.closest("[data-prism-market-movers='true']"));

      if (!isScan && !isMoverInvestigation) return;

      window.setTimeout(() => {
        const query = currentQuery();
        if (query) void buildReport(query);
      }, isMoverInvestigation ? 180 : 40);
    };

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, []);

  if (!target) return null;

  const accountPreview = report?.accounts?.accounts.slice(0, 3) ?? [];

  return createPortal(
    <div className="mx-auto w-full max-w-[1160px]">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#5A6FFF]">
            Your answer first
          </p>
          <h2 className="mt-2 text-2xl font-bold tracking-[-0.035em] text-[#0D1726] dark:text-white sm:text-3xl">
            PRISM Investigation Report
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[#69788A] dark:text-[#A9B7C8]">
            One scan brings the important context together first. The deeper modules below are there only when you want to verify or explore further.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-[0.08em] text-[#66768A] dark:text-[#9EADBE]">
          <span className="rounded-full border border-[#DDE5ED] bg-white px-3 py-1.5 dark:border-[#2B3B4E] dark:bg-[#0E1A29]">Discover</span>
          <span>→</span>
          <span className="rounded-full border border-[#DDE5ED] bg-white px-3 py-1.5 dark:border-[#2B3B4E] dark:bg-[#0E1A29]">Investigate</span>
          <span>→</span>
          <span className="rounded-full border border-[#DDE5ED] bg-white px-3 py-1.5 dark:border-[#2B3B4E] dark:bg-[#0E1A29]">Understand</span>
          <span>→</span>
          <span className="rounded-full border border-[#DDE5ED] bg-white px-3 py-1.5 dark:border-[#2B3B4E] dark:bg-[#0E1A29]">Verify</span>
        </div>
      </div>

      {loading ? (
        <div className="rounded-[24px] border border-[#DDE5ED] bg-white p-6 dark:border-[#27384C] dark:bg-[#0E1A29] sm:p-8">
          <div className="flex items-center gap-3">
            <div className="h-7 w-7 animate-spin rounded-full border-[3px] border-[#465FFF]/15 border-t-[#465FFF]" />
            <div>
              <p className="text-sm font-bold text-[#0D1726] dark:text-white">Building the full story...</p>
              <p className="mt-1 text-xs text-[#7A899A] dark:text-[#91A1B4]">Connecting market, history, attribution and context.</p>
            </div>
          </div>
          <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-[150px] animate-pulse rounded-[20px] bg-[#F1F4F8] dark:bg-[#122033]" />
            ))}
          </div>
        </div>
      ) : error ? (
        <div className="rounded-[22px] border border-[#F0D0D0] bg-[#FFF7F7] p-5 text-sm text-[#A85A5A] dark:border-[#693838] dark:bg-[#301D22] dark:text-[#E8A6A6]">
          {error}
        </div>
      ) : report ? (
        <div className="overflow-hidden rounded-[24px] border border-[#DDE5ED] bg-white shadow-[0_18px_55px_rgba(25,42,70,0.05)] dark:border-[#27384C] dark:bg-[#0E1A29]">
          <div className="flex flex-col gap-4 border-b border-[#E8EDF2] p-5 dark:border-[#26364A] sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#8795A7] dark:text-[#8294A8]">Investigation</p>
              <div className="mt-2 flex flex-wrap items-baseline gap-3">
                <h3 className="text-xl font-bold text-[#0D1726] dark:text-white">{report.market.name}</h3>
                <span className="text-xs font-bold uppercase tracking-[0.08em] text-[#5A6FFF]">{report.market.symbol}</span>
              </div>
            </div>
            <div className="sm:text-right">
              <p className="text-lg font-bold text-[#0D1726] dark:text-white">{formatPrice(report.market.price)}</p>
              <p className={`mt-1 text-sm font-bold ${report.market.change24h >= 0 ? "text-[#0F927F]" : "text-[#C94D4D]"}`}>
                {signed(report.market.change24h)} in 24h
              </p>
            </div>
          </div>

          {report.perspective && (
            <div className="border-b border-[#E8EDF2] bg-gradient-to-r from-[#F7F8FF] to-[#F3FBF9] p-5 dark:border-[#26364A] dark:from-[#111B34] dark:to-[#102522] sm:p-6">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#5A6FFF]">PRISM summary</p>
              <p className="mt-3 text-base font-bold leading-7 text-[#172235] dark:text-white sm:text-lg">{report.perspective.headline}</p>
              <p className="mt-2 text-sm leading-6 text-[#647487] dark:text-[#A9B7C8]">{report.perspective.whatPrismSees}</p>
            </div>
          )}

          <div className="grid gap-3 p-4 sm:p-6 md:grid-cols-2 xl:grid-cols-3">
            <ReportBlock number="01" title="What happened" question="What changed?">
              <p>
                {report.market.name} is {report.market.change24h >= 0 ? "up" : "down"} {Math.abs(report.market.change24h).toFixed(2)}% over the last 24 hours at {formatPrice(report.market.price)}.
                {report.history ? ` Over the 7-day window, the recorded move is ${signed(report.history.rangeChange)}.` : ""}
              </p>
            </ReportBlock>

            <ReportBlock number="02" title="Why it may matter" question="Why should I care?">
              <p>
                {report.perspective?.whyItMayMatter ??
                  "PRISM has market context, but there is not enough connected evidence yet to make a stronger contextual statement."}
              </p>
            </ReportBlock>

            <ReportBlock number="03" title="Historical context" question="Has something similar happened before?">
              {report.replay ? (
                <>
                  <p>{report.replay.summary.headline}</p>
                  <p className="mt-2 text-xs text-[#8795A7] dark:text-[#7E91A7]">{report.replay.matchCount} historical analogue{report.replay.matchCount === 1 ? "" : "s"} found. Similarity is descriptive, not predictive.</p>
                </>
              ) : (
                <p>No historical comparison was available for this scan.</p>
              )}
            </ReportBlock>

            <ReportBlock number="04" title="Verified project context" question="Who is publicly attributable?">
              {report.accounts && report.accounts.count > 0 ? (
                <>
                  <p>{report.accounts.count} publicly attributable project account{report.accounts.count === 1 ? "" : "s"} matched PRISM&apos;s evidence registry.</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {accountPreview.map((account) => (
                      <span key={`${account.chain}-${account.label}`} className="rounded-full bg-[#F1F4F8] px-2.5 py-1 text-[10px] font-semibold text-[#607084] dark:bg-[#152437] dark:text-[#A9B7C8]">
                        {account.label} · {humanChain(account.chain)}
                      </span>
                    ))}
                  </div>
                </>
              ) : (
                <p>No project account was matched with enough public evidence. PRISM does not guess attribution.</p>
              )}
            </ReportBlock>

            <ReportBlock number="05" title="What PRISM cannot conclude" question="What is still unknown?">
              <p>
                {report.perspective?.whatWeCannotConclude ??
                  "Market movement and historical similarity alone cannot prove a cause or future direction."}
              </p>
            </ReportBlock>
          </div>

          <div className="flex flex-col gap-3 border-t border-[#E8EDF2] bg-[#FAFBFC] p-4 dark:border-[#26364A] dark:bg-[#0A1522] sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <p className="text-xs leading-5 text-[#7A899A] dark:text-[#91A1B4]">
              You already have the core answer. Open the deeper modules only when you want to verify the evidence.
            </p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => jumpTo("market-investigation")} className="rounded-xl border border-[#DCE3EA] bg-white px-3 py-2 text-[11px] font-bold text-[#465FFF] dark:border-[#304258] dark:bg-[#132132] dark:text-[#AAB5FF]">Market evidence</button>
              <button type="button" onClick={() => jumpTo("replay")} className="rounded-xl border border-[#DCE3EA] bg-white px-3 py-2 text-[11px] font-bold text-[#465FFF] dark:border-[#304258] dark:bg-[#132132] dark:text-[#AAB5FF]">Historical Replay</button>
              <button type="button" onClick={() => jumpTo("wallet")} className="rounded-xl border border-[#DCE3EA] bg-white px-3 py-2 text-[11px] font-bold text-[#465FFF] dark:border-[#304258] dark:bg-[#132132] dark:text-[#AAB5FF]">Account evidence</button>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-[24px] border border-dashed border-[#CDD6E0] bg-white/70 p-6 text-center dark:border-[#2A3B50] dark:bg-[#0E1A29]/70 sm:p-8">
          <p className="text-sm font-bold text-[#172235] dark:text-white">Run a PRISM scan to build one complete investigation report.</p>
          <p className="mx-auto mt-2 max-w-xl text-xs leading-5 text-[#7A899A] dark:text-[#91A1B4]">Instead of making you hunt through separate tools, PRISM will bring the important market, historical and verified attribution context together here first.</p>
        </div>
      )}
    </div>,
    target
  );
}

"use client";

import { useEffect, useRef, useState } from "react";

import {
  ColorType,
  createChart,
  LineSeries,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";

import MobileNav from "@/components/MobileNav";
import ReplaySection from "@/components/ReplaySection";

import WatchlistSection, {
  type WatchlistAccount,
  type WatchlistToken,
} from "@/components/WatchlistSection";

/* =========================================================
   TYPES
   ========================================================= */

type MarketData = {
  id: string;
  name: string;
  symbol: string;
  image: string;
  price: number;
  marketCap: number;
  volume24h: number;
  change24h: number;
};

type HistoryPoint = {
  timestamp: number;
  price: number;
};

type HistoryData = {
  coinId: string;
  days: number;
  prices: HistoryPoint[];
  rangeChange: number;
};

type ReplayPreview = {
  matchCount: number;

  currentPattern: {
    return: number;
  };

  summary: {
    headline: string;
    positiveAfter: number;
    negativeAfter: number;
    medianForwardReturn: number;
  };
};

type ChartRange = "1" | "7" | "30" | "90";

type SupportedChain =
  | "ethereum"
  | "arbitrum"
  | "optimism"
  | "polygon"
  | "solana";

type WalletScanChain =
  | "ethereum"
  | "arbitrum"
  | "solana";

type ProjectAccountType =
  | "treasury"
  | "governance"
  | "multisig"
  | "program"
  | "team"
  | "investor"
  | "project";

type VerificationStatus =
  | "native"
  | "verified"
  | "unverified"
  | "suspicious";

type WalletEntityType =
  | "exchange"
  | "project"
  | "treasury"
  | "team"
  | "investor"
  | "contract"
  | "burn"
  | "unknown";

type AttributionConfidence =
  | "verified"
  | "high"
  | "medium"
  | "unknown";

type MovementContext =
  | "exchange_inflow"
  | "exchange_outflow"
  | "mint"
  | "burn"
  | "project_transfer"
  | "treasury_transfer"
  | "team_transfer"
  | "investor_transfer"
  | "unknown";

type WalletAttribution = {
  address: string;
  label: string;
  entity: string | null;
  entityType: WalletEntityType;
  confidence: AttributionConfidence;
  source: string | null;
  sourceUrl: string | null;
  explanation: string;
};

type WalletTransfer = {
  hash: string | null;
  timestamp: string | null;

  direction: "incoming" | "outgoing";

  asset: string;
  assetName: string | null;
  value: number | null;

  category: string;
  tokenContract: string | null;

  verification: VerificationStatus;
  verificationReason: string;

  tokenLogo: string | null;

  from: string;
  to: string;

  counterparty: string;
  counterpartyShort: string;

  attribution: WalletAttribution;

  movementContext: MovementContext;

  explorerUrl: string | null;

  importance: "high" | "medium" | "low";

  type:
    | "native_transfer"
    | "token_transfer"
    | "large_transfer"
    | "mint"
    | "burn"
    | "unknown_transfer";

  note: string;
  contextExplanation: string;
};

type EvmWalletData = {
  chain: "ethereum" | "arbitrum";
  chainName: string;
  walletScanner: "evm";

  address: string;
  addressShort: string;

  scannedWallet: {
    attribution: WalletAttribution;
    isAttributed: boolean;
    headline: string;
    explanation: string;
  };

  summary: {
    totalTransfers: number;
    incomingTransfers: number;
    outgoingTransfers: number;
    highImportanceTransfers: number;
    verifiedTransfers: number;
    unverifiedTransfers: number;
    suspiciousTransfersHidden: number;
    trustedAssets: number;
    attributedTransfers: number;
    exchangeInteractions: number;
    exchangeInflows: number;
    exchangeOutflows: number;
    mintEvents: number;
    burnEvents: number;
    projectInteractions: number;
  };

  activity: WalletTransfer[];

  intelligence: {
    status: "attention" | "normal";
    headline: string;
    explanation: string;
    attribution: string;
    verificationPolicy: string;
    interpretationPolicy: string;
  };
};

type SolanaActivity = {
  signature: string;
  timestamp: string | null;
  slot: number | null;

  direction:
    | "incoming"
    | "outgoing"
    | "neutral";

  type:
    | "sol_transfer"
    | "token_transfer"
    | "transaction";

  asset: string;
  mint: string | null;
  amount: number | null;
  feeSol: number | null;

  explorerUrl: string;

  status: "success" | "failed";

  note: string;

  verification:
    | "native"
    | "unverified";
};

type SolanaWalletData = {
  chain: "solana";
  chainName: string;
  walletScanner: "solana";

  address: string;
  addressShort: string;

  summary: {
    transactions: number;
    activityItems: number;
    incoming: number;
    outgoing: number;
    neutral: number;
    solMovements: number;
    tokenMovements: number;
    failedActivities?: number;
  };

  activity: SolanaActivity[];

  intelligence: {
    status: "attention" | "normal";
    headline: string;
    explanation: string;
    verificationPolicy?: string;
    interpretationPolicy: string;
  };
};

type ProjectAccount = {
  address: string;
  addressShort: string;

  project: string;
  symbol: string | null;

  chain: SupportedChain;

  label: string;

  accountType: ProjectAccountType;

  walletType:
    | "project"
    | "treasury"
    | "team"
    | "investor";

  isWallet: boolean;

  confidence:
    | "verified"
    | "high"
    | "medium";

  source: string;
  sourceUrl: string;

  explanation: string;
};

type ProjectAccountResponse = {
  query: string;

  resolvedProject: string;

  requestedChain:
    SupportedChain | null;

  count: number;

  chains: SupportedChain[];

  accounts: ProjectAccount[];
};

type PerspectiveEvidence = {
  id: string;

  category:
    | "market"
    | "attribution"
    | "exchange"
    | "project"
    | "protocol"
    | "activity";

  importance:
    | "high"
    | "medium"
    | "low";

  title: string;
  observation: string;
  limitation: string;
};

type PerspectiveData = {
  status:
    | "quiet"
    | "watch"
    | "attention";

  headline: string;

  whatPrismSees: string;

  whyItMayMatter: string;

  whatWeCannotConclude: string;

  evidenceCount: number;

  evidence: PerspectiveEvidence[];
};

/* =========================================================
   NAV
   ========================================================= */

const navItems = [
  {
    label: "Scan",
    href: "#scan",
  },
  {
    label: "Perspective",
    href: "#perspective",
  },
  {
    label: "Replay",
    href: "#replay",
  },
  {
    label: "Accounts",
    href: "#wallet",
  },
  {
    label: "Watchlist",
    href: "#watchlist",
  },
];

/* =========================================================
   HELPERS
   ========================================================= */

function formatCurrency(value: number) {
  if (value >= 1_000_000_000_000) {
    return `$${(
      value / 1_000_000_000_000
    ).toFixed(2)}T`;
  }

  if (value >= 1_000_000_000) {
    return `$${(
      value / 1_000_000_000
    ).toFixed(1)}B`;
  }

  if (value >= 1_000_000) {
    return `$${(
      value / 1_000_000
    ).toFixed(1)}M`;
  }

  if (value >= 1_000) {
    return `$${(
      value / 1_000
    ).toFixed(1)}K`;
  }

  return `$${value.toLocaleString(undefined, {
    maximumFractionDigits: 2,
  })}`;
}

function formatPrice(value: number) {
  return `$${value.toLocaleString(undefined, {
    minimumFractionDigits:
      value >= 1 ? 2 : 0,

    maximumFractionDigits:
      value < 1 ? 8 : 4,
  })}`;
}

function formatTokenValue(
  value: number | null
) {
  if (value === null) {
    return "Unknown";
  }

  return value.toLocaleString(undefined, {
    maximumFractionDigits: 8,
  });
}

function rangeLabel(range: ChartRange) {
  if (range === "1") return "1D";
  if (range === "7") return "7D";
  if (range === "30") return "30D";

  return "90D";
}

function chainLabel(
  chain: SupportedChain
) {
  if (chain === "ethereum") {
    return "Ethereum";
  }

  if (chain === "arbitrum") {
    return "Arbitrum";
  }

  if (chain === "optimism") {
    return "Optimism";
  }

  if (chain === "polygon") {
    return "Polygon";
  }

  return "Solana";
}

function chainInitial(
  chain: SupportedChain
) {
  if (chain === "ethereum") {
    return "Ξ";
  }

  if (chain === "arbitrum") {
    return "A";
  }

  if (chain === "optimism") {
    return "O";
  }

  if (chain === "polygon") {
    return "P";
  }

  return "S";
}

function accountTypeLabel(
  type: ProjectAccountType
) {
  if (type === "treasury") {
    return "Treasury";
  }

  if (type === "governance") {
    return "Governance";
  }

  if (type === "multisig") {
    return "Multisig";
  }

  if (type === "program") {
    return "Program";
  }

  if (type === "team") {
    return "Team";
  }

  if (type === "investor") {
    return "Investor";
  }

  return "Project";
}

function isWalletScanChain(
  chain: SupportedChain
): chain is WalletScanChain {
  return (
    chain === "ethereum" ||
    chain === "arbitrum" ||
    chain === "solana"
  );
}

function formatWalletDate(
  timestamp: string | null
) {
  if (!timestamp) {
    return "Unknown time";
  }

  return new Date(
    timestamp
  ).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function perspectiveStatusLabel(
  status: PerspectiveData["status"]
) {
  if (status === "attention") {
    return "Attention";
  }

  if (status === "watch") {
    return "Watch";
  }

  return "Quiet";
}

function perspectiveStatusClass(
  status: PerspectiveData["status"]
) {
  if (status === "attention") {
    return "prism-chip-warning";
  }

  if (status === "watch") {
    return "prism-chip-primary";
  }

  return "prism-chip-success";
}

function verificationLabel(
  verification: VerificationStatus
) {
  if (verification === "native") {
    return "Native";
  }

  if (verification === "verified") {
    return "Verified";
  }

  if (verification === "suspicious") {
    return "Suspicious";
  }

  return "Unverified";
}

function verificationClass(
  verification: VerificationStatus
) {
  if (
    verification === "native" ||
    verification === "verified"
  ) {
    return "prism-chip-success";
  }

  if (verification === "suspicious") {
    return "prism-chip-danger";
  }

  return "prism-chip-warning";
}

function movementLabel(
  context: MovementContext
) {
  if (context === "exchange_inflow") {
    return "Exchange inflow";
  }

  if (context === "exchange_outflow") {
    return "Exchange outflow";
  }

  if (context === "mint") {
    return "Mint";
  }

  if (context === "burn") {
    return "Burn";
  }

  if (context === "project_transfer") {
    return "Project-linked";
  }

  if (context === "treasury_transfer") {
    return "Treasury";
  }

  if (context === "team_transfer") {
    return "Team-linked";
  }

  if (context === "investor_transfer") {
    return "Investor-linked";
  }

  return null;
}

/* =========================================================
   PRICE CHART
   ========================================================= */

function PriceChart({
  history,
  positive,
}: {
  history: HistoryData | null;
  positive: boolean;
}) {
  const containerRef =
    useRef<HTMLDivElement | null>(null);

  const chartRef =
    useRef<IChartApi | null>(null);

  const seriesRef =
    useRef<ISeriesApi<"Line"> | null>(
      null
    );

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const container =
      containerRef.current;

    const chart =
      createChart(container, {
        width:
          container.clientWidth,

        height: 260,

        layout: {
          background: {
            type: ColorType.Solid,
            color: "#ffffff",
          },

          textColor:
            "#98A5B5",

          fontSize: 11,
        },

        grid: {
          vertLines: {
            color:
              "rgba(13,23,38,0.035)",
          },

          horzLines: {
            color:
              "rgba(13,23,38,0.035)",
          },
        },

        rightPriceScale: {
          borderColor:
            "rgba(13,23,38,0.08)",
        },

        timeScale: {
          borderColor:
            "rgba(13,23,38,0.08)",

          timeVisible: true,

          secondsVisible: false,
        },
      });

    const series =
      chart.addSeries(
        LineSeries,
        {
          color:
            positive
              ? "#16B8A6"
              : "#EF5B5B",

          lineWidth: 2,

          priceLineVisible:
            false,

          lastValueVisible:
            true,
        }
      );

    chartRef.current =
      chart;

    seriesRef.current =
      series;

    const observer =
      new ResizeObserver(() => {
        if (
          !containerRef.current
        ) {
          return;
        }

        chart.applyOptions({
          width:
            containerRef.current
              .clientWidth,
        });
      });

    observer.observe(container);

    return () => {
      observer.disconnect();

      chart.remove();

      chartRef.current =
        null;

      seriesRef.current =
        null;
    };
  }, [positive]);

  useEffect(() => {
    if (
      !history ||
      !seriesRef.current ||
      !chartRef.current
    ) {
      return;
    }

    const data =
      history.prices
        .map((point) => ({
          time:
            Math.floor(
              point.timestamp /
                1000
            ) as UTCTimestamp,

          value:
            point.price,
        }))

        .filter(
          (
            point,
            index,
            array
          ) =>
            index === 0 ||
            point.time !==
              array[index - 1]
                .time
        );

    seriesRef.current.setData(
      data
    );

    chartRef.current
      .timeScale()
      .fitContent();
  }, [history]);

  return (
    <div
      ref={containerRef}
      className="h-[260px] w-full"
    />
  );
}

/* =========================================================
   UI COMPONENTS
   ========================================================= */

function DataMetric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string | number;
  detail?: string;
}) {
  return (
    <div className="rounded-[18px] border border-[#E3E8EE] bg-[#F9FBFC] p-4">
      <p className="text-xs font-medium text-[#69788A]">
        {label}
      </p>

      <p className="mt-2 text-xl font-semibold tracking-[-0.025em] text-[#0D1726]">
        {value}
      </p>

      {detail && (
        <p className="mt-1 text-[11px] text-[#98A5B5]">
          {detail}
        </p>
      )}
    </div>
  );
}

function SignalDot({
  status,
}: {
  status:
    | "positive"
    | "warning"
    | "neutral";
}) {
  const className =
    status === "positive"
      ? "bg-[#16B8A6]"
      : status === "warning"
      ? "bg-[#FFB44A]"
      : "bg-[#465FFF]";

  return (
    <span className="relative flex h-2.5 w-2.5">
      <span
        className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-20 ${className}`}
      />

      <span
        className={`relative inline-flex h-2.5 w-2.5 rounded-full ${className}`}
      />
    </span>
  );
}

type InvestigationStepProps = {
  number: string;
  title: string;
  status: string;
  description: string;
  href: string;
  ready: boolean;
  active?: boolean;
};

function InvestigationStep({
  number,
  title,
  status,
  description,
  href,
  ready,
  active = false,
}: InvestigationStepProps) {
  return (
    <a
      href={href}
      className={`group relative block rounded-[18px] border p-4 transition ${
        active
          ? "border-[#BFC8FF] bg-[#F3F5FF] shadow-sm"
          : ready
          ? "border-[#DDE4E9] bg-white hover:border-[#BFC8FF] hover:shadow-sm"
          : "border-[#E7EBF0] bg-[#FAFBFC]"
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[11px] font-bold ${
            ready
              ? "bg-[#0D1726] text-white"
              : "bg-[#EEF2F5] text-[#98A5B5]"
          }`}
        >
          {number}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm font-semibold text-[#0D1726]">
              {title}
            </p>

            <span
              className={`shrink-0 rounded-full px-2 py-1 text-[9px] font-bold uppercase tracking-[0.08em] ${
                ready
                  ? active
                    ? "bg-[#E8F9F6] text-[#0F8F82]"
                    : "bg-[#EEF1FF] text-[#3548D8]"
                  : "bg-[#EEF2F5] text-[#98A5B5]"
              }`}
            >
              {status}
            </span>
          </div>

          <p className="mt-2 text-xs leading-5 text-[#69788A]">
            {description}
          </p>
        </div>
      </div>
    </a>
  );
}

/* =========================================================
   PAGE
   ========================================================= */

export default function Home() {
  const scanSectionRef =
    useRef<HTMLElement | null>(
      null
    );

  const walletSectionRef =
    useRef<HTMLElement | null>(
      null
    );

  const [
    query,
    setQuery,
  ] =
    useState("");

  const [
    marketData,
    setMarketData,
  ] =
    useState<MarketData | null>(
      null
    );

  const [
    history,
    setHistory,
  ] =
    useState<HistoryData | null>(
      null
    );

  const [
    replayPreview,
    setReplayPreview,
  ] =
    useState<ReplayPreview | null>(
      null
    );

  const [
    range,
    setRange,
  ] =
    useState<ChartRange>(
      "7"
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
    projectAccountData,
    setProjectAccountData,
  ] =
    useState<ProjectAccountResponse | null>(
      null
    );

  const [
    selectedAccount,
    setSelectedAccount,
  ] =
    useState<ProjectAccount | null>(
      null
    );

  const [
    walletQuery,
    setWalletQuery,
  ] =
    useState("");

  const [
    walletChain,
    setWalletChain,
  ] =
    useState<WalletScanChain>(
      "ethereum"
    );

  const [
    evmWalletData,
    setEvmWalletData,
  ] =
    useState<EvmWalletData | null>(
      null
    );

  const [
    solanaWalletData,
    setSolanaWalletData,
  ] =
    useState<SolanaWalletData | null>(
      null
    );

  const [
    walletLoading,
    setWalletLoading,
  ] =
    useState(false);

  const [
    walletError,
    setWalletError,
  ] =
    useState("");

  const [
    perspective,
    setPerspective,
  ] =
    useState<PerspectiveData | null>(
      null
    );

  const [
    perspectiveLoading,
    setPerspectiveLoading,
  ] =
    useState(false);

  /* =======================================================
     API
     ======================================================= */

  async function fetchHistory(
    coinId: string,
    selectedRange: ChartRange
  ) {
    try {
      const response =
        await fetch(
          `/api/history?id=${encodeURIComponent(
            coinId
          )}&days=${selectedRange}`,
          {
            cache:
              "no-store",
          }
        );

      if (!response.ok) {
        return null;
      }

      const data =
        await response.json();

      setHistory(data);

      return data as HistoryData;
    } catch {
      return null;
    }
  }

  async function fetchReplayPreview(
    coinId: string
  ) {
    try {
      const response =
        await fetch(
          `/api/replay?id=${encodeURIComponent(
            coinId
          )}&lookback=7&forward=7`,
          {
            cache:
              "no-store",
          }
        );

      if (!response.ok) {
        return null;
      }

      const data =
        await response.json();

      setReplayPreview(data);

      return data as ReplayPreview;
    } catch {
      return null;
    }
  }

  async function fetchProjectAccounts(
    name: string,
    symbol: string
  ) {
    try {
      let response =
        await fetch(
          `/api/project-wallets?project=${encodeURIComponent(
            symbol
          )}`,
          {
            cache:
              "no-store",
          }
        );

      let data =
        await response.json();

      if (
        response.ok &&
        data.count === 0
      ) {
        response =
          await fetch(
            `/api/project-wallets?project=${encodeURIComponent(
              name
            )}`,
            {
              cache:
                "no-store",
            }
          );

        data =
          await response.json();
      }

      if (!response.ok) {
        return null;
      }

      setProjectAccountData(
        data
      );

      return data as ProjectAccountResponse;
    } catch {
      return null;
    }
  }

  async function generatePerspective(
    market: MarketData,
    historyData: HistoryData | null,
    accounts:
      ProjectAccountResponse | null,
    account?:
      ProjectAccount | null,
    evm?:
      EvmWalletData | null,
    solana?:
      SolanaWalletData | null
  ) {
    try {
      setPerspectiveLoading(
        true
      );

      const response =
        await fetch(
          "/api/perspective",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                token: {
                  id:
                    market.id,

                  name:
                    market.name,

                  symbol:
                    market.symbol,

                  price:
                    market.price,

                  change24h:
                    market.change24h,

                  marketCap:
                    market.marketCap,

                  volume24h:
                    market.volume24h,

                  rangeChange:
                    historyData
                      ?.rangeChange,

                  rangeDays:
                    historyData
                      ?.days,
                },

                projectAccounts:
                  accounts
                    ?.accounts ??
                  [],

                account:
                  account
                    ? {
                        address:
                          account.address,

                        label:
                          account.label,

                        chain:
                          account.chain,

                        accountType:
                          account.accountType,

                        confidence:
                          account.confidence,

                        isAttributed:
                          true,
                      }
                    : undefined,

                evmSummary:
                  evm?.summary,

                solanaSummary:
                  solana?.summary,
              }),
          }
        );

      if (!response.ok) {
        return;
      }

      const data =
        await response.json();

      setPerspective(data);
    } finally {
      setPerspectiveLoading(
        false
      );
    }
  }

  async function runTokenScan(
    searchTerm: string
  ) {
    const cleanQuery =
      searchTerm.trim();

    if (!cleanQuery) {
      setError(
        "Enter a token name or symbol."
      );

      return;
    }

    try {
      setLoading(true);

      setError("");

      setMarketData(null);
      setHistory(null);
      setReplayPreview(null);
      setPerspective(null);
      setSelectedAccount(null);
      setEvmWalletData(null);
      setSolanaWalletData(null);
      setProjectAccountData(null);

      const response =
        await fetch(
          `/api/market?q=${encodeURIComponent(
            cleanQuery
          )}`,
          {
            cache:
              "no-store",
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Unable to retrieve token data."
        );
      }

      const market =
        data as MarketData;

      setMarketData(
        market
      );

      setQuery(
        market.symbol
      );

      const [
        historyResult,
        accountsResult,
      ] =
        await Promise.all([
          fetchHistory(
            market.id,
            range
          ),

          fetchProjectAccounts(
            market.name,
            market.symbol
          ),

          fetchReplayPreview(
            market.id
          ),
        ]);

      await generatePerspective(
        market,
        historyResult,
        accountsResult
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "PRISM scan failed."
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleScan() {
    await runTokenScan(
      query
    );
  }

  async function runWalletScan(
    address: string,
    chain: WalletScanChain,
    account:
      ProjectAccount | null
  ) {
    try {
      setWalletLoading(true);

      setWalletError("");

      setWalletChain(chain);

      const endpoint =
        chain === "solana"
          ? `/api/wallet-solana?address=${encodeURIComponent(
              address
            )}`
          : `/api/wallet?address=${encodeURIComponent(
              address
            )}&chain=${encodeURIComponent(
              chain
            )}`;

      const response =
        await fetch(
          endpoint,
          {
            cache:
              "no-store",
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Account scan failed."
        );
      }

      if (
        chain === "solana"
      ) {
        setSolanaWalletData(
          data
        );

        setEvmWalletData(
          null
        );

        if (marketData) {
          await generatePerspective(
            marketData,
            history,
            projectAccountData,
            account,
            null,
            data
          );
        }
      } else {
        setEvmWalletData(
          data
        );

        setSolanaWalletData(
          null
        );

        if (marketData) {
          await generatePerspective(
            marketData,
            history,
            projectAccountData,
            account,
            data,
            null
          );
        }
      }
    } catch (err) {
      setWalletError(
        err instanceof Error
          ? err.message
          : "Account scan failed."
      );
    } finally {
      setWalletLoading(false);
    }
  }

  async function inspectProjectAccount(
    account: ProjectAccount
  ) {
    if (
      !isWalletScanChain(
        account.chain
      )
    ) {
      return;
    }

    setSelectedAccount(
      account
    );

    setWalletChain(
      account.chain
    );

    setWalletQuery(
      account.address
    );

    walletSectionRef.current?.scrollIntoView(
      {
        behavior:
          "smooth",

        block:
          "start",
      }
    );

    await runWalletScan(
      account.address,
      account.chain,
      account
    );
  }

  async function openWatchlistToken(
    token: WatchlistToken
  ) {
    scanSectionRef.current?.scrollIntoView(
      {
        behavior:
          "smooth",

        block:
          "start",
      }
    );

    await runTokenScan(
      token.symbol ||
        token.name
    );
  }

  async function openWatchlistAccount(
    account: WatchlistAccount
  ) {
    if (
      account.chain !==
        "ethereum" &&
      account.chain !==
        "arbitrum" &&
      account.chain !==
        "solana"
    ) {
      setWalletError(
        `${account.chain} scanning is not connected yet.`
      );

      return;
    }

    const projectAccount:
      ProjectAccount = {
        address:
          account.address,

        addressShort:
          `${account.address.slice(
            0,
            6
          )}...${account.address.slice(
            -5
          )}`,

        project:
          account.project ??
          account.label,

        symbol:
          null,

        chain:
          account.chain,

        label:
          account.label,

        accountType:
          account.accountType as ProjectAccountType,

        walletType:
          "project",

        isWallet:
          account.accountType !==
          "program",

        confidence:
          "verified",

        source:
          "Saved PRISM Watchlist",

        sourceUrl:
          "",

        explanation:
          "This account was reopened from the local PRISM watchlist.",
      };

    setSelectedAccount(
      projectAccount
    );

    setWalletQuery(
      account.address
    );

    setWalletChain(
      account.chain
    );

    walletSectionRef.current?.scrollIntoView(
      {
        behavior:
          "smooth",

        block:
          "start",
      }
    );

    await runWalletScan(
      account.address,
      account.chain,
      projectAccount
    );
  }

  const currentWatchlistToken:
    WatchlistToken | null =
    marketData
      ? {
          type:
            "token",

          id:
            marketData.id,

          name:
            marketData.name,

          symbol:
            marketData.symbol,

          image:
            marketData.image,
        }
      : null;

  const currentWatchlistAccount:
    WatchlistAccount | null =
    selectedAccount
      ? {
          type:
            "account",

          address:
            selectedAccount.address,

          label:
            selectedAccount.label,

          chain:
            selectedAccount.chain,

          accountType:
            selectedAccount.accountType,

          project:
            selectedAccount.project,
        }
      : null;

  const marketLoaded =
    Boolean(marketData);

  const accountsLoaded =
    Boolean(
      marketData &&
        projectAccountData
    );

  const replayLoaded =
    Boolean(
      marketData &&
        replayPreview
    );

  const perspectiveLoaded =
    Boolean(
      marketData &&
        perspective
    );

  /* =======================================================
     UI
     ======================================================= */

  return (
    <main className="prism-shell">
      {/* NAV */}

      <header className="sticky top-0 z-50 border-b border-[#E3E8EE] bg-white/90 backdrop-blur-xl">
        <div className="prism-container">
          <div className="flex h-[68px] items-center justify-between sm:h-[72px]">
            <a
              href="#scan"
              className="flex items-center gap-3"
            >
              <div className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-[13px] bg-[#0D1726] shadow-sm">
                <div className="absolute -left-2 top-0 h-7 w-7 rounded-full bg-[#465FFF]/70 blur-md" />

                <div className="absolute -bottom-2 -right-1 h-7 w-7 rounded-full bg-[#16B8A6]/60 blur-md" />

                <span className="relative text-sm font-bold text-white">
                  P
                </span>
              </div>

              <div>
                <p className="text-[15px] font-bold tracking-[-0.02em] text-[#0D1726]">
                  PRISM
                </p>

                <p className="hidden text-[11px] text-[#98A5B5] sm:block">
                  Crypto Intelligence Desk
                </p>
              </div>
            </a>

            <nav className="hidden items-center gap-1 lg:flex">
              {navItems.map(
                (item) => (
                  <a
                    key={
                      item.href
                    }
                    href={
                      item.href
                    }
                    className="rounded-xl px-4 py-2 text-sm font-medium text-[#69788A] transition hover:bg-[#F1F5F7] hover:text-[#0D1726]"
                  >
                    {
                      item.label
                    }
                  </a>
                )
              )}
            </nav>

            <div className="hidden items-center gap-2 lg:flex">
              <div className="flex items-center gap-2 rounded-full border border-[#E3E8EE] bg-white px-3 py-2 text-xs font-medium text-[#405064] shadow-sm">
                <span className="prism-live-dot" />

                Live intelligence
              </div>

              <a
                href="#scan"
                className="prism-button-primary px-4 py-2.5 text-xs font-semibold"
              >
                New scan
              </a>
            </div>

            <MobileNav
              items={
                navItems
              }
            />
          </div>
        </div>
      </header>

      {/* HERO */}

      <section
        id="scan"
        ref={
          scanSectionRef
        }
        className="relative scroll-mt-20 overflow-hidden"
      >
        <div className="prism-hero-grid" />

        <div className="prism-orb prism-orb-primary left-[-100px] top-[90px] h-[330px] w-[330px]" />

        <div className="prism-orb prism-orb-signal right-[-100px] top-[130px] h-[350px] w-[350px]" />

        <div className="prism-data-line left-[4%] top-[20%] w-[34%]" />
        <div className="prism-data-line right-[5%] top-[30%] w-[29%]" />
        <div className="prism-data-line left-[12%] top-[72%] w-[38%]" />
        <div className="prism-data-line right-[9%] top-[82%] w-[28%]" />

        <div className="prism-data-line-vertical left-[48%] top-[10%] h-[38%]" />
        <div className="prism-data-line-vertical right-[16%] top-[55%] h-[28%]" />

        <div className="prism-container relative z-10">
          <div className="grid min-h-[auto] items-center gap-12 py-14 sm:py-16 lg:min-h-[720px] lg:grid-cols-[0.92fr_1.08fr] lg:gap-14 lg:py-20">
            <div>
              <div className="prism-reveal inline-flex items-center gap-2 rounded-full border border-[#CDD4FF] bg-white/80 px-3 py-1.5 text-[11px] font-semibold text-[#3548D8] shadow-sm backdrop-blur-md sm:text-xs">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#465FFF] text-[9px] text-white">
                  ✦
                </span>

                Evidence-first crypto intelligence
              </div>

              <h1 className="prism-reveal prism-reveal-delay-1 mt-6 max-w-[680px] text-[40px] font-bold leading-[1.03] tracking-[-0.048em] text-[#0D1726] sm:mt-7 sm:text-[58px] lg:text-[64px]">
                Follow the evidence.
                <br />

                <span className="bg-gradient-to-r from-[#465FFF] via-[#3F70DF] to-[#16B8A6] bg-clip-text text-transparent">
                  Find the signal.
                </span>
              </h1>

              <p className="prism-reveal prism-reveal-delay-2 mt-5 max-w-[590px] text-[15px] leading-7 text-[#69788A] sm:mt-6 sm:text-[17px] sm:leading-8">
                PRISM connects market movement,
                historical patterns and attributable
                on-chain activity into one
                investigation — while keeping
                observations separate from assumptions.
              </p>

              <div className="prism-reveal prism-reveal-delay-3 mt-7 max-w-[660px] rounded-[20px] border border-[#CFD7E1] bg-white/90 p-2 shadow-[0_16px_40px_rgba(13,23,38,0.09)] backdrop-blur-md sm:mt-9">
                <div className="flex flex-col gap-2 sm:flex-row">
                  <div className="flex min-w-0 flex-1 items-center">
                    <div className="ml-3 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#EEF2F5] text-[#69788A]">
                      ⌕
                    </div>

                    <input
                      value={
                        query
                      }
                      onChange={(
                        event
                      ) =>
                        setQuery(
                          event.target.value
                        )
                      }
                      onKeyDown={(
                        event
                      ) => {
                        if (
                          event.key ===
                          "Enter"
                        ) {
                          handleScan();
                        }
                      }}
                      placeholder="Search ENS, UNI, ARB, SOL..."
                      className="h-12 min-w-0 flex-1 bg-transparent px-3 text-sm text-[#0D1726] outline-none placeholder:text-[#98A5B5]"
                    />
                  </div>

                  <button
                    type="button"
                    disabled={
                      loading
                    }
                    onClick={
                      handleScan
                    }
                    className="prism-button-primary h-12 px-6 text-sm font-semibold"
                  >
                    {loading
                      ? "Investigating..."
                      : "Run PRISM Scan"}
                  </button>
                </div>
              </div>

              {error && (
                <div className="mt-3 max-w-[660px] rounded-xl border border-[#F6CACA] bg-[#FFF1F1] px-4 py-3 text-sm text-[#C03E3E]">
                  {
                    error
                  }
                </div>
              )}

              <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-[#98A5B5] sm:gap-x-6 sm:text-xs">
                <span className="flex items-center gap-2">
                  <span className="text-[#16B8A6]">
                    ✓
                  </span>
                  Multi-chain
                </span>

                <span className="flex items-center gap-2">
                  <span className="text-[#16B8A6]">
                    ✓
                  </span>
                  Evidence-backed
                </span>

                <span className="flex items-center gap-2">
                  <span className="text-[#16B8A6]">
                    ✓
                  </span>
                  Historical replay
                </span>
              </div>
            </div>

            {/* INVESTIGATION CONSOLE */}

            <div className="relative">
              <div className="relative overflow-hidden rounded-[24px] border border-[#DCE3E9] bg-white/95 shadow-[0_28px_70px_rgba(13,23,38,0.11)] backdrop-blur-xl sm:rounded-[30px] sm:shadow-[0_32px_90px_rgba(13,23,38,0.13)]">
                <div className="prism-scanner" />

                <div className="relative z-10 flex items-center justify-between border-b border-[#E7EBF0] px-4 py-4 sm:px-6">
                  <div className="flex items-center gap-2">
                    <div className="h-2.5 w-2.5 rounded-full bg-[#EF5B5B]" />
                    <div className="h-2.5 w-2.5 rounded-full bg-[#FFB44A]" />
                    <div className="h-2.5 w-2.5 rounded-full bg-[#16B8A6]" />
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="prism-live-dot" />

                    <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-[#69788A] sm:text-[11px]">
                      Investigation Console
                    </p>
                  </div>
                </div>

                <div className="relative z-10 p-4 sm:p-7">
                  {marketData ? (
                    <div className="flex flex-col gap-5 border-b border-[#E7EBF0] pb-6 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex items-center gap-3 sm:gap-4">
                        {marketData.image ? (
                          <img
                            src={
                              marketData.image
                            }
                            alt={
                              marketData.name
                            }
                            className="h-11 w-11 rounded-2xl border border-[#E3E8EE] bg-white sm:h-12 sm:w-12"
                          />
                        ) : (
                          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#0D1726] text-sm font-bold text-white sm:h-12 sm:w-12">
                            {marketData.symbol.slice(
                              0,
                              1
                            )}
                          </div>
                        )}

                        <div>
                          <p className="text-base font-semibold text-[#0D1726] sm:text-lg">
                            {
                              marketData.name
                            }
                          </p>

                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#98A5B5] sm:text-xs">
                              {
                                marketData.symbol
                              }
                            </p>

                            <span className="h-1 w-1 rounded-full bg-[#CBD3DC]" />

                            <p className="text-[11px] text-[#69788A] sm:text-xs">
                              Investigation active
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="sm:text-right">
                        <p className="text-xl font-bold tracking-[-0.03em] text-[#0D1726] sm:text-2xl">
                          {formatPrice(
                            marketData.price
                          )}
                        </p>

                        <p
                          className={`mt-1 text-sm font-semibold ${
                            marketData.change24h >=
                            0
                              ? "text-[#16B8A6]"
                              : "text-[#EF5B5B]"
                          }`}
                        >
                          {marketData.change24h >=
                          0
                            ? "+"
                            : ""}
                          {marketData.change24h.toFixed(
                            2
                          )}
                          %
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="border-b border-[#E7EBF0] pb-6">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#EEF1FF] text-lg text-[#465FFF] sm:h-12 sm:w-12">
                        ◈
                      </div>

                      <p className="mt-4 text-lg font-semibold tracking-[-0.02em] text-[#0D1726] sm:text-xl">
                        Awaiting investigation
                      </p>

                      <p className="mt-2 max-w-lg text-[13px] leading-6 text-[#69788A] sm:text-sm">
                        Search a token and PRISM will
                        progressively load its market
                        data, attributable accounts,
                        historical analogues and
                        evidence synthesis.
                      </p>
                    </div>
                  )}

                  <div className="mt-6">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#98A5B5] sm:text-[10px]">
                        Investigation pipeline
                      </p>

                      {marketData && (
                        <span className="prism-chip prism-chip-success !text-[9px] sm:!text-[10px]">
                          <SignalDot status="positive" />

                          Running
                        </span>
                      )}
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <InvestigationStep
                        number="01"
                        title="Market"
                        href="#market-investigation"
                        ready={
                          marketLoaded
                        }
                        active={
                          marketLoaded
                        }
                        status={
                          marketLoaded
                            ? "Loaded"
                            : "Waiting"
                        }
                        description={
                          marketData
                            ? `${formatPrice(
                                marketData.price
                              )} · ${marketData.change24h >= 0 ? "+" : ""}${marketData.change24h.toFixed(
                                2
                              )}% in 24h`
                            : "Price, market cap and trading activity."
                        }
                      />

                      <InvestigationStep
                        number="02"
                        title="Project Accounts"
                        href="#market-investigation"
                        ready={
                          accountsLoaded
                        }
                        status={
                          accountsLoaded
                            ? `${projectAccountData?.count ?? 0} found`
                            : "Waiting"
                        }
                        description={
                          accountsLoaded
                            ? projectAccountData!.count >
                              0
                              ? `${projectAccountData!.count} evidence-backed account${projectAccountData!.count === 1 ? "" : "s"} identified.`
                              : "No attributable project accounts in the current registry."
                            : "Treasury, governance and protocol attribution."
                        }
                      />

                      <InvestigationStep
                        number="03"
                        title="Historical Replay"
                        href="#replay"
                        ready={
                          replayLoaded
                        }
                        status={
                          replayLoaded
                            ? `${replayPreview?.matchCount ?? 0} matches`
                            : "Waiting"
                        }
                        description={
                          replayLoaded
                            ? `${replayPreview!.matchCount} similar historical periods available for comparison.`
                            : "Compare the current move with previous market periods."
                        }
                      />

                      <InvestigationStep
                        number="04"
                        title="Perspective"
                        href="#perspective"
                        ready={
                          perspectiveLoaded
                        }
                        active={
                          perspectiveLoaded
                        }
                        status={
                          perspective
                            ? perspectiveStatusLabel(
                                perspective.status
                              )
                            : perspectiveLoading
                            ? "Synthesizing"
                            : "Waiting"
                        }
                        description={
                          perspective
                            ? perspective.headline
                            : "Translate the strongest evidence into cautious context."
                        }
                      />
                    </div>
                  </div>

                  <div className="mt-5 overflow-hidden rounded-[18px] bg-[#0D1726] p-4 text-white sm:rounded-[20px] sm:p-5">
                    <div className="flex items-center justify-between">
                      <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-white/45 sm:text-[10px]">
                        Current observation
                      </p>

                      <span className="prism-live-dot" />
                    </div>

                    <p className="mt-4 text-[13px] font-medium leading-6 text-white/90 sm:text-sm">
                      {perspective
                        ? perspective.headline
                        : marketData
                        ? "Market evidence loaded. PRISM is connecting historical and project-account context."
                        : "No token is being investigated yet. Start with a token name or symbol."}
                    </p>

                    {marketData && (
                      <div className="mt-5 grid grid-cols-2 gap-3">
                        <div className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-3">
                          <p className="text-[8px] font-bold uppercase tracking-[0.12em] text-white/35 sm:text-[9px]">
                            Market cap
                          </p>

                          <p className="mt-2 text-xs font-semibold text-white sm:text-sm">
                            {formatCurrency(
                              marketData.marketCap
                            )}
                          </p>
                        </div>

                        <div className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-3">
                          <p className="text-[8px] font-bold uppercase tracking-[0.12em] text-white/35 sm:text-[9px]">
                            24h volume
                          </p>

                          <p className="mt-2 text-xs font-semibold text-white sm:text-sm">
                            {formatCurrency(
                              marketData.volume24h
                            )}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* MARKET INVESTIGATION */}

      <section
        id="market-investigation"
        className="scroll-mt-24 pb-14 sm:pb-20"
      >
        <div className="prism-container">
          <div className="mb-7 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="prism-eyebrow">
                Market investigation
              </p>

              <h2 className="prism-section-title mt-3">
                One asset. Multiple layers of evidence.
              </h2>

              <p className="prism-section-copy mt-4 max-w-2xl">
                Start with market structure, then
                move into attributable project
                accounts, historical patterns and
                on-chain activity.
              </p>
            </div>

            {marketData && (
              <span className="prism-chip prism-chip-success w-fit">
                <SignalDot status="positive" />

                Live data loaded
              </span>
            )}
          </div>

          <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr] lg:gap-6">
            <div className="prism-surface overflow-hidden">
              <div className="flex flex-col gap-4 border-b border-[#E3E8EE] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                {marketData ? (
                  <div className="flex items-center gap-3">
                    {marketData.image ? (
                      <img
                        src={
                          marketData.image
                        }
                        alt={
                          marketData.name
                        }
                        className="h-10 w-10 rounded-xl border border-[#E3E8EE]"
                      />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EEF1FF] text-sm font-bold text-[#465FFF]">
                        {marketData.symbol.slice(
                          0,
                          1
                        )}
                      </div>
                    )}

                    <div>
                      <p className="font-semibold text-[#0D1726]">
                        {
                          marketData.name
                        }
                      </p>

                      <p className="mt-0.5 text-xs uppercase tracking-[0.08em] text-[#98A5B5]">
                        {
                          marketData.symbol
                        }{" "}
                        / USD
                      </p>
                    </div>
                  </div>
                ) : (
                  <div>
                    <p className="font-semibold text-[#0D1726]">
                      Market data
                    </p>

                    <p className="mt-1 text-xs text-[#98A5B5]">
                      Waiting for an investigation
                    </p>
                  </div>
                )}

                <div className="flex w-fit items-center gap-1 rounded-xl bg-[#F1F5F7] p-1">
                  {(
                    [
                      "1",
                      "7",
                      "30",
                      "90",
                    ] as ChartRange[]
                  ).map(
                    (
                      item
                    ) => (
                      <button
                        key={
                          item
                        }
                        type="button"
                        disabled={
                          !marketData
                        }
                        onClick={async () => {
                          setRange(
                            item
                          );

                          if (
                            marketData
                          ) {
                            const result =
                              await fetchHistory(
                                marketData.id,
                                item
                              );

                            if (
                              result
                            ) {
                              await generatePerspective(
                                marketData,
                                result,
                                projectAccountData,
                                selectedAccount,
                                evmWalletData,
                                solanaWalletData
                              );
                            }
                          }
                        }}
                        className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                          range ===
                          item
                            ? "bg-white text-[#0D1726] shadow-sm"
                            : "text-[#69788A] hover:text-[#0D1726]"
                        } disabled:cursor-not-allowed disabled:opacity-35`}
                      >
                        {rangeLabel(
                          item
                        )}
                      </button>
                    )
                  )}
                </div>
              </div>

              <div className="p-4 sm:p-6">
                {marketData &&
                history ? (
                  <>
                    <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                      <div>
                        <p className="text-2xl font-bold tracking-[-0.04em] text-[#0D1726] sm:text-3xl">
                          {formatPrice(
                            marketData.price
                          )}
                        </p>

                        <p
                          className={`mt-1 text-sm font-semibold ${
                            marketData.change24h >=
                            0
                              ? "text-[#16B8A6]"
                              : "text-[#EF5B5B]"
                          }`}
                        >
                          {marketData.change24h >=
                          0
                            ? "+"
                            : ""}
                          {marketData.change24h.toFixed(
                            2
                          )}
                          % today
                        </p>
                      </div>

                      <div className="w-fit rounded-xl border border-[#E3E8EE] bg-[#F9FBFC] px-4 py-2 text-left sm:text-right">
                        <p className="text-[11px] text-[#98A5B5]">
                          {rangeLabel(
                            range
                          )}{" "}
                          movement
                        </p>

                        <p
                          className={`mt-1 text-sm font-semibold ${
                            history.rangeChange >=
                            0
                              ? "text-[#16B8A6]"
                              : "text-[#EF5B5B]"
                          }`}
                        >
                          {history.rangeChange >=
                          0
                            ? "+"
                            : ""}
                          {history.rangeChange.toFixed(
                            2
                          )}
                          %
                        </p>
                      </div>
                    </div>

                    <PriceChart
                      history={
                        history
                      }
                      positive={
                        history.rangeChange >=
                        0
                      }
                    />
                  </>
                ) : (
                  <div className="flex h-[280px] items-center justify-center rounded-2xl border border-dashed border-[#CFD7E1] bg-[#F9FBFC] sm:h-[320px]">
                    <div className="max-w-xs px-4 text-center">
                      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#EEF1FF] text-[#465FFF]">
                        ↗
                      </div>

                      <p className="mt-4 text-sm font-semibold text-[#405064]">
                        No market investigation yet
                      </p>

                      <p className="mt-2 text-xs leading-5 text-[#98A5B5]">
                        Search a token above to load
                        real market history.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="prism-surface overflow-hidden">
              <div className="border-b border-[#E3E8EE] p-4 sm:p-6">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-[#0D1726]">
                      Project accounts
                    </p>

                    <p className="mt-1 text-xs leading-5 text-[#98A5B5]">
                      Evidence-backed public attribution only.
                    </p>
                  </div>

                  {projectAccountData && (
                    <span className="prism-chip prism-chip-primary shrink-0">
                      {
                        projectAccountData.count
                      }{" "}
                      found
                    </span>
                  )}
                </div>
              </div>

              <div className="p-3 sm:p-4">
                {projectAccountData &&
                projectAccountData.accounts.length >
                  0 ? (
                  <div className="space-y-3">
                    {projectAccountData.accounts.map(
                      (
                        account
                      ) => (
                        <div
                          key={`${account.chain}-${account.address}`}
                          className="rounded-[18px] border border-[#E3E8EE] bg-white p-4 transition hover:border-[#C2CAFF] hover:shadow-sm"
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EEF1FF] text-sm font-bold text-[#465FFF]">
                              {chainInitial(
                                account.chain
                              )}
                            </div>

                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold text-[#0D1726]">
                                {
                                  account.label
                                }
                              </p>

                              <div className="mt-2 flex flex-wrap gap-2">
                                <span className="prism-chip !px-2 !py-1 !text-[10px]">
                                  {chainLabel(
                                    account.chain
                                  )}
                                </span>

                                <span className="prism-chip prism-chip-primary !px-2 !py-1 !text-[10px]">
                                  {accountTypeLabel(
                                    account.accountType
                                  )}
                                </span>

                                <span className="prism-chip prism-chip-success !px-2 !py-1 !text-[10px]">
                                  {
                                    account.confidence
                                  }
                                </span>
                              </div>

                              <p className="mt-3 line-clamp-2 text-xs leading-5 text-[#69788A]">
                                {
                                  account.explanation
                                }
                              </p>

                              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                                <a
                                  href={
                                    account.sourceUrl
                                  }
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-[11px] font-medium text-[#69788A] hover:text-[#3548D8]"
                                >
                                  Verify source ↗
                                </a>

                                <button
                                  type="button"
                                  disabled={
                                    !isWalletScanChain(
                                      account.chain
                                    )
                                  }
                                  onClick={() =>
                                    inspectProjectAccount(
                                      account
                                    )
                                  }
                                  className="prism-button-secondary px-3 py-2 text-[11px] font-semibold disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                  {isWalletScanChain(
                                    account.chain
                                  )
                                    ? "Inspect"
                                    : "Coming soon"}
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    )}
                  </div>
                ) : projectAccountData ? (
                  <div className="flex min-h-[280px] items-center justify-center rounded-2xl border border-dashed border-[#CFD7E1] bg-[#F9FBFC] p-6 sm:min-h-[300px] sm:p-8">
                    <div className="max-w-[280px] text-center">
                      <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-[#EEF2F5] text-[#69788A]">
                        ◇
                      </div>

                      <p className="mt-4 text-sm font-semibold text-[#405064]">
                        No attributable accounts
                      </p>

                      <p className="mt-2 text-xs leading-5 text-[#98A5B5]">
                        PRISM does not invent account
                        ownership where reliable
                        evidence is unavailable.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex min-h-[280px] items-center justify-center rounded-2xl border border-dashed border-[#CFD7E1] bg-[#F9FBFC] p-6 sm:min-h-[300px] sm:p-8">
                    <div className="text-center">
                      <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-[#EEF1FF] text-[#465FFF]">
                        ◈
                      </div>

                      <p className="mt-4 text-sm font-semibold text-[#405064]">
                        Awaiting token scan
                      </p>

                      <p className="mt-2 text-xs text-[#98A5B5]">
                        Known project accounts will
                        appear here.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PERSPECTIVE */}

      <section
        id="perspective"
        className="scroll-mt-24 border-y border-[#E3E8EE] bg-white py-14 sm:py-20"
      >
        <div className="prism-container">
          <div className="grid gap-8 lg:grid-cols-[0.75fr_1.25fr] lg:gap-10">
            <div>
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[#EEF1FF] text-[#465FFF]">
                ✦
              </div>

              <p className="prism-eyebrow mt-5">
                Evidence synthesis
              </p>

              <h2 className="prism-section-title mt-3">
                PRISM Perspective
              </h2>

              <p className="prism-section-copy mt-5 max-w-lg">
                Perspective separates what the data
                actually shows from conclusions the
                evidence cannot support.
              </p>
            </div>

            {perspectiveLoading ? (
              <div className="prism-gradient-panel flex min-h-[340px] items-center justify-center p-6 sm:min-h-[430px] sm:p-8">
                <div className="text-center">
                  <div className="mx-auto h-8 w-8 animate-spin rounded-full border-[3px] border-[#465FFF]/15 border-t-[#465FFF]" />

                  <p className="mt-4 text-sm font-medium text-[#69788A]">
                    Synthesizing evidence...
                  </p>
                </div>
              </div>
            ) : perspective ? (
              <div className="overflow-hidden rounded-[24px] border border-[#DDE4E9] bg-gradient-to-br from-[#F7F9FF] via-white to-[#F0FAF8] shadow-[0_18px_50px_rgba(13,23,38,0.07)] sm:rounded-[28px]">
                <div className="p-5 sm:p-8">
                  <span
                    className={`prism-chip ${perspectiveStatusClass(
                      perspective.status
                    )}`}
                  >
                    {perspectiveStatusLabel(
                      perspective.status
                    )}
                  </span>

                  <h3 className="mt-5 text-xl font-bold leading-8 tracking-[-0.03em] text-[#0D1726] sm:text-2xl sm:leading-9">
                    {
                      perspective.headline
                    }
                  </h3>
                </div>

                <div className="grid border-t border-[#E3E8EE] md:grid-cols-3">
                  <div className="p-5 sm:p-6">
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#405064]">
                      What PRISM sees
                    </p>

                    <p className="mt-4 text-sm leading-7 text-[#69788A]">
                      {
                        perspective.whatPrismSees
                      }
                    </p>
                  </div>

                  <div className="border-t border-[#E3E8EE] p-5 sm:p-6 md:border-l md:border-t-0">
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#405064]">
                      Why it may matter
                    </p>

                    <p className="mt-4 text-sm leading-7 text-[#69788A]">
                      {
                        perspective.whyItMayMatter
                      }
                    </p>
                  </div>

                  <div className="border-t border-[#E3E8EE] p-5 sm:p-6 md:border-l md:border-t-0">
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#405064]">
                      What we cannot conclude
                    </p>

                    <p className="mt-4 text-sm leading-7 text-[#69788A]">
                      {
                        perspective.whatWeCannotConclude
                      }
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="prism-gradient-panel flex min-h-[340px] items-center justify-center p-6 sm:min-h-[430px] sm:p-8">
                <div className="max-w-sm text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-xl text-[#465FFF] shadow-md">
                    ✦
                  </div>

                  <p className="mt-5 text-base font-semibold text-[#0D1726]">
                    No Perspective yet
                  </p>

                  <p className="mt-2 text-sm leading-6 text-[#69788A]">
                    Run a token scan to generate an
                    evidence-based interpretation.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* REPLAY */}

      <div className="prism-container">
        <ReplaySection
          coinId={
            marketData?.id ??
            null
          }
          tokenName={
            marketData?.name
          }
          tokenSymbol={
            marketData?.symbol
          }
        />
      </div>

      {/* ACCOUNTS */}

      <section
        id="wallet"
        ref={
          walletSectionRef
        }
        className="scroll-mt-24 border-y border-[#E3E8EE] bg-white py-14 sm:py-20"
      >
        <div className="prism-container">
          <div>
            <p className="prism-eyebrow">
              On-chain evidence
            </p>

            <h2 className="prism-section-title mt-3">
              Account Intelligence
            </h2>

            <p className="prism-section-copy mt-4 max-w-2xl">
              Inspect public accounts using the
              correct chain adapter and view activity
              with attribution context.
            </p>
          </div>

          <div className="mt-7 rounded-[20px] border border-[#CFD7E1] bg-white p-2 shadow-[0_10px_30px_rgba(13,23,38,0.07)] sm:mt-9 sm:rounded-[22px]">
            <div className="grid gap-2 md:grid-cols-[180px_1fr_auto]">
              <select
                value={
                  walletChain
                }
                onChange={(
                  event
                ) => {
                  setWalletChain(
                    event.target
                      .value as WalletScanChain
                  );

                  setSelectedAccount(
                    null
                  );
                }}
                className="prism-select h-12 px-4 text-sm font-medium"
              >
                <option value="ethereum">
                  Ethereum
                </option>

                <option value="arbitrum">
                  Arbitrum
                </option>

                <option value="solana">
                  Solana
                </option>
              </select>

              <input
                value={
                  walletQuery
                }
                onChange={(
                  event
                ) =>
                  setWalletQuery(
                    event.target.value
                  )
                }
                onKeyDown={(
                  event
                ) => {
                  if (
                    event.key ===
                      "Enter" &&
                    walletQuery.trim()
                  ) {
                    setSelectedAccount(
                      null
                    );

                    runWalletScan(
                      walletQuery.trim(),
                      walletChain,
                      null
                    );
                  }
                }}
                placeholder="Paste an account address..."
                className="prism-input h-12 px-4 text-sm"
              />

              <button
                type="button"
                disabled={
                  walletLoading
                }
                onClick={() => {
                  const address =
                    walletQuery.trim();

                  if (!address) {
                    setWalletError(
                      "Enter an account address."
                    );

                    return;
                  }

                  setSelectedAccount(
                    null
                  );

                  runWalletScan(
                    address,
                    walletChain,
                    null
                  );
                }}
                className="prism-button-primary h-12 px-6 text-sm font-semibold"
              >
                {walletLoading
                  ? "Investigating..."
                  : "Inspect account"}
              </button>
            </div>
          </div>

          {walletError && (
            <div className="mt-4 rounded-xl border border-[#F6CACA] bg-[#FFF1F1] px-4 py-3 text-sm text-[#C03E3E]">
              {
                walletError
              }
            </div>
          )}

          {selectedAccount && (
            <div className="mt-7 rounded-[22px] border border-[#DCE3E9] bg-[#F7FAFC] p-4 sm:rounded-[24px] sm:p-6">
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#0D1726] text-sm font-bold text-white sm:h-12 sm:w-12">
                  {chainInitial(
                    selectedAccount.chain
                  )}
                </div>

                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#465FFF] sm:text-xs">
                    Registry attribution
                  </p>

                  <h3 className="mt-2 text-base font-semibold text-[#0D1726] sm:text-lg">
                    {
                      selectedAccount.label
                    }
                  </h3>

                  <p className="mt-3 max-w-2xl text-sm leading-6 text-[#69788A]">
                    {
                      selectedAccount.explanation
                    }
                  </p>
                </div>
              </div>
            </div>
          )}

          {walletLoading && (
            <div className="mt-7 flex min-h-[220px] items-center justify-center rounded-[22px] border border-[#E3E8EE] bg-[#F9FBFC] sm:min-h-[250px] sm:rounded-[24px]">
              <div className="text-center">
                <div className="mx-auto h-8 w-8 animate-spin rounded-full border-[3px] border-[#465FFF]/15 border-t-[#465FFF]" />

                <p className="mt-4 text-sm font-medium text-[#69788A]">
                  Reading account activity...
                </p>
              </div>
            </div>
          )}

          {evmWalletData &&
            !walletLoading && (
              <div className="mt-7 space-y-6">
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
                  <DataMetric
                    label="Transfers"
                    value={
                      evmWalletData.summary
                        .totalTransfers
                    }
                  />

                  <DataMetric
                    label="Attributed"
                    value={
                      evmWalletData.summary
                        .attributedTransfers
                    }
                  />

                  <DataMetric
                    label="Exchange interactions"
                    value={
                      evmWalletData.summary
                        .exchangeInteractions
                    }
                  />

                  <DataMetric
                    label="Project interactions"
                    value={
                      evmWalletData.summary
                        .projectInteractions
                    }
                  />
                </div>

                <div className="overflow-hidden rounded-[22px] border border-[#E3E8EE] bg-white shadow-sm sm:rounded-[24px]">
                  <div className="border-b border-[#E3E8EE] p-4 sm:p-6">
                    <p className="font-semibold text-[#0D1726]">
                      Recent account activity
                    </p>
                  </div>

                  <div className="divide-y divide-[#EEF2F5]">
                    {evmWalletData.activity.map(
                      (
                        item,
                        index
                      ) => {
                        const movement =
                          movementLabel(
                            item.movementContext
                          );

                        return (
                          <div
                            key={`${item.hash}-${index}`}
                            className="grid gap-4 p-4 sm:grid-cols-[110px_1fr_auto] sm:p-6"
                          >
                            <div>
                              <span
                                className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${
                                  item.direction ===
                                  "incoming"
                                    ? "bg-[#E8F9F6] text-[#0F8F82]"
                                    : "bg-[#FFF1F1] text-[#C03E3E]"
                                }`}
                              >
                                {
                                  item.direction
                                }
                              </span>

                              <p className="mt-2 text-[11px] text-[#98A5B5]">
                                {formatWalletDate(
                                  item.timestamp
                                )}
                              </p>
                            </div>

                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="break-words text-sm font-semibold text-[#0D1726]">
                                  {formatTokenValue(
                                    item.value
                                  )}{" "}
                                  {
                                    item.asset
                                  }
                                </p>

                                <span
                                  className={`prism-chip !px-2 !py-1 !text-[10px] ${verificationClass(
                                    item.verification
                                  )}`}
                                >
                                  {verificationLabel(
                                    item.verification
                                  )}
                                </span>

                                {movement && (
                                  <span className="prism-chip prism-chip-primary !px-2 !py-1 !text-[10px]">
                                    {
                                      movement
                                    }
                                  </span>
                                )}
                              </div>

                              <p className="mt-2 break-words text-xs leading-5 text-[#69788A]">
                                {
                                  item.note
                                }
                              </p>
                            </div>

                            {item.explorerUrl && (
                              <a
                                href={
                                  item.explorerUrl
                                }
                                target="_blank"
                                rel="noreferrer"
                                className="w-fit text-xs font-semibold text-[#69788A] hover:text-[#3548D8]"
                              >
                                Explorer ↗
                              </a>
                            )}
                          </div>
                        );
                      }
                    )}
                  </div>
                </div>
              </div>
            )}

          {solanaWalletData &&
            !walletLoading && (
              <div className="mt-7 space-y-6">
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
                  <DataMetric
                    label="Transactions"
                    value={
                      solanaWalletData.summary
                        .transactions
                    }
                  />

                  <DataMetric
                    label="Incoming"
                    value={
                      solanaWalletData.summary
                        .incoming
                    }
                  />

                  <DataMetric
                    label="Outgoing"
                    value={
                      solanaWalletData.summary
                        .outgoing
                    }
                  />

                  <DataMetric
                    label="SPL movements"
                    value={
                      solanaWalletData.summary
                        .tokenMovements
                    }
                  />
                </div>

                <div className="overflow-hidden rounded-[22px] border border-[#E3E8EE] bg-white shadow-sm sm:rounded-[24px]">
                  <div className="border-b border-[#E3E8EE] p-4 sm:p-6">
                    <p className="font-semibold text-[#0D1726]">
                      Recent Solana activity
                    </p>
                  </div>

                  <div className="divide-y divide-[#EEF2F5]">
                    {solanaWalletData.activity.map(
                      (
                        item,
                        index
                      ) => (
                        <div
                          key={`${item.signature}-${index}`}
                          className="grid gap-4 p-4 sm:grid-cols-[110px_1fr_auto] sm:p-6"
                        >
                          <div>
                            <span className="prism-chip !text-[10px]">
                              {
                                item.direction
                              }
                            </span>
                          </div>

                          <div className="min-w-0">
                            <p className="break-words text-sm font-semibold text-[#0D1726]">
                              {item.amount !==
                              null
                                ? `${formatTokenValue(
                                    item.amount
                                  )} `
                                : ""}
                              {
                                item.asset
                              }
                            </p>

                            <p className="mt-2 break-words text-xs leading-5 text-[#69788A]">
                              {
                                item.note
                              }
                            </p>
                          </div>

                          <a
                            href={
                              item.explorerUrl
                            }
                            target="_blank"
                            rel="noreferrer"
                            className="w-fit text-xs font-semibold text-[#69788A] hover:text-[#3548D8]"
                          >
                            Solscan ↗
                          </a>
                        </div>
                      )
                    )}
                  </div>
                </div>
              </div>
            )}

          {!walletLoading &&
            !evmWalletData &&
            !solanaWalletData &&
            !selectedAccount && (
              <div className="mt-7 flex min-h-[240px] items-center justify-center rounded-[22px] border border-dashed border-[#CFD7E1] bg-[#F9FBFC] px-5 sm:min-h-[270px] sm:rounded-[24px]">
                <div className="max-w-sm text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EEF1FF] text-xl text-[#465FFF]">
                    ◇
                  </div>

                  <p className="mt-5 text-base font-semibold text-[#0D1726]">
                    Investigate an account
                  </p>

                  <p className="mt-2 text-sm leading-6 text-[#69788A]">
                    Select a chain and paste a public
                    address, or inspect an attributable
                    project account.
                  </p>
                </div>
              </div>
            )}
        </div>
      </section>

      {/* WATCHLIST */}

      <div className="prism-container">
        <WatchlistSection
          currentToken={
            currentWatchlistToken
          }
          currentAccount={
            currentWatchlistAccount
          }
          onOpenToken={
            openWatchlistToken
          }
          onOpenAccount={
            openWatchlistAccount
          }
        />
      </div>

      {/* FOOTER */}

      <footer className="mt-10 border-t border-[#E3E8EE] bg-white sm:mt-16">
        <div className="prism-container">
          <div className="flex flex-col gap-5 py-8 sm:flex-row sm:items-center sm:justify-between sm:py-10">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#0D1726] text-xs font-bold text-white">
                P
              </div>

              <div>
                <p className="text-sm font-semibold text-[#0D1726]">
                  PRISM
                </p>

                <p className="text-[11px] text-[#98A5B5]">
                  Crypto Intelligence Desk
                </p>
              </div>
            </div>

            <p className="max-w-lg text-xs leading-6 text-[#98A5B5] sm:text-right">
              Evidence and contextual analysis only.
              Historical similarity and blockchain
              activity are not predictions of future
              market direction.
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
}
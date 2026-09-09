"use client";

import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  ColorType,
  createChart,
  LineSeries,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";

import ScanProgress, {
  type ScanStage,
} from "@/components/ScanProgress";

import ResultReveal from "@/components/ResultReveal";

import AnimatedMetric from "@/components/AnimatedMetric";

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

type ChartRange =
  | "1"
  | "7"
  | "30"
  | "90";

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
  direction:
    | "incoming"
    | "outgoing";
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
  importance:
    | "high"
    | "medium"
    | "low";
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
  chain:
    | "ethereum"
    | "arbitrum";
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
    status:
      | "attention"
      | "normal";
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
  status:
    | "success"
    | "failed";
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
    status:
      | "attention"
      | "normal";
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
   NAVIGATION
   ========================================================= */

const navigationItems = [
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

/* =========================================================
   HELPERS
   ========================================================= */

function formatCurrency(
  value: number
) {
  if (
    value >=
    1_000_000_000_000
  ) {
    return `$${(
      value /
      1_000_000_000_000
    ).toFixed(2)}T`;
  }

  if (
    value >=
    1_000_000_000
  ) {
    return `$${(
      value /
      1_000_000_000
    ).toFixed(1)}B`;
  }

  if (
    value >=
    1_000_000
  ) {
    return `$${(
      value /
      1_000_000
    ).toFixed(1)}M`;
  }

  if (
    value >=
    1_000
  ) {
    return `$${(
      value /
      1_000
    ).toFixed(1)}K`;
  }

  return `$${value.toLocaleString(
    undefined,
    {
      maximumFractionDigits: 2,
    }
  )}`;
}

function formatPrice(
  value: number
) {
  return `$${value.toLocaleString(
    undefined,
    {
      minimumFractionDigits:
        value >= 1
          ? 2
          : 0,
      maximumFractionDigits:
        value < 1
          ? 8
          : 4,
    }
  )}`;
}

function formatTokenValue(
  value: number | null
) {
  if (
    value === null
  ) {
    return "Unknown";
  }

  return value.toLocaleString(
    undefined,
    {
      maximumFractionDigits: 8,
    }
  );
}

function rangeLabel(
  range: ChartRange
) {
  if (
    range === "1"
  ) {
    return "1D";
  }

  if (
    range === "7"
  ) {
    return "7D";
  }

  if (
    range === "30"
  ) {
    return "30D";
  }

  return "90D";
}

function chainLabel(
  chain: SupportedChain
) {
  if (
    chain === "ethereum"
  ) {
    return "Ethereum";
  }

  if (
    chain === "arbitrum"
  ) {
    return "Arbitrum";
  }

  if (
    chain === "optimism"
  ) {
    return "Optimism";
  }

  if (
    chain === "polygon"
  ) {
    return "Polygon";
  }

  return "Solana";
}

function chainInitial(
  chain: SupportedChain
) {
  if (
    chain === "ethereum"
  ) {
    return "Ξ";
  }

  if (
    chain === "arbitrum"
  ) {
    return "A";
  }

  if (
    chain === "optimism"
  ) {
    return "O";
  }

  if (
    chain === "polygon"
  ) {
    return "P";
  }

  return "S";
}

function accountTypeLabel(
  type: ProjectAccountType
) {
  if (
    type === "treasury"
  ) {
    return "Treasury";
  }

  if (
    type === "governance"
  ) {
    return "Governance";
  }

  if (
    type === "multisig"
  ) {
    return "Multisig";
  }

  if (
    type === "program"
  ) {
    return "Program";
  }

  if (
    type === "team"
  ) {
    return "Team";
  }

  if (
    type === "investor"
  ) {
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
  if (
    !timestamp
  ) {
    return "Unknown time";
  }

  return new Date(
    timestamp
  ).toLocaleString(
    undefined,
    {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }
  );
}

function perspectiveStatusLabel(
  status:
    PerspectiveData["status"]
) {
  if (
    status === "attention"
  ) {
    return "Attention";
  }

  if (
    status === "watch"
  ) {
    return "Watch";
  }

  return "Quiet";
}

function perspectiveStatusClass(
  status:
    PerspectiveData["status"]
) {
  if (
    status === "attention"
  ) {
    return "prism-chip-warning";
  }

  if (
    status === "watch"
  ) {
    return "prism-chip-primary";
  }

  return "prism-chip-success";
}

function verificationLabel(
  verification:
    VerificationStatus
) {
  if (
    verification === "native"
  ) {
    return "Native";
  }

  if (
    verification === "verified"
  ) {
    return "Verified";
  }

  if (
    verification === "suspicious"
  ) {
    return "Suspicious";
  }

  return "Unverified";
}

function verificationClass(
  verification:
    VerificationStatus
) {
  if (
    verification === "native" ||
    verification === "verified"
  ) {
    return "prism-chip-success";
  }

  if (
    verification === "suspicious"
  ) {
    return "prism-chip-danger";
  }

  return "prism-chip-warning";
}

function movementLabel(
  context:
    MovementContext
) {
  if (
    context === "exchange_inflow"
  ) {
    return "Exchange inflow";
  }

  if (
    context === "exchange_outflow"
  ) {
    return "Exchange outflow";
  }

  if (
    context === "mint"
  ) {
    return "Mint";
  }

  if (
    context === "burn"
  ) {
    return "Burn";
  }

  if (
    context === "project_transfer"
  ) {
    return "Project-linked";
  }

  if (
    context === "treasury_transfer"
  ) {
    return "Treasury";
  }

  if (
    context === "team_transfer"
  ) {
    return "Team-linked";
  }

  if (
    context === "investor_transfer"
  ) {
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
  history:
    HistoryData | null;
  positive:
    boolean;
}) {
  const containerRef =
    useRef<HTMLDivElement | null>(
      null
    );

  const chartRef =
    useRef<IChartApi | null>(
      null
    );

  const seriesRef =
    useRef<
      ISeriesApi<"Line"> | null
    >(null);

  useEffect(() => {
    if (
      !containerRef.current
    ) {
      return;
    }

    const container =
      containerRef.current;

    const chart =
      createChart(
        container,
        {
          width:
            container.clientWidth,
          height: 260,

          layout: {
            background: {
              type:
                ColorType.Solid,
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
        }
      );

    const series =
      chart.addSeries(
        LineSeries,
        {
          color:
            positive
              ? "#16B8A6"
              : "#EF5B5B",
          lineWidth: 2,
          priceLineVisible: false,
          lastValueVisible: true,
        }
      );

    chartRef.current =
      chart;

    seriesRef.current =
      series;

    const observer =
      new ResizeObserver(
        () => {
          if (
            !containerRef.current
          ) {
            return;
          }

          chart.applyOptions(
            {
              width:
                containerRef.current
                  .clientWidth,
            }
          );
        }
      );

    observer.observe(
      container
    );

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
        .map(
          (
            point
          ) => ({
            time:
              Math.floor(
                point.timestamp /
                  1000
              ) as UTCTimestamp,
            value:
              point.price,
          })
        )
        .filter(
          (
            point,
            index,
            array
          ) =>
            index === 0 ||
            point.time !==
              array[index - 1].time
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
   SMALL UI
   ========================================================= */

function SignalDot() {
  return (
    <span className="relative flex h-2.5 w-2.5">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#16B8A6] opacity-20" />
      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#16B8A6]" />
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
};

function InvestigationStep({
  number,
  title,
  status,
  description,
  href,
  ready,
}: InvestigationStepProps) {
  return (
    <a
      href={href}
      className={`group relative block rounded-[18px] border p-4 transition-all duration-200 ${
        ready
          ? "border-[#DDE4E9] bg-white hover:-translate-y-1 hover:border-[#BFC8FF] hover:shadow-md"
          : "border-[#E7EBF0] bg-[#FAFBFC]"
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[11px] font-bold transition ${
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
                  ? "bg-[#E8F9F6] text-[#0F8F82]"
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

function ContinueInvestigation({
  label,
  target,
  onNavigate,
}: {
  label: string;
  target: string;
  onNavigate:
    (
      id: string
    ) => void;
}) {
  return (
    <div className="flex justify-center py-7 sm:py-9">
      <button
        type="button"
        onClick={() =>
          onNavigate(
            target
          )
        }
        className="group flex items-center gap-3 rounded-full border border-[#DDE4E9] bg-white px-4 py-2.5 text-xs font-semibold text-[#69788A] shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-[#BFC8FF] hover:text-[#0D1726] hover:shadow-md"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#EEF1FF] text-[#465FFF] transition group-hover:bg-[#465FFF] group-hover:text-white">
          ↓
        </span>

        {label}

        <span className="text-[#465FFF] transition-transform duration-200 group-hover:translate-x-1">
          →
        </span>
      </button>
    </div>
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

  const mobileNavRef =
    useRef<HTMLDivElement | null>(
      null
    );

  const mobileItemRefs =
    useRef<
      Record<
        string,
        HTMLButtonElement | null
      >
    >({});

  const [
    activeSection,
    setActiveSection,
  ] =
    useState("scan");

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
    useState<ChartRange>("7");

  const [
    loading,
    setLoading,
  ] =
    useState(false);

  const [
    scanStage,
    setScanStage,
  ] =
    useState<ScanStage>(
      "idle"
    );

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
     BETTER SCROLL SYNC
     ======================================================= */

  useEffect(() => {
    let ticking =
      false;

    function detectSection() {
      const headerOffset =
        window.innerWidth <
        1280
          ? 124
          : 88;

      let current =
        "scan";

      let bestDistance =
        Number.POSITIVE_INFINITY;

      navigationItems.forEach(
        (
          item
        ) => {
          const section =
            document.getElementById(
              item.id
            );

          if (
            !section
          ) {
            return;
          }

          const rect =
            section.getBoundingClientRect();

          const distance =
            Math.abs(
              rect.top -
                headerOffset
            );

          const insideViewport =
            rect.top <=
              window.innerHeight *
                0.48 &&
            rect.bottom >=
              headerOffset +
                40;

          if (
            insideViewport &&
            distance <
              bestDistance
          ) {
            bestDistance =
              distance;

            current =
              item.id;
          }
        }
      );

      setActiveSection(
        current
      );

      ticking =
        false;
    }

    function handleScroll() {
      if (
        ticking
      ) {
        return;
      }

      ticking =
        true;

      window.requestAnimationFrame(
        detectSection
      );
    }

    detectSection();

    window.addEventListener(
      "scroll",
      handleScroll,
      {
        passive: true,
      }
    );

    window.addEventListener(
      "resize",
      handleScroll
    );

    return () => {
      window.removeEventListener(
        "scroll",
        handleScroll
      );

      window.removeEventListener(
        "resize",
        handleScroll
      );
    };
  }, []);

  /* =======================================================
     AUTO-CENTER ACTIVE MOBILE TAB
     ======================================================= */

  useEffect(() => {
    const item =
      mobileItemRefs.current[
        activeSection
      ];

    const container =
      mobileNavRef.current;

    if (
      !item ||
      !container
    ) {
      return;
    }

    const itemCenter =
      item.offsetLeft +
      item.offsetWidth /
        2;

    const containerCenter =
      container.clientWidth /
      2;

    const target =
      itemCenter -
      containerCenter;

    container.scrollTo({
      left: Math.max(
        0,
        target
      ),
      behavior: "smooth",
    });
  }, [activeSection]);

  function goToSection(
    id: string
  ) {
    const element =
      document.getElementById(
        id
      );

    if (
      !element
    ) {
      return;
    }

    setActiveSection(
      id
    );

    element.scrollIntoView(
      {
        behavior: "smooth",
        block: "start",
      }
    );
  }

  /* =======================================================
     API
     ======================================================= */

  async function fetchHistory(
    coinId: string,
    selectedRange:
      ChartRange
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

      if (
        !response.ok
      ) {
        return null;
      }

      const data =
        await response.json();

      setHistory(
        data
      );

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

      if (
        !response.ok
      ) {
        return null;
      }

      const data =
        await response.json();

      setReplayPreview(
        data
      );

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
        data.count ===
          0
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

      if (
        !response.ok
      ) {
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
    market:
      MarketData,
    historyData:
      HistoryData | null,
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
              JSON.stringify(
                {
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
                }
              ),
          }
        );

      if (
        !response.ok
      ) {
        return;
      }

      const data =
        await response.json();

      setPerspective(
        data
      );
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

    if (
      !cleanQuery
    ) {
      setError(
        "Enter a token name or symbol."
      );

      return;
    }

    try {
      setLoading(
        true
      );

      setScanStage(
        "resolving"
      );

      setError("");

      setMarketData(
        null
      );

      setHistory(
        null
      );

      setReplayPreview(
        null
      );

      setPerspective(
        null
      );

      setSelectedAccount(
        null
      );

      setEvmWalletData(
        null
      );

      setSolanaWalletData(
        null
      );

      setProjectAccountData(
        null
      );

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

      if (
        !response.ok
      ) {
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

      setScanStage(
        "market"
      );

      const accountsPromise =
        fetchProjectAccounts(
          market.name,
          market.symbol
        );

      const historyPromise =
        fetchHistory(
          market.id,
          range
        );

      const replayPromise =
        fetchReplayPreview(
          market.id
        );

      setScanStage(
        "accounts"
      );

      const accountsResult =
        await accountsPromise;

      setScanStage(
        "history"
      );

      const [
        historyResult,
      ] =
        await Promise.all([
          historyPromise,
          replayPromise,
        ]);

      setScanStage(
        "perspective"
      );

      await generatePerspective(
        market,
        historyResult,
        accountsResult
      );

      setScanStage(
        "complete"
      );
    } catch (
      err
    ) {
      setScanStage(
        "idle"
      );

      setError(
        err instanceof
          Error
          ? err.message
          : "PRISM scan failed."
      );
    } finally {
      setLoading(
        false
      );
    }
  }

  async function handleScan() {
    await runTokenScan(
      query
    );
  }

  async function runWalletScan(
    address:
      string,
    chain:
      WalletScanChain,
    account:
      ProjectAccount | null
  ) {
    try {
      setWalletLoading(
        true
      );

      setWalletError(
        ""
      );

      setWalletChain(
        chain
      );

      const endpoint =
        chain ===
        "solana"
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

      if (
        !response.ok
      ) {
        throw new Error(
          data.error ||
            "Account scan failed."
        );
      }

      if (
        chain ===
        "solana"
      ) {
        setSolanaWalletData(
          data
        );

        setEvmWalletData(
          null
        );

        if (
          marketData
        ) {
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

        if (
          marketData
        ) {
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
    } catch (
      err
    ) {
      setWalletError(
        err instanceof
          Error
          ? err.message
          : "Account scan failed."
      );
    } finally {
      setWalletLoading(
        false
      );
    }
  }

  async function inspectProjectAccount(
    account:
      ProjectAccount
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
    token:
      WatchlistToken
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
    account:
      WatchlistAccount
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
          "medium",
        source:
          "Saved PRISM Watchlist",
        sourceUrl:
          "",
        explanation:
          "This account was reopened from the local PRISM watchlist. Saved items do not independently re-verify attribution.",
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
    Boolean(
      marketData
    );

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

  const investigationComplete =
    marketLoaded &&
    accountsLoaded &&
    replayLoaded &&
    perspectiveLoaded &&
    !loading &&
    !perspectiveLoading;

  return (
    <main className="prism-shell">
      {/* HEADER */}

      <header className="sticky top-0 z-50 border-b border-[#E3E8EE] bg-white/92 backdrop-blur-xl">
        <div className="prism-container">
          <div className="flex h-[68px] items-center justify-between gap-4 sm:h-[72px]">
            <button
              type="button"
              onClick={() =>
                goToSection(
                  "scan"
                )
              }
              className="flex shrink-0 items-center gap-3"
            >
              <div className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-[13px] bg-[#0D1726] shadow-sm">
                <div className="absolute -left-2 top-0 h-7 w-7 rounded-full bg-[#465FFF]/70 blur-md" />
                <div className="absolute -bottom-2 -right-1 h-7 w-7 rounded-full bg-[#16B8A6]/60 blur-md" />

                <span className="relative text-sm font-bold text-white">
                  P
                </span>
              </div>

              <div className="text-left">
                <p className="text-[15px] font-bold tracking-[-0.02em] text-[#0D1726]">
                  PRISM
                </p>

                <p className="hidden text-[11px] text-[#98A5B5] sm:block">
                  Crypto Intelligence Desk
                </p>
              </div>
            </button>

            <nav className="hidden min-w-0 flex-1 items-center justify-center xl:flex">
              <div className="flex items-center gap-1 rounded-[16px] bg-[#F4F6F8] p-1">
                {navigationItems.map(
                  (
                    item,
                    index
                  ) => {
                    const active =
                      activeSection ===
                      item.id;

                    return (
                      <button
                        key={
                          item.id
                        }
                        type="button"
                        onClick={() =>
                          goToSection(
                            item.id
                          )
                        }
                        className={`group flex h-10 items-center gap-2 rounded-xl px-3.5 text-xs font-semibold transition-all duration-200 ${
                          active
                            ? "bg-[#0D1726] text-white shadow-[0_7px_18px_rgba(13,23,38,0.14)]"
                            : "text-[#69788A] hover:bg-white hover:text-[#0D1726]"
                        }`}
                      >
                        <span
                          className={`flex h-5 w-5 items-center justify-center rounded-md text-[8px] font-bold ${
                            active
                              ? "bg-white/10 text-[#8CE2D7]"
                              : "bg-[#EEF1FF] text-[#465FFF]"
                          }`}
                        >
                          {String(
                            index +
                              1
                          ).padStart(
                            2,
                            "0"
                          )}
                        </span>

                        {
                          item.label
                        }

                        {active && (
                          <span className="h-1.5 w-1.5 rounded-full bg-[#16B8A6]" />
                        )}
                      </button>
                    );
                  }
                )}
              </div>
            </nav>

            <div className="flex shrink-0 items-center gap-2">
              <div className="hidden items-center gap-2 rounded-full border border-[#E3E8EE] bg-white px-3 py-2 text-xs font-medium text-[#405064] shadow-sm lg:flex">
                <SignalDot />
                Live intelligence
              </div>

              <button
                type="button"
                onClick={() =>
                  goToSection(
                    "scan"
                  )
                }
                className="prism-button-primary hidden px-4 py-2.5 text-xs font-semibold sm:block"
              >
                New scan
              </button>

              <button
                type="button"
                onClick={() =>
                  goToSection(
                    "scan"
                  )
                }
                aria-label="Start new scan"
                className="flex h-10 w-10 items-center justify-center rounded-[13px] bg-[#465FFF] text-lg font-semibold text-white shadow-[0_8px_20px_rgba(70,95,255,0.22)] sm:hidden"
              >
                +
              </button>
            </div>
          </div>

          <div className="border-t border-[#EEF2F5] xl:hidden">
            <div
              ref={
                mobileNavRef
              }
              className="flex items-center gap-1.5 overflow-x-auto py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {navigationItems.map(
                (
                  item,
                  index
                ) => {
                  const active =
                    activeSection ===
                    item.id;

                  return (
                    <button
                      key={
                        item.id
                      }
                      ref={(
                        element
                      ) => {
                        mobileItemRefs.current[
                          item.id
                        ] =
                          element;
                      }}
                      type="button"
                      onClick={() =>
                        goToSection(
                          item.id
                        )
                      }
                      className={`flex h-9 shrink-0 items-center gap-2 rounded-xl px-3 text-[11px] font-semibold transition-all duration-200 ${
                        active
                          ? "bg-[#0D1726] text-white shadow-sm"
                          : "text-[#69788A] hover:bg-[#F4F6F8] hover:text-[#0D1726]"
                      }`}
                    >
                      <span
                        className={`flex h-[18px] w-[18px] items-center justify-center rounded-md text-[7px] font-bold ${
                          active
                            ? "bg-white/10 text-[#8CE2D7]"
                            : "bg-[#EEF1FF] text-[#465FFF]"
                        }`}
                      >
                        {String(
                          index +
                            1
                        ).padStart(
                          2,
                          "0"
                        )}
                      </span>

                      {
                        item.shortLabel
                      }

                      {active && (
                        <span className="h-1.5 w-1.5 rounded-full bg-[#16B8A6]" />
                      )}
                    </button>
                  );
                }
              )}
            </div>
          </div>
        </div>
      </header>

      {/* HERO */}

      <section
        id="scan"
        ref={
          scanSectionRef
        }
        className="relative scroll-mt-32 overflow-hidden"
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
          <div className="grid items-center gap-12 py-14 sm:py-16 lg:min-h-[720px] lg:grid-cols-[0.92fr_1.08fr] lg:gap-14 lg:py-20">
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
                  {error}
                </div>
              )}

              <div className="max-w-[660px]">
                <ScanProgress
                  stage={
                    scanStage
                  }
                />
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-[#98A5B5] sm:text-xs">
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

            <div className="relative">
              <div className="relative overflow-hidden rounded-[24px] border border-[#DCE3E9] bg-white/95 shadow-[0_28px_70px_rgba(13,23,38,0.11)] backdrop-blur-xl sm:rounded-[30px]">
                {(loading ||
                  perspectiveLoading) && (
                  <div className="prism-scanner" />
                )}

                <div className="relative z-10 flex items-center justify-between border-b border-[#E7EBF0] px-4 py-4 sm:px-6">
                  <div className="flex items-center gap-2">
                    <div className="h-2.5 w-2.5 rounded-full bg-[#EF5B5B]" />
                    <div className="h-2.5 w-2.5 rounded-full bg-[#FFB44A]" />
                    <div className="h-2.5 w-2.5 rounded-full bg-[#16B8A6]" />
                  </div>

                  <div className="flex items-center gap-2">
                    <SignalDot />

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
                          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#0D1726] text-sm font-bold text-white">
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

                          <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.1em] text-[#98A5B5]">
                            {
                              marketData.symbol
                            }
                          </p>
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
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#EEF1FF] text-lg text-[#465FFF]">
                        ◈
                      </div>

                      <p className="mt-4 text-lg font-semibold text-[#0D1726]">
                        Awaiting investigation
                      </p>

                      <p className="mt-2 text-[13px] leading-6 text-[#69788A]">
                        Search a token and PRISM will build
                        the investigation in real time.
                      </p>
                    </div>
                  )}

                  <div className="mt-6">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#98A5B5]">
                        Investigation pipeline
                      </p>

                      {marketData && (
                        <span
                          className={`prism-chip ${
                            investigationComplete
                              ? "prism-chip-success"
                              : "prism-chip-primary"
                          } !text-[9px]`}
                        >
                          <SignalDot />

                          {investigationComplete
                            ? "Complete"
                            : "Running"}
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
                        status={
                          marketLoaded
                            ? "Loaded"
                            : "Waiting"
                        }
                        description={
                          marketData
                            ? `${formatPrice(
                                marketData.price
                              )} · ${
                                marketData.change24h >=
                                0
                                  ? "+"
                                  : ""
                              }${marketData.change24h.toFixed(
                                2
                              )}%`
                            : "Price, volume and market activity."
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
                            ? `${projectAccountData?.count ?? 0} attributable account${
                                projectAccountData?.count ===
                                1
                                  ? ""
                                  : "s"
                              } found.`
                            : "Public project-account attribution."
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
                        description="Compare with similar historical periods."
                      />

                      <InvestigationStep
                        number="04"
                        title="Perspective"
                        href="#perspective"
                        ready={
                          perspectiveLoaded
                        }
                        status={
                          perspective
                            ? perspectiveStatusLabel(
                                perspective.status
                              )
                            : perspectiveLoading
                            ? "Building"
                            : "Waiting"
                        }
                        description={
                          perspective
                            ? perspective.headline
                            : "Evidence-based contextual interpretation."
                        }
                      />
                    </div>
                  </div>

                  <div className="mt-5 rounded-[18px] bg-[#0D1726] p-4 text-white sm:p-5">
                    <div className="flex items-center justify-between">
                      <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-white/45">
                        Current observation
                      </p>

                      <SignalDot />
                    </div>

                    <p className="mt-4 text-[13px] font-medium leading-6 text-white/90 sm:text-sm">
                      {perspective
                        ? perspective.headline
                        : marketData
                        ? "Market evidence loaded. PRISM is connecting the remaining evidence."
                        : "Start with a token name or symbol."}
                    </p>

                    {marketData && (
                      <div className="mt-5 grid grid-cols-2 gap-3">
                        <div className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-3">
                          <p className="text-[8px] uppercase tracking-[0.12em] text-white/35">
                            Market cap
                          </p>

                          <p className="mt-2 text-xs font-semibold sm:text-sm">
                            {formatCurrency(
                              marketData.marketCap
                            )}
                          </p>
                        </div>

                        <div className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-3">
                          <p className="text-[8px] uppercase tracking-[0.12em] text-white/35">
                            24h volume
                          </p>

                          <p className="mt-2 text-xs font-semibold sm:text-sm">
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

      {/* MARKET */}

      <section
        id="market-investigation"
        className="scroll-mt-36 pb-14 sm:pb-20"
      >
        <div className="prism-container">
          <ResultReveal>
            <div className="mb-7">
              <p className="prism-eyebrow">
                Market investigation
              </p>

              <h2 className="prism-section-title mt-3">
                One asset. Multiple layers of evidence.
              </h2>

              <p className="prism-section-copy mt-4 max-w-2xl">
                Start with market structure, then move
                into attributable project accounts,
                historical patterns and on-chain
                activity.
              </p>
            </div>
          </ResultReveal>

          <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
            <ResultReveal
              delay={80}
            >
              <div className="prism-surface overflow-hidden">
                <div className="flex flex-col gap-4 border-b border-[#E3E8EE] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                  {marketData ? (
                    <div className="flex items-center gap-3">
                      <img
                        src={
                          marketData.image
                        }
                        alt={
                          marketData.name
                        }
                        className="h-10 w-10 rounded-xl border border-[#E3E8EE]"
                      />

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
                          } disabled:opacity-35`}
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

                        <div className="rounded-xl border border-[#E3E8EE] bg-[#F9FBFC] px-4 py-2">
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
                    <div className="flex h-[280px] items-center justify-center rounded-2xl border border-dashed border-[#CFD7E1] bg-[#F9FBFC]">
                      <p className="text-sm text-[#69788A]">
                        Run a scan to load market history.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </ResultReveal>

            <ResultReveal
              delay={160}
            >
              <div className="prism-surface overflow-hidden">
                <div className="border-b border-[#E3E8EE] p-5 sm:p-6">
                  <p className="text-sm font-semibold text-[#0D1726]">
                    Project accounts
                  </p>

                  <p className="mt-1 text-xs text-[#98A5B5]">
                    Evidence-backed public attribution only.
                  </p>
                </div>

                <div className="p-4">
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
                            className="rounded-[18px] border border-[#E3E8EE] bg-white p-4 transition-all duration-200 hover:-translate-y-1 hover:border-[#C2CAFF] hover:shadow-md"
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
                                  <span className="prism-chip">
                                    {chainLabel(
                                      account.chain
                                    )}
                                  </span>

                                  <span className="prism-chip prism-chip-primary">
                                    {accountTypeLabel(
                                      account.accountType
                                    )}
                                  </span>
                                </div>

                                <p className="mt-3 text-xs leading-5 text-[#69788A]">
                                  {
                                    account.explanation
                                  }
                                </p>

                                <div className="mt-4 flex flex-wrap justify-between gap-3">
                                  {account.sourceUrl && (
                                    <a
                                      href={
                                        account.sourceUrl
                                      }
                                      target="_blank"
                                      rel="noreferrer"
                                      className="text-[11px] font-medium text-[#69788A] hover:text-[#465FFF]"
                                    >
                                      Verify source ↗
                                    </a>
                                  )}

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
                                    className="prism-button-secondary px-3 py-2 text-[11px] font-semibold disabled:opacity-40"
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
                  ) : (
                    <div className="flex min-h-[280px] items-center justify-center rounded-2xl border border-dashed border-[#CFD7E1] bg-[#F9FBFC] p-6 text-center">
                      <p className="text-sm text-[#69788A]">
                        {projectAccountData
                          ? "No attributable project accounts found."
                          : "Project accounts will appear here after a scan."}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </ResultReveal>
          </div>

          {marketData && (
            <ResultReveal
              delay={220}
            >
              <ContinueInvestigation
                label="Continue to PRISM Perspective"
                target="perspective"
                onNavigate={
                  goToSection
                }
              />
            </ResultReveal>
          )}
        </div>
      </section>

      {/* PERSPECTIVE */}

      <section
        id="perspective"
        className="scroll-mt-36 border-y border-[#E3E8EE] bg-white py-14 sm:py-20"
      >
        <div className="prism-container">
          <ResultReveal>
            <div className="grid gap-8 lg:grid-cols-[0.75fr_1.25fr]">
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

              <ResultReveal
                delay={100}
              >
                {perspectiveLoading ? (
                  <div className="prism-gradient-panel flex min-h-[340px] items-center justify-center">
                    <div className="text-center">
                      <div className="mx-auto h-8 w-8 animate-spin rounded-full border-[3px] border-[#465FFF]/15 border-t-[#465FFF]" />

                      <p className="mt-4 text-sm text-[#69788A]">
                        Synthesizing evidence...
                      </p>
                    </div>
                  </div>
                ) : perspective ? (
                  <div className="overflow-hidden rounded-[24px] border border-[#DDE4E9] bg-gradient-to-br from-[#F7F9FF] via-white to-[#F0FAF8] transition-shadow duration-300 hover:shadow-lg">
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

                      <h3 className="mt-5 text-xl font-bold leading-8 tracking-[-0.03em] text-[#0D1726] sm:text-2xl">
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
                  <div className="prism-gradient-panel flex min-h-[340px] items-center justify-center p-6">
                    <p className="text-sm text-[#69788A]">
                      Run a scan to generate Perspective.
                    </p>
                  </div>
                )}
              </ResultReveal>
            </div>
          </ResultReveal>

          {perspective && (
            <ResultReveal
              delay={180}
            >
              <ContinueInvestigation
                label="Compare this move with history"
                target="replay"
                onNavigate={
                  goToSection
                }
              />
            </ResultReveal>
          )}
        </div>
      </section>

      {/* REPLAY */}

      <div className="prism-container">
        <ResultReveal>
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
        </ResultReveal>

        {replayPreview && (
          <ResultReveal
            delay={120}
          >
            <ContinueInvestigation
              label="Continue to Account Intelligence"
              target="wallet"
              onNavigate={
                goToSection
              }
            />
          </ResultReveal>
        )}
      </div>

      {/* ACCOUNT INTELLIGENCE */}

      <section
        id="wallet"
        ref={
          walletSectionRef
        }
        className="scroll-mt-36 border-y border-[#E3E8EE] bg-white py-14 sm:py-20"
      >
        <div className="prism-container">
          <ResultReveal>
            <p className="prism-eyebrow">
              On-chain evidence
            </p>

            <h2 className="prism-section-title mt-3">
              Account Intelligence
            </h2>

            <p className="prism-section-copy mt-4 max-w-2xl">
              Inspect public accounts using the correct
              chain adapter and view activity with
              attribution context.
            </p>
          </ResultReveal>

          <ResultReveal
            delay={80}
          >
            <div className="mt-7 rounded-[20px] border border-[#CFD7E1] bg-white p-2 shadow-sm">
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
                  className="prism-select h-12 px-4 text-sm"
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

                    if (
                      !address
                    ) {
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
          </ResultReveal>

          {walletError && (
            <div className="mt-4 rounded-xl border border-[#F6CACA] bg-[#FFF1F1] px-4 py-3 text-sm text-[#C03E3E]">
              {
                walletError
              }
            </div>
          )}

          {walletLoading && (
            <ResultReveal>
              <div className="mt-7 flex min-h-[220px] items-center justify-center rounded-[22px] border border-[#E3E8EE] bg-[#F9FBFC]">
                <div className="text-center">
                  <div className="mx-auto h-8 w-8 animate-spin rounded-full border-[3px] border-[#465FFF]/15 border-t-[#465FFF]" />

                  <p className="mt-4 text-sm text-[#69788A]">
                    Reading account activity...
                  </p>
                </div>
              </div>
            </ResultReveal>
          )}

          {evmWalletData &&
            !walletLoading && (
              <div className="mt-7 space-y-6">
                <ResultReveal>
                  <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    <AnimatedMetric
                      label="Transfers"
                      value={
                        evmWalletData
                          .summary
                          .totalTransfers
                      }
                      detail="Recent activity returned by the scanner"
                    />

                    <AnimatedMetric
                      label="Attributed"
                      value={
                        evmWalletData
                          .summary
                          .attributedTransfers
                      }
                      detail="Transfers with known counterparty context"
                    />

                    <AnimatedMetric
                      label="Exchange interactions"
                      value={
                        evmWalletData
                          .summary
                          .exchangeInteractions
                      }
                      detail="Interactions with recognised exchange addresses"
                    />

                    <AnimatedMetric
                      label="Project interactions"
                      value={
                        evmWalletData
                          .summary
                          .projectInteractions
                      }
                      detail="Activity involving recognised project-linked entities"
                    />
                  </div>
                </ResultReveal>

                <ResultReveal
                  delay={100}
                >
                  <div className="overflow-hidden rounded-[22px] border border-[#E3E8EE] bg-white">
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
                              className="grid gap-4 p-4 transition-colors hover:bg-[#FAFBFC] sm:grid-cols-[110px_1fr_auto] sm:p-6"
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
                                  <p className="text-sm font-semibold text-[#0D1726]">
                                    {formatTokenValue(
                                      item.value
                                    )}{" "}
                                    {
                                      item.asset
                                    }
                                  </p>

                                  <span
                                    className={`prism-chip ${verificationClass(
                                      item.verification
                                    )}`}
                                  >
                                    {verificationLabel(
                                      item.verification
                                    )}
                                  </span>

                                  {movement && (
                                    <span className="prism-chip prism-chip-primary">
                                      {
                                        movement
                                      }
                                    </span>
                                  )}
                                </div>

                                <p className="mt-2 text-xs leading-5 text-[#69788A]">
                                  {
                                    item.note
                                  }
                                </p>

                                {item.contextExplanation &&
                                  item.movementContext !==
                                    "unknown" && (
                                    <p className="mt-2 text-[11px] leading-5 text-[#98A5B5]">
                                      {
                                        item.contextExplanation
                                      }
                                    </p>
                                  )}
                              </div>

                              {item.explorerUrl && (
                                <a
                                  href={
                                    item.explorerUrl
                                  }
                                  target="_blank"
                                  rel="noreferrer"
                                  className="w-fit text-xs font-semibold text-[#69788A] hover:text-[#465FFF]"
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
                </ResultReveal>
              </div>
            )}

          {solanaWalletData &&
            !walletLoading && (
              <div className="mt-7 space-y-6">
                <ResultReveal>
                  <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    <AnimatedMetric
                      label="Transactions"
                      value={
                        solanaWalletData
                          .summary
                          .transactions
                      }
                      detail="Recent transactions returned by the scanner"
                    />

                    <AnimatedMetric
                      label="Incoming"
                      value={
                        solanaWalletData
                          .summary
                          .incoming
                      }
                      detail="Detected incoming movements"
                    />

                    <AnimatedMetric
                      label="Outgoing"
                      value={
                        solanaWalletData
                          .summary
                          .outgoing
                      }
                      detail="Detected outgoing movements"
                    />

                    <AnimatedMetric
                      label="SPL movements"
                      value={
                        solanaWalletData
                          .summary
                          .tokenMovements
                      }
                      detail="Observed SPL-token balance movements"
                    />
                  </div>
                </ResultReveal>

                <ResultReveal
                  delay={100}
                >
                  <div className="overflow-hidden rounded-[22px] border border-[#E3E8EE] bg-white">
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
                            className="grid gap-4 p-4 transition-colors hover:bg-[#FAFBFC] sm:grid-cols-[110px_1fr_auto] sm:p-6"
                          >
                            <div>
                              <span className="prism-chip">
                                {
                                  item.direction
                                }
                              </span>
                            </div>

                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-[#0D1726]">
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

                              <p className="mt-2 text-xs leading-5 text-[#69788A]">
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
                              className="w-fit text-xs font-semibold text-[#69788A] hover:text-[#465FFF]"
                            >
                              Solscan ↗
                            </a>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                </ResultReveal>
              </div>
            )}

          {!walletLoading &&
            !evmWalletData &&
            !solanaWalletData && (
              <ResultReveal
                delay={140}
              >
                <div className="mt-7 flex min-h-[240px] items-center justify-center rounded-[22px] border border-dashed border-[#CFD7E1] bg-[#F9FBFC] px-5">
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
              </ResultReveal>
            )}

          <ResultReveal
            delay={180}
          >
            <ContinueInvestigation
              label="Review your saved investigations"
              target="watchlist"
              onNavigate={
                goToSection
              }
            />
          </ResultReveal>
        </div>
      </section>

      {/* WATCHLIST */}

      <div className="prism-container">
        <ResultReveal>
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
        </ResultReveal>
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
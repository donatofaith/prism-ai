import { NextRequest, NextResponse } from "next/server";

type AllocationType =
  | "team"
  | "investors"
  | "treasury"
  | "ecosystem"
  | "community"
  | "unknown";

type UnlockEvent = {
  id: string;
  date: string;
  daysUntil: number;
  amount: number | null;
  estimatedUsdValue: number | null;
  estimatedPercentOfMarketCap: number | null;
  estimatedPercentOfCirculatingSupply: number | null;
  allocation: string;
  allocationType: AllocationType;
  basis: string | null;
  contractEnforced: boolean | null;
  source: string;
  chain: string | null;
  providerSlug: string | null;
};

type NetSupplyUnlock = {
  occurs_at?: string | null;
  release_on?: string | null;
  symbol?: string | null;
  slug?: string | null;
  chain?: string | null;
  amount?: string | number | null;
  beneficiary_class?: string | null;
  source?: string | null;
  enforced_by_contract?: boolean | null;
  contract_enforced?: boolean | null;
};

type NetSupplyResponse = {
  data?: NetSupplyUnlock[];
};

type CmcMapItem = {
  id?: number | string | null;
  name?: string | null;
  symbol?: string | null;
  slug?: string | null;
};

type CmcQuoteItem = {
  id?: number | string | null;
  name?: string | null;
  symbol?: string | null;
  slug?: string | null;
  circulating_supply?: number | string | null;
  total_supply?: number | string | null;
  max_supply?: number | string | null;
  self_reported_circulating_supply?: number | string | null;
  unlocked_circulating_supply?: number | string | null;
  unlocked_market_cap?: number | string | null;
  quote?: {
    USD?: {
      price?: number | string | null;
      market_cap?: number | string | null;
      fully_diluted_market_cap?: number | string | null;
    };
  } | null;
};

type SupplyContext = {
  source: "CoinMarketCap";
  sourceUrl: string;
  cmcId: number | string;
  name: string;
  symbol: string;
  slug: string;
  circulatingSupply: number | null;
  totalSupply: number | null;
  maxSupply: number | null;
  unlockedCirculatingSupply: number | null;
  unlockedMarketCap: number | null;
  percentCirculatingOfTotal: number | null;
  percentUnlockedOfTotal: number | null;
  fullyDilutedMarketCap: number | null;
};

const NETSUPPLY_UNLOCKS_URL =
  "https://netsupply.org/api/v1/unlocks?scope=scheduled&days=3650&limit=200";

const CMC_PUBLIC_API = "https://pro-api.coinmarketcap.com/public-api";
const CYSIC_SOURCE_URL = "https://docs.cysicfoundation.org/tokenomics";
const CYSIC_SECONDARY_URL = "https://app.tokenomics.com/tokenomics/cysic/unlocks";

function numberValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/,/g, "").trim());
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalize(value: string | null | undefined) {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function classifyAllocation(label: string): AllocationType {
  const value = label.toLowerCase();
  if (/team|founder|employee|contributor|advisor|insider/.test(value)) return "team";
  if (/investor|private|seed|venture|vc|strategic/.test(value)) return "investors";
  if (/treasury|foundation/.test(value)) return "treasury";
  if (/ecosystem|incentive|reward|liquidity/.test(value)) return "ecosystem";
  if (/community|airdrop|public/.test(value)) return "community";
  return "unknown";
}

function impactLabel(percentOfMarketCap: number | null) {
  if (percentOfMarketCap === null) return "unknown" as const;
  if (percentOfMarketCap >= 10) return "large" as const;
  if (percentOfMarketCap >= 3) return "meaningful" as const;
  return "limited" as const;
}

function matchesToken(
  record: NetSupplyUnlock,
  coinId: string,
  symbol: string,
  name: string
) {
  const recordSymbol = normalize(record.symbol);
  const recordSlug = normalize(record.slug);
  const targetSymbol = normalize(symbol);
  const targetId = normalize(coinId);
  const targetName = normalize(name);

  return Boolean(
    (targetSymbol && recordSymbol === targetSymbol) ||
      (targetId && recordSlug === targetId) ||
      (targetName && recordSlug === targetName)
  );
}

function parseDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function addMonthsUtc(date: Date, months: number) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, date.getUTCDate())
  );
}

function extractCmcRows(payload: unknown): CmcMapItem[] {
  if (!payload || typeof payload !== "object") return [];
  const data = (payload as { data?: unknown }).data;

  if (Array.isArray(data)) {
    return data.filter(
      (item): item is CmcMapItem => Boolean(item) && typeof item === "object"
    );
  }

  if (data && typeof data === "object") {
    return Object.values(data).flatMap((value) => {
      if (Array.isArray(value)) {
        return value.filter(
          (item): item is CmcMapItem => Boolean(item) && typeof item === "object"
        );
      }
      return value && typeof value === "object" ? [value as CmcMapItem] : [];
    });
  }

  return [];
}

function extractCmcQuote(payload: unknown, cmcId: number | string): CmcQuoteItem | null {
  if (!payload || typeof payload !== "object") return null;
  const data = (payload as { data?: unknown }).data;

  if (Array.isArray(data)) {
    return (
      (data.find(
        (item) =>
          item &&
          typeof item === "object" &&
          String((item as CmcQuoteItem).id ?? "") === String(cmcId)
      ) as CmcQuoteItem | undefined) ??
      ((data[0] as CmcQuoteItem | undefined) ?? null)
    );
  }

  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;
    const direct = record[String(cmcId)];
    if (direct && typeof direct === "object") return direct as CmcQuoteItem;

    const firstObject = Object.values(record).find(
      (value) => value && typeof value === "object" && !Array.isArray(value)
    );
    if (firstObject) return firstObject as CmcQuoteItem;
  }

  return null;
}

async function fetchCoinMarketCapSupplyContext(
  coinId: string,
  symbol: string,
  name: string
): Promise<SupplyContext | null> {
  if (!symbol) return null;

  try {
    const mapUrl = new URL(`${CMC_PUBLIC_API}/v1/cryptocurrency/map`);
    mapUrl.searchParams.set("symbol", symbol.toUpperCase());
    mapUrl.searchParams.set("listing_status", "active,untracked");

    const mapResponse = await fetch(mapUrl.toString(), {
      cache: "no-store",
      headers: { accept: "application/json" },
    });

    if (!mapResponse.ok) return null;

    const mapPayload = await mapResponse.json();
    const rows = extractCmcRows(mapPayload);
    if (rows.length === 0) return null;

    const targetId = normalize(coinId);
    const targetName = normalize(name);
    const targetSymbol = normalize(symbol);

    const exact =
      rows.find(
        (item) =>
          normalize(item.symbol) === targetSymbol &&
          (normalize(item.slug) === targetId || normalize(item.name) === targetName)
      ) ?? rows.find((item) => normalize(item.symbol) === targetSymbol) ?? rows[0];

    if (exact.id === null || exact.id === undefined) return null;

    const quoteUrl = new URL(`${CMC_PUBLIC_API}/v3/cryptocurrency/quotes/latest`);
    quoteUrl.searchParams.set("id", String(exact.id));
    quoteUrl.searchParams.set("convert", "USD");

    const quoteResponse = await fetch(quoteUrl.toString(), {
      cache: "no-store",
      headers: { accept: "application/json" },
    });

    if (!quoteResponse.ok) return null;

    const quotePayload = await quoteResponse.json();
    const quote = extractCmcQuote(quotePayload, exact.id);
    if (!quote) return null;

    const circulatingSupply = numberValue(quote.circulating_supply);
    const totalSupply = numberValue(quote.total_supply);
    const maxSupply = numberValue(quote.max_supply);
    const unlockedCirculatingSupply = numberValue(quote.unlocked_circulating_supply);
    const unlockedMarketCap = numberValue(quote.unlocked_market_cap);
    const fullyDilutedMarketCap = numberValue(quote.quote?.USD?.fully_diluted_market_cap);

    const percentCirculatingOfTotal =
      circulatingSupply !== null && totalSupply !== null && totalSupply > 0
        ? (circulatingSupply / totalSupply) * 100
        : null;

    const percentUnlockedOfTotal =
      unlockedCirculatingSupply !== null && totalSupply !== null && totalSupply > 0
        ? (unlockedCirculatingSupply / totalSupply) * 100
        : null;

    const slug = quote.slug ?? exact.slug ?? coinId;

    return {
      source: "CoinMarketCap",
      sourceUrl: `https://coinmarketcap.com/currencies/${slug}/`,
      cmcId: exact.id,
      name: quote.name ?? exact.name ?? name,
      symbol: quote.symbol ?? exact.symbol ?? symbol,
      slug,
      circulatingSupply,
      totalSupply,
      maxSupply,
      unlockedCirculatingSupply,
      unlockedMarketCap,
      percentCirculatingOfTotal,
      percentUnlockedOfTotal,
      fullyDilutedMarketCap,
    };
  } catch {
    return null;
  }
}

function enrichEvent(
  event: Omit<
    UnlockEvent,
    | "daysUntil"
    | "estimatedUsdValue"
    | "estimatedPercentOfMarketCap"
    | "estimatedPercentOfCirculatingSupply"
  >,
  price: number | null,
  marketCap: number | null,
  estimatedCirculatingSupply: number | null
): UnlockEvent {
  const date = new Date(event.date);
  const amount = event.amount;
  const estimatedUsdValue =
    amount !== null && price !== null && price > 0 ? amount * price : null;
  const estimatedPercentOfMarketCap =
    estimatedUsdValue !== null && marketCap !== null && marketCap > 0
      ? (estimatedUsdValue / marketCap) * 100
      : null;
  const estimatedPercentOfCirculatingSupply =
    amount !== null &&
    estimatedCirculatingSupply !== null &&
    estimatedCirculatingSupply > 0
      ? (amount / estimatedCirculatingSupply) * 100
      : null;

  return {
    ...event,
    daysUntil: Math.max(0, Math.ceil((date.getTime() - Date.now()) / 86_400_000)),
    estimatedUsdValue,
    estimatedPercentOfMarketCap,
    estimatedPercentOfCirculatingSupply,
  };
}

function buildCysicFallback(
  price: number | null,
  marketCap: number | null,
  estimatedCirculatingSupply: number | null
) {
  const firstFixedRelease = new Date(Date.UTC(2026, 11, 11));
  const now = Date.now();
  const events: UnlockEvent[] = [];

  const investorsMonthly = 236_200_000 / 12;
  const contributorsMonthly = 121_100_000 / 36;
  const treasuryMonthly = 80_000_000 / 24;

  for (let month = 0; month < 36; month += 1) {
    const date = addMonthsUtc(firstFixedRelease, month);
    if (date.getTime() < now - 86_400_000) continue;

    let amount = contributorsMonthly;
    const allocations = ["Contributors"];

    if (month < 12) {
      amount += investorsMonthly;
      allocations.unshift("Investors");
    }

    if (month < 24) {
      amount += treasuryMonthly;
      allocations.push("Foundation Treasury");
    }

    events.push(
      enrichEvent(
        {
          id: `cysic-${date.toISOString()}`,
          date: date.toISOString(),
          amount,
          allocation: allocations.join(" + "),
          allocationType: month < 12 ? "investors" : month < 24 ? "treasury" : "team",
          basis:
            "Modeled from the Cysic Foundation's published cliff and linear vesting terms. Dynamic ecosystem incentives are not included.",
          contractEnforced: null,
          source: "Cysic Foundation tokenomics",
          chain: "multi-chain",
          providerSlug: "cysic",
        },
        price,
        marketCap,
        estimatedCirculatingSupply
      )
    );
  }

  return events;
}

function readableSupplyMessage(context: SupplyContext | null) {
  if (!context) return null;

  const formatter = new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 2,
  });

  const circulating =
    context.circulatingSupply !== null
      ? `${formatter.format(context.circulatingSupply)} ${context.symbol.toUpperCase()} circulating`
      : null;
  const total =
    context.totalSupply !== null
      ? `${formatter.format(context.totalSupply)} ${context.symbol.toUpperCase()} total supply`
      : null;
  const ratio =
    context.percentCirculatingOfTotal !== null
      ? `${context.percentCirculatingOfTotal.toFixed(1)}% of total supply currently circulating`
      : null;

  const parts = [circulating, total, ratio].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : null;
}

export async function GET(request: NextRequest) {
  const coinId = request.nextUrl.searchParams.get("id")?.trim() ?? "";
  const symbol = request.nextUrl.searchParams.get("symbol")?.trim() ?? "";
  const name = request.nextUrl.searchParams.get("name")?.trim() ?? "";
  const price = numberValue(request.nextUrl.searchParams.get("price"));
  const marketCap = numberValue(request.nextUrl.searchParams.get("marketCap"));

  if (!coinId && !symbol && !name) {
    return NextResponse.json(
      { error: "A token id, symbol, or name is required." },
      { status: 400 }
    );
  }

  const estimatedCirculatingSupply =
    price !== null && price > 0 && marketCap !== null && marketCap > 0
      ? marketCap / price
      : null;

  const cmcSupplyPromise = fetchCoinMarketCapSupplyContext(coinId, symbol, name);

  let providerRows: NetSupplyUnlock[] = [];
  let providerAvailable = true;

  try {
    const response = await fetch(NETSUPPLY_UNLOCKS_URL, {
      cache: "no-store",
      headers: {
        accept: "application/json",
        "user-agent": "PRISM-Crypto-Intelligence/1.0",
      },
    });

    if (response.ok) {
      const payload = (await response.json()) as NetSupplyResponse;
      providerRows = Array.isArray(payload.data) ? payload.data : [];
    } else {
      providerAvailable = false;
    }
  } catch {
    providerAvailable = false;
  }

  const supplyContext = await cmcSupplyPromise;
  const matchingRows = providerRows.filter((record) =>
    matchesToken(record, coinId, symbol, name)
  );

  let events: UnlockEvent[] = matchingRows
    .map((record, index): UnlockEvent | null => {
      const date = parseDate(record.occurs_at ?? record.release_on);
      if (!date || date.getTime() < Date.now() - 86_400_000) return null;

      const amount = numberValue(record.amount);
      const allocation = record.beneficiary_class?.trim() || "Unspecified allocation";

      return enrichEvent(
        {
          id: `${record.slug ?? symbol}-${date.toISOString()}-${index}`,
          date: date.toISOString(),
          amount,
          allocation,
          allocationType: classifyAllocation(allocation),
          basis: record.source ?? null,
          contractEnforced:
            typeof record.enforced_by_contract === "boolean"
              ? record.enforced_by_contract
              : typeof record.contract_enforced === "boolean"
              ? record.contract_enforced
              : null,
          source: "NetSupply",
          chain: record.chain ?? null,
          providerSlug: record.slug ?? null,
        },
        price,
        marketCap,
        supplyContext?.circulatingSupply ?? estimatedCirculatingSupply
      );
    })
    .filter((event): event is UnlockEvent => event !== null)
    .sort((a, b) => a.date.localeCompare(b.date));

  let provider = "NetSupply";
  let providerUrl = "https://netsupply.org/unlocks";
  let coverage: "matched" | "modeled" | "not_tracked" | "provider_unavailable" =
    matchingRows.length > 0
      ? "matched"
      : providerAvailable
      ? "not_tracked"
      : "provider_unavailable";

  const isCysic =
    normalize(symbol) === "cys" ||
    normalize(coinId) === "cysic" ||
    normalize(name) === "cysic";

  if (events.length === 0 && isCysic) {
    events = buildCysicFallback(
      price,
      marketCap,
      supplyContext?.circulatingSupply ?? estimatedCirculatingSupply
    );
    provider = "Cysic Foundation tokenomics";
    providerUrl = CYSIC_SOURCE_URL;
    coverage = "modeled";
  }

  const next = events[0] ?? null;
  const teamOrInvestorEvents = events.filter(
    (event) => event.allocationType === "team" || event.allocationType === "investors"
  );
  const supplySummary = readableSupplyMessage(supplyContext);

  const sourcesChecked = [
    {
      name: "NetSupply",
      role: "Dated unlock schedules",
      status: matchingRows.length > 0 ? "matched" : providerAvailable ? "checked" : "unavailable",
    },
    {
      name: "CoinMarketCap",
      role: "Token identity and current supply context",
      status: supplyContext ? "matched" : "checked",
    },
    {
      name: "CoinGecko",
      role: "Current PRISM price and market-cap context",
      status: price !== null || marketCap !== null ? "matched" : "checked",
    },
    ...(isCysic
      ? [
          {
            name: "Cysic Foundation tokenomics",
            role: "Published project vesting terms",
            status: "matched",
          },
        ]
      : []),
  ];

  return NextResponse.json({
    token: { id: coinId, symbol, name },
    available: events.length > 0,
    coverage,
    provider,
    providerUrl,
    secondarySourceUrl: isCysic ? CYSIC_SECONDARY_URL : null,
    lastCheckedAt: new Date().toISOString(),
    next,
    events: events.slice(0, 36),
    supplyContext,
    sourcesChecked,
    summary: {
      eventCount: events.length,
      teamOrInvestorEventCount: teamOrInvestorEvents.length,
      nextImpactSize: impactLabel(next?.estimatedPercentOfMarketCap ?? null),
      nextAllocationType: next?.allocationType ?? null,
    },
    message:
      events.length > 0
        ? coverage === "modeled"
          ? "PRISM found published project vesting terms and modeled only the fixed schedule. Dynamic or discretionary distributions are excluded."
          : null
        : supplyContext
        ? `PRISM checked dated schedule sources but could not verify a future unlock date for this token. CoinMarketCap still provides current supply context: ${supplySummary ?? "supply data is available"}. A gap between circulating and total supply is not automatically an unlock schedule; it can also reflect emissions, treasury holdings, staking, burns, or other non-circulating supply.`
        : providerAvailable
        ? "PRISM checked the connected schedule sources but could not verify a future dated unlock for this token. Missing schedule data is not proof that no vesting exists."
        : "The dated unlock provider is temporarily unavailable and PRISM could not verify a fallback schedule for this token right now.",
    methodology: {
      valuation:
        "Estimated USD values use the token's current PRISM market price, not a future or transaction-time price.",
      circulatingSupply:
        "PRISM prefers CoinMarketCap circulating-supply context when it resolves the same asset, then falls back to current market cap divided by current price.",
      interpretation:
        "A scheduled unlock describes token availability. It does not prove recipients will sell or predict a particular price direction. Supply gaps are not treated as dated unlocks without schedule evidence.",
    },
  });
}

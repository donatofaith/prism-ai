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

const NETSUPPLY_UNLOCKS_URL =
  "https://netsupply.org/api/v1/unlocks?scope=scheduled&days=3650&limit=200";

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
  // Cysic Foundation publishes these fixed vesting terms:
  // Investors: 1-year cliff + 12-month linear vesting (23.62%).
  // Contributors: 1-year cliff + 36-month linear vesting (12.11%).
  // Foundation Treasury: 1-year cliff + 24-month linear vesting (8%).
  // The exact TGE anchor used here is 11 Dec 2025, also published by Tokenomics.com.
  // Ecosystem incentives are intentionally excluded because the Foundation describes
  // them as dynamic distribution rather than a fixed calendar.
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

  const matchingRows = providerRows.filter((record) =>
    matchesToken(record, coinId, symbol, name)
  );

  let events: UnlockEvent[] = matchingRows
    .map((record, index): UnlockEvent | null => {
      // NetSupply's machine-readable schema currently exposes `occurs_at`.
      // `release_on` is retained as a compatibility fallback because its docs
      // describe that name for scheduled releases.
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
        estimatedCirculatingSupply
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
    events = buildCysicFallback(price, marketCap, estimatedCirculatingSupply);
    provider = "Cysic Foundation tokenomics";
    providerUrl = CYSIC_SOURCE_URL;
    coverage = "modeled";
  }

  const next = events[0] ?? null;
  const teamOrInvestorEvents = events.filter(
    (event) => event.allocationType === "team" || event.allocationType === "investors"
  );

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
    summary: {
      eventCount: events.length,
      teamOrInvestorEventCount: teamOrInvestorEvents.length,
      nextImpactSize: impactLabel(next?.estimatedPercentOfMarketCap ?? null),
      nextAllocationType: next?.allocationType ?? null,
    },
    message:
      events.length > 0
        ? coverage === "modeled"
          ? "NetSupply does not currently cover this token, so PRISM modeled the fixed vesting calendar from the project's published tokenomics. Dynamic or discretionary distributions are excluded."
          : null
        : providerAvailable
        ? "No future scheduled release for this token was returned by the connected unlock dataset. PRISM does not treat that as proof that no vesting exists."
        : "The primary unlock-data provider is temporarily unavailable and PRISM has no verified fallback schedule for this token yet.",
    methodology: {
      valuation:
        "Estimated USD values use the token's current PRISM market price, not a future or transaction-time price.",
      circulatingSupply:
        "Estimated percent of circulating supply is derived from current market cap divided by current price when both are available.",
      interpretation:
        "A scheduled unlock describes token availability. It does not prove recipients will sell or predict a particular price direction.",
    },
  });
}

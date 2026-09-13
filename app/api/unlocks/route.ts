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
  amount_base_units?: string | null;
  decimals?: number | null;
  beneficiary_class?: string | null;
  source?: string | null;
  license_class?: string | null;
};

type NetSupplyResponse = {
  data?: NetSupplyUnlock[];
  meta?: Record<string, unknown>;
};

const NETSUPPLY_UNLOCKS_URL = "https://netsupply.org/api/v1/unlocks?limit=200";

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
  if (/team|founder|employee|contributor|advisor/.test(value)) return "team";
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

  try {
    const response = await fetch(NETSUPPLY_UNLOCKS_URL, {
      cache: "no-store",
      headers: {
        accept: "application/json",
        "user-agent": "PRISM-Crypto-Intelligence/1.0",
      },
    });

    if (!response.ok) {
      return NextResponse.json({
        token: { id: coinId, symbol, name },
        available: false,
        coverage: "provider_unavailable",
        events: [],
        provider: "NetSupply",
        providerUrl: "https://netsupply.org/unlocks",
        message:
          "The unlock-data provider is temporarily unavailable. PRISM did not treat this as evidence that no unlock exists.",
      });
    }

    const payload = (await response.json()) as NetSupplyResponse;
    const rows = Array.isArray(payload.data) ? payload.data : [];
    const now = Date.now();
    const estimatedCirculatingSupply =
      price !== null && price > 0 && marketCap !== null && marketCap > 0
        ? marketCap / price
        : null;

    const matchingRows = rows.filter((record) =>
      matchesToken(record, coinId, symbol, name)
    );

    const events = matchingRows
      .map<UnlockEvent | null>((record, index) => {
        const date = parseDate(record.occurs_at ?? record.release_on);
        if (!date || date.getTime() < now - 86_400_000) return null;

        const amount = numberValue(record.amount);
        const allocation = record.beneficiary_class?.trim() || "Unspecified allocation";
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

        const event: UnlockEvent = {
          id: `${record.slug ?? symbol}-${date.toISOString()}-${index}`,
          date: date.toISOString(),
          daysUntil: Math.max(0, Math.ceil((date.getTime() - now) / 86_400_000)),
          amount,
          estimatedUsdValue,
          estimatedPercentOfMarketCap,
          estimatedPercentOfCirculatingSupply,
          allocation,
          allocationType: classifyAllocation(allocation),
          basis: record.source ?? null,
          contractEnforced: null,
          source: "NetSupply",
          chain: record.chain ?? null,
          providerSlug: record.slug ?? null,
        };

        return event;
      })
      .filter((event): event is UnlockEvent => event !== null)
      .sort((a, b) => a.date.localeCompare(b.date));

    const next = events[0] ?? null;
    const teamOrInvestorEvents = events.filter(
      (event) => event.allocationType === "team" || event.allocationType === "investors"
    );

    return NextResponse.json({
      token: { id: coinId, symbol, name },
      available: events.length > 0,
      coverage: matchingRows.length > 0 ? "matched" : "not_tracked",
      provider: "NetSupply",
      providerUrl: "https://netsupply.org/unlocks",
      lastCheckedAt: new Date().toISOString(),
      next,
      events: events.slice(0, 12),
      summary: {
        eventCount: events.length,
        teamOrInvestorEventCount: teamOrInvestorEvents.length,
        nextImpactSize: impactLabel(next?.estimatedPercentOfMarketCap ?? null),
        nextAllocationType: next?.allocationType ?? null,
      },
      message:
        events.length > 0
          ? null
          : matchingRows.length > 0
          ? "This token is recognised by the provider, but no future release is currently listed in the returned schedule."
          : "This token is not currently covered by the connected unlock dataset. PRISM cannot infer that no vesting or future release exists.",
      methodology: {
        valuation:
          "Estimated USD values use the token's current PRISM market price, not a future or transaction-time price.",
        circulatingSupply:
          "Estimated percent of circulating supply is derived from current market cap divided by current price when both are available.",
        interpretation:
          "A scheduled unlock describes token availability. It does not prove recipients will sell or predict a particular price direction.",
      },
    });
  } catch (error) {
    console.error("PRISM unlock intelligence error:", error);
    return NextResponse.json({
      token: { id: coinId, symbol, name },
      available: false,
      coverage: "provider_unavailable",
      events: [],
      provider: "NetSupply",
      providerUrl: "https://netsupply.org/unlocks",
      message:
        "PRISM could not retrieve the unlock schedule right now. This is a data-availability issue, not evidence that no unlock exists.",
    });
  }
}

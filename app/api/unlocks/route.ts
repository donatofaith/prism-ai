import { NextRequest, NextResponse } from "next/server";

type UnlockEvent = {
  id: string;
  date: string;
  daysUntil: number;
  amount: number | null;
  estimatedUsdValue: number | null;
  estimatedPercentOfMarketCap: number | null;
  estimatedPercentOfCirculatingSupply: number | null;
  allocation: string;
  allocationType: "team" | "investors" | "treasury" | "ecosystem" | "community" | "unknown";
  basis: string | null;
  contractEnforced: boolean | null;
  source: string;
};

type RawRecord = Record<string, unknown>;

const NETSUPPLY_UNLOCKS_URL =
  "https://netsupply.org/api/v1/unlocks?scope=scheduled&days=180&limit=500";

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numberValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const cleaned = value.replace(/,/g, "").trim();
    if (!cleaned) return null;
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function boolValue(value: unknown) {
  if (typeof value === "boolean") return value;
  if (value === "true" || value === 1 || value === "1") return true;
  if (value === "false" || value === 0 || value === "0") return false;
  return null;
}

function nested(record: RawRecord, path: string[]) {
  let current: unknown = record;
  for (const part of path) {
    if (!current || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function firstString(record: RawRecord, paths: string[][]) {
  for (const path of paths) {
    const value = stringValue(nested(record, path));
    if (value) return value;
  }
  return null;
}

function firstNumber(record: RawRecord, paths: string[][]) {
  for (const path of paths) {
    const value = numberValue(nested(record, path));
    if (value !== null) return value;
  }
  return null;
}

function firstBoolean(record: RawRecord, paths: string[][]) {
  for (const path of paths) {
    const value = boolValue(nested(record, path));
    if (value !== null) return value;
  }
  return null;
}

function normalize(value: string | null | undefined) {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function allocationType(label: string): UnlockEvent["allocationType"] {
  const value = label.toLowerCase();
  if (/team|founder|employee|contributor/.test(value)) return "team";
  if (/investor|private|seed|venture|vc|strategic/.test(value)) return "investors";
  if (/treasury|foundation/.test(value)) return "treasury";
  if (/ecosystem|incentive|reward|liquidity/.test(value)) return "ecosystem";
  if (/community|airdrop|public/.test(value)) return "community";
  return "unknown";
}

function parseDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function extractRecords(payload: unknown): RawRecord[] {
  if (Array.isArray(payload)) {
    return payload.filter((item): item is RawRecord => Boolean(item) && typeof item === "object");
  }

  if (!payload || typeof payload !== "object") return [];
  const object = payload as Record<string, unknown>;
  const candidates = [object.data, object.unlocks, object.items, object.results, object.events];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.filter(
        (item): item is RawRecord => Boolean(item) && typeof item === "object"
      );
    }
  }

  return [];
}

function recordMatches(
  record: RawRecord,
  coinId: string,
  symbol: string,
  name: string
) {
  const recordSymbol = firstString(record, [
    ["symbol"],
    ["token_symbol"],
    ["ticker"],
    ["token", "symbol"],
    ["asset", "symbol"],
  ]);
  const recordName = firstString(record, [
    ["name"],
    ["token_name"],
    ["token", "name"],
    ["asset", "name"],
  ]);
  const recordSlug = firstString(record, [
    ["slug"],
    ["token_slug"],
    ["coingecko_id"],
    ["gecko_id"],
    ["token", "slug"],
  ]);

  const targetSymbol = normalize(symbol);
  const targetName = normalize(name);
  const targetId = normalize(coinId);

  return (
    (targetSymbol && normalize(recordSymbol) === targetSymbol) ||
    (targetId && normalize(recordSlug) === targetId) ||
    (targetName && normalize(recordName) === targetName)
  );
}

function impactLabel(percentOfMarketCap: number | null) {
  if (percentOfMarketCap === null) return "unknown" as const;
  if (percentOfMarketCap >= 10) return "large" as const;
  if (percentOfMarketCap >= 3) return "meaningful" as const;
  return "limited" as const;
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
      headers: { accept: "application/json" },
      next: { revalidate: 900 },
    });

    if (!response.ok) {
      return NextResponse.json({
        token: { id: coinId, symbol, name },
        available: false,
        events: [],
        provider: "NetSupply",
        providerUrl: "https://netsupply.org",
        message: "Unlock schedule data is temporarily unavailable for this token.",
      });
    }

    const payload = await response.json();
    const records = extractRecords(payload).filter((record) =>
      recordMatches(record, coinId, symbol, name)
    );

    const now = Date.now();
    const estimatedCirculatingSupply =
      price && price > 0 && marketCap && marketCap > 0 ? marketCap / price : null;

    const events: UnlockEvent[] = records
      .map((record, index) => {
        const dateText = firstString(record, [
          ["release_on"],
          ["unlock_date"],
          ["date"],
          ["scheduled_at"],
          ["releaseAt"],
        ]);
        const date = parseDate(dateText);
        if (!date || date.getTime() < now - 86_400_000) return null;

        const amount = firstNumber(record, [
          ["amount_units"],
          ["amount"],
          ["unlock_amount"],
          ["token_amount"],
          ["tokens"],
        ]);

        const allocation =
          firstString(record, [
            ["allocation"],
            ["allocation_name"],
            ["category"],
            ["recipient"],
            ["label"],
            ["bucket"],
          ]) ?? "Unspecified allocation";

        const estimatedUsdValue =
          amount !== null && price !== null && price > 0 ? amount * price : null;
        const estimatedPercentOfMarketCap =
          estimatedUsdValue !== null && marketCap !== null && marketCap > 0
            ? (estimatedUsdValue / marketCap) * 100
            : null;
        const estimatedPercentOfCirculatingSupply =
          amount !== null && estimatedCirculatingSupply !== null && estimatedCirculatingSupply > 0
            ? (amount / estimatedCirculatingSupply) * 100
            : null;

        return {
          id: `${date.toISOString()}-${index}`,
          date: date.toISOString(),
          daysUntil: Math.max(0, Math.ceil((date.getTime() - now) / 86_400_000)),
          amount,
          estimatedUsdValue,
          estimatedPercentOfMarketCap,
          estimatedPercentOfCirculatingSupply,
          allocation,
          allocationType: allocationType(allocation),
          basis: firstString(record, [["basis"], ["schedule_basis"], ["source_basis"]]),
          contractEnforced: firstBoolean(record, [
            ["enforced_by_contract"],
            ["contract_enforced"],
            ["onchain_enforced"],
          ]),
          source: "NetSupply",
        } satisfies UnlockEvent;
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
      provider: "NetSupply",
      providerUrl: "https://netsupply.org",
      lastCheckedAt: new Date().toISOString(),
      next,
      events: events.slice(0, 12),
      summary: {
        eventCount: events.length,
        teamOrInvestorEventCount: teamOrInvestorEvents.length,
        nextImpactSize: impactLabel(next?.estimatedPercentOfMarketCap ?? null),
        nextAllocationType: next?.allocationType ?? null,
      },
      methodology: {
        valuation:
          "Estimated USD values use the token's current PRISM market price, not the historical value at the unlock date.",
        circulatingSupply:
          "Estimated percent of circulating supply is derived from current market cap divided by current price when both are available.",
        interpretation:
          "An unlock increases token availability according to its schedule. It does not by itself prove that recipients will sell or that price will move in a particular direction.",
      },
    });
  } catch (error) {
    console.error("PRISM unlock intelligence error:", error);
    return NextResponse.json({
      token: { id: coinId, symbol, name },
      available: false,
      events: [],
      provider: "NetSupply",
      providerUrl: "https://netsupply.org",
      message: "PRISM could not retrieve unlock schedule data right now.",
    });
  }
}

import { NextRequest, NextResponse } from "next/server";

type Source = "all" | "binance" | "bybit" | "okx" | "mexc";
type View = "gainers" | "losers" | "volume";

type Mover = {
  id: string;
  symbol: string;
  name: string;
  pair: string;
  price: number;
  change24h: number;
  volume24hUsd: number | null;
  marketCap: number | null;
  image: string | null;
  source: Source;
};

const STABLE_QUOTES = ["USDT", "USDC", "USD", "FDUSD"] as const;
const EXCLUDED_BASES = new Set([
  "USDT",
  "USDC",
  "USDE",
  "DAI",
  "FDUSD",
  "TUSD",
  "USDP",
  "PYUSD",
]);

function num(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function splitQuote(symbol: string) {
  const upper = symbol.toUpperCase();
  const quote = STABLE_QUOTES.find((candidate) => upper.endsWith(candidate));
  if (!quote) return null;
  const base = upper.slice(0, -quote.length);
  if (!base || EXCLUDED_BASES.has(base)) return null;
  return { base, quote, pair: `${base}/${quote}` };
}

function rank(rows: Mover[], view: View) {
  // Exchange gainers/losers pages can include low-volume markets. Do not apply an
  // arbitrary liquidity floor here because it changes the exchange's own ranking.
  const eligible = rows.filter(
    (row) =>
      Number.isFinite(row.price) &&
      row.price > 0 &&
      Number.isFinite(row.change24h)
  );

  if (view === "losers") {
    return eligible.sort((a, b) => a.change24h - b.change24h).slice(0, 30);
  }

  if (view === "volume") {
    return eligible
      .filter((row) => row.volume24hUsd !== null && (row.volume24hUsd ?? 0) > 0)
      .sort((a, b) => (b.volume24hUsd ?? 0) - (a.volume24hUsd ?? 0))
      .slice(0, 30);
  }

  return eligible.sort((a, b) => b.change24h - a.change24h).slice(0, 30);
}

async function fetchFirstOk(urls: string[]) {
  let lastStatus = 0;
  for (const url of urls) {
    try {
      const response = await fetch(url, {
        cache: "no-store",
        headers: {
          accept: "application/json",
          "user-agent": "PRISM-Crypto-Intelligence/1.0",
        },
        signal: AbortSignal.timeout(8000),
      });
      lastStatus = response.status;
      if (response.ok) return response;
    } catch {
      // Try the next official/public market-data endpoint.
    }
  }
  throw new Error(`Market-data endpoints unavailable${lastStatus ? ` (${lastStatus})` : ""}`);
}

async function fetchAllMarket(): Promise<Mover[]> {
  const url = new URL("https://api.coingecko.com/api/v3/coins/markets");
  url.searchParams.set("vs_currency", "usd");
  url.searchParams.set("order", "market_cap_desc");
  url.searchParams.set("per_page", "250");
  url.searchParams.set("page", "1");
  url.searchParams.set("sparkline", "false");
  url.searchParams.set("price_change_percentage", "24h");

  const response = await fetchFirstOk([url.toString()]);
  const payload = (await response.json()) as Array<Record<string, unknown>>;

  return payload
    .map((coin): Mover | null => {
      const price = num(coin.current_price);
      const change = num(coin.price_change_percentage_24h);
      if (price === null || change === null) return null;
      return {
        id: String(coin.id ?? coin.symbol ?? ""),
        symbol: String(coin.symbol ?? "").toUpperCase(),
        name: String(coin.name ?? coin.symbol ?? "Unknown"),
        pair: `${String(coin.symbol ?? "").toUpperCase()}/USD`,
        price,
        change24h: change,
        volume24hUsd: num(coin.total_volume),
        marketCap: num(coin.market_cap),
        image: typeof coin.image === "string" ? coin.image : null,
        source: "all",
      };
    })
    .filter((row): row is Mover => row !== null);
}

async function fetchBinance(): Promise<Mover[]> {
  // Binance recommends data-api.binance.vision for public market data. Keep
  // additional official API hosts as fallbacks because some cloud regions block
  // api.binance.com even for public endpoints.
  const response = await fetchFirstOk([
    "https://data-api.binance.vision/api/v3/ticker/24hr",
    "https://api1.binance.com/api/v3/ticker/24hr",
    "https://api3.binance.com/api/v3/ticker/24hr",
    "https://api.binance.com/api/v3/ticker/24hr",
  ]);
  const payload = (await response.json()) as Array<Record<string, unknown>>;

  return payload
    .map((ticker): Mover | null => {
      const symbol = String(ticker.symbol ?? "");
      const parsed = splitQuote(symbol);
      const price = num(ticker.lastPrice);
      const change = num(ticker.priceChangePercent);
      if (!parsed || price === null || change === null) return null;
      return {
        id: `binance-${symbol}`,
        symbol: parsed.base,
        name: parsed.base,
        pair: parsed.pair,
        price,
        change24h: change,
        volume24hUsd: num(ticker.quoteVolume),
        marketCap: null,
        image: null,
        source: "binance",
      };
    })
    .filter((row): row is Mover => row !== null);
}

async function fetchBybit(): Promise<Mover[]> {
  // Both api.bybit.com and api.bytick.com are documented Bybit mainnet hosts.
  const response = await fetchFirstOk([
    "https://api.bybit.com/v5/market/tickers?category=spot",
    "https://api.bytick.com/v5/market/tickers?category=spot",
  ]);
  const payload = (await response.json()) as {
    retCode?: number;
    result?: { list?: Array<Record<string, unknown>> };
  };
  if (payload.retCode !== undefined && payload.retCode !== 0) {
    throw new Error(`Bybit returned code ${payload.retCode}`);
  }

  return (payload.result?.list ?? [])
    .map((ticker): Mover | null => {
      const symbol = String(ticker.symbol ?? "");
      const parsed = splitQuote(symbol);
      const price = num(ticker.lastPrice);
      const rawChange = num(ticker.price24hPcnt);
      if (!parsed || price === null || rawChange === null) return null;
      return {
        id: `bybit-${symbol}`,
        symbol: parsed.base,
        name: parsed.base,
        pair: parsed.pair,
        price,
        // Bybit documents price24hPcnt as a decimal ratio (0.18 = 18%).
        change24h: rawChange * 100,
        volume24hUsd: num(ticker.turnover24h),
        marketCap: null,
        image: null,
        source: "bybit",
      };
    })
    .filter((row): row is Mover => row !== null);
}

async function fetchOkx(): Promise<Mover[]> {
  const response = await fetchFirstOk([
    "https://www.okx.com/api/v5/market/tickers?instType=SPOT",
  ]);
  const payload = (await response.json()) as {
    code?: string;
    data?: Array<Record<string, unknown>>;
  };
  if (payload.code && payload.code !== "0") {
    throw new Error(`OKX returned code ${payload.code}`);
  }

  return (payload.data ?? [])
    .map((ticker): Mover | null => {
      const instId = String(ticker.instId ?? "");
      const [base = "", quote = ""] = instId.split("-");
      if (
        !STABLE_QUOTES.includes(quote as (typeof STABLE_QUOTES)[number]) ||
        EXCLUDED_BASES.has(base)
      ) {
        return null;
      }
      const price = num(ticker.last);
      const open24h = num(ticker.open24h);
      if (price === null || open24h === null || open24h <= 0) return null;
      const change = ((price - open24h) / open24h) * 100;

      return {
        id: `okx-${instId}`,
        symbol: base,
        name: base,
        pair: `${base}/${quote}`,
        price,
        change24h: change,
        // For spot, OKX volCcy24h is quote-currency turnover.
        volume24hUsd: num(ticker.volCcy24h),
        marketCap: null,
        image: null,
        source: "okx",
      };
    })
    .filter((row): row is Mover => row !== null);
}

async function fetchMexc(): Promise<Mover[]> {
  const response = await fetchFirstOk([
    "https://api.mexc.com/api/v3/ticker/24hr",
  ]);
  const payload = (await response.json()) as Array<Record<string, unknown>>;

  return payload
    .map((ticker): Mover | null => {
      const symbol = String(ticker.symbol ?? "");
      const parsed = splitQuote(symbol);
      const price = num(ticker.lastPrice);
      if (!parsed || price === null) return null;

      let change = num(ticker.priceChangePercent);
      if (change !== null) {
        // MEXC's Spot V3 API returns priceChangePercent as a ratio in its
        // documented examples, e.g. 0.004 = 0.4%.
        change *= 100;
      } else {
        const open = num(ticker.openPrice);
        if (open === null || open <= 0) return null;
        change = ((price - open) / open) * 100;
      }

      let quoteVolume = num(ticker.quoteVolume);
      if (quoteVolume === null) {
        const baseVolume = num(ticker.volume);
        quoteVolume = baseVolume !== null ? baseVolume * price : null;
      }

      return {
        id: `mexc-${symbol}`,
        symbol: parsed.base,
        name: parsed.base,
        pair: parsed.pair,
        price,
        change24h: change,
        volume24hUsd: quoteVolume,
        marketCap: null,
        image: null,
        source: "mexc",
      };
    })
    .filter((row): row is Mover => row !== null);
}

export async function GET(request: NextRequest) {
  const sourceParam = request.nextUrl.searchParams.get("source")?.toLowerCase() ?? "all";
  const viewParam = request.nextUrl.searchParams.get("view")?.toLowerCase() ?? "gainers";

  const source: Source = ["all", "binance", "bybit", "okx", "mexc"].includes(sourceParam)
    ? (sourceParam as Source)
    : "all";
  const view: View = ["gainers", "losers", "volume"].includes(viewParam)
    ? (viewParam as View)
    : "gainers";

  try {
    const rows =
      source === "binance"
        ? await fetchBinance()
        : source === "bybit"
        ? await fetchBybit()
        : source === "okx"
        ? await fetchOkx()
        : source === "mexc"
        ? await fetchMexc()
        : await fetchAllMarket();

    return NextResponse.json({
      source,
      view,
      generatedAt: new Date().toISOString(),
      methodology:
        source === "all"
          ? "Whole-market ranking from CoinGecko's current market snapshot."
          : `Spot-market ranking calculated directly from ${source.toUpperCase()}'s public 24-hour ticker snapshot without applying a PRISM liquidity cutoff.`,
      movers: rank(rows, view),
    });
  } catch (error) {
    console.error("PRISM market movers error:", error);
    return NextResponse.json(
      {
        error:
          source === "binance" || source === "bybit"
            ? `${source === "binance" ? "Binance" : "Bybit"} public market data could not be reached from PRISM's server. PRISM tried the provider's documented fallback hosts.`
            : "This market source is temporarily unavailable. Try another source or refresh shortly.",
        source,
        view,
      },
      { status: 502 }
    );
  }
}

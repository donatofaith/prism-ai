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
const EXCLUDED_BASES = new Set(["USDT", "USDC", "USDE", "DAI", "FDUSD", "TUSD", "USDP", "PYUSD"]);

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
  const eligible = rows.filter(
    (row) =>
      Number.isFinite(row.price) &&
      row.price > 0 &&
      Number.isFinite(row.change24h) &&
      (row.volume24hUsd === null || row.volume24hUsd >= 25_000)
  );

  if (view === "losers") {
    return eligible.sort((a, b) => a.change24h - b.change24h).slice(0, 30);
  }

  if (view === "volume") {
    return eligible
      .filter((row) => row.volume24hUsd !== null)
      .sort((a, b) => (b.volume24hUsd ?? 0) - (a.volume24hUsd ?? 0))
      .slice(0, 30);
  }

  return eligible.sort((a, b) => b.change24h - a.change24h).slice(0, 30);
}

async function fetchAllMarket(): Promise<Mover[]> {
  const url = new URL("https://api.coingecko.com/api/v3/coins/markets");
  url.searchParams.set("vs_currency", "usd");
  url.searchParams.set("order", "market_cap_desc");
  url.searchParams.set("per_page", "250");
  url.searchParams.set("page", "1");
  url.searchParams.set("sparkline", "false");
  url.searchParams.set("price_change_percentage", "24h");

  const response = await fetch(url, {
    cache: "no-store",
    headers: { accept: "application/json" },
  });
  if (!response.ok) throw new Error(`CoinGecko returned ${response.status}`);

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
  const response = await fetch("https://api.binance.com/api/v3/ticker/24hr", {
    cache: "no-store",
    headers: { accept: "application/json" },
  });
  if (!response.ok) throw new Error(`Binance returned ${response.status}`);
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
  const response = await fetch("https://api.bybit.com/v5/market/tickers?category=spot", {
    cache: "no-store",
    headers: { accept: "application/json" },
  });
  if (!response.ok) throw new Error(`Bybit returned ${response.status}`);
  const payload = (await response.json()) as {
    result?: { list?: Array<Record<string, unknown>> };
  };

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
  const response = await fetch("https://www.okx.com/api/v5/market/tickers?instType=SPOT", {
    cache: "no-store",
    headers: { accept: "application/json" },
  });
  if (!response.ok) throw new Error(`OKX returned ${response.status}`);
  const payload = (await response.json()) as { data?: Array<Record<string, unknown>> };

  return (payload.data ?? [])
    .map((ticker): Mover | null => {
      const instId = String(ticker.instId ?? "");
      const [base = "", quote = ""] = instId.split("-");
      if (!STABLE_QUOTES.includes(quote as (typeof STABLE_QUOTES)[number]) || EXCLUDED_BASES.has(base)) return null;
      const price = num(ticker.last);
      const open24h = num(ticker.open24h);
      if (price === null || open24h === null || open24h <= 0) return null;
      const change = ((price - open24h) / open24h) * 100;
      const quoteVolume = num(ticker.volCcy24h);
      return {
        id: `okx-${instId}`,
        symbol: base,
        name: base,
        pair: `${base}/${quote}`,
        price,
        change24h: change,
        volume24hUsd: quoteVolume,
        marketCap: null,
        image: null,
        source: "okx",
      };
    })
    .filter((row): row is Mover => row !== null);
}

async function fetchMexc(): Promise<Mover[]> {
  const response = await fetch("https://api.mexc.com/api/v3/ticker/24hr", {
    cache: "no-store",
    headers: { accept: "application/json" },
  });
  if (!response.ok) throw new Error(`MEXC returned ${response.status}`);
  const payload = (await response.json()) as Array<Record<string, unknown>>;

  return payload
    .map((ticker): Mover | null => {
      const symbol = String(ticker.symbol ?? "");
      const parsed = splitQuote(symbol);
      const price = num(ticker.lastPrice);
      if (!parsed || price === null) return null;

      let change = num(ticker.priceChangePercent);
      if (change === null) {
        const open = num(ticker.openPrice);
        if (open === null || open <= 0) return null;
        change = ((price - open) / open) * 100;
      }

      return {
        id: `mexc-${symbol}`,
        symbol: parsed.base,
        name: parsed.base,
        pair: parsed.pair,
        price,
        change24h: change,
        volume24hUsd: num(ticker.quoteVolume),
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
          : `Spot-market ranking calculated from ${source.toUpperCase()}'s own public 24-hour ticker data.`,
      movers: rank(rows, view),
    });
  } catch (error) {
    console.error("PRISM market movers error:", error);
    return NextResponse.json(
      {
        error: "This market source is temporarily unavailable. Try another source or refresh shortly.",
        source,
        view,
      },
      { status: 502 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";

export const preferredRegion = ["sin1"];

type Source = "all" | "binance" | "bybit" | "okx" | "mexc";
type View = "gainers" | "losers" | "volume";
type DataProvider = "direct" | "coingecko-fallback";

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

type BybitResult = {
  rows: Mover[];
  provider: DataProvider;
};

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

function splitUsdtPair(symbol: string) {
  const upper = symbol.toUpperCase();
  if (!upper.endsWith("USDT")) return null;
  const base = upper.slice(0, -4);
  if (!base || EXCLUDED_BASES.has(base)) return null;
  return { base, quote: "USDT", pair: `${base}/USDT` };
}

function rank(rows: Mover[], view: View) {
  const eligible = rows.filter(
    (row) =>
      Number.isFinite(row.price) &&
      row.price > 0 &&
      Number.isFinite(row.change24h)
  );

  if (view === "losers") {
    return eligible
      .filter((row) => row.change24h < 0)
      .sort((a, b) => a.change24h - b.change24h)
      .slice(0, 30);
  }

  if (view === "volume") {
    return eligible
      .filter((row) => row.volume24hUsd !== null && (row.volume24hUsd ?? 0) > 0)
      .sort((a, b) => (b.volume24hUsd ?? 0) - (a.volume24hUsd ?? 0))
      .slice(0, 30);
  }

  return eligible
    .filter((row) => row.change24h > 0)
    .sort((a, b) => b.change24h - a.change24h)
    .slice(0, 30);
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
      // Try the next public/documented host.
    }
  }

  throw new Error(
    `Market-data endpoints unavailable${lastStatus ? ` (${lastStatus})` : ""}`
  );
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
  const tickerHosts = [
    "https://data-api.binance.vision/api/v3/ticker/24hr",
    "https://api1.binance.com/api/v3/ticker/24hr",
    "https://api3.binance.com/api/v3/ticker/24hr",
    "https://api.binance.com/api/v3/ticker/24hr",
  ];
  const infoHosts = [
    "https://data-api.binance.vision/api/v3/exchangeInfo",
    "https://api1.binance.com/api/v3/exchangeInfo",
    "https://api3.binance.com/api/v3/exchangeInfo",
    "https://api.binance.com/api/v3/exchangeInfo",
  ];

  const [tickerResponse, infoResponse] = await Promise.all([
    fetchFirstOk(tickerHosts),
    fetchFirstOk(infoHosts),
  ]);

  const payload = (await tickerResponse.json()) as Array<Record<string, unknown>>;
  const info = (await infoResponse.json()) as {
    symbols?: Array<Record<string, unknown>>;
  };

  const tradingUsdt = new Set(
    (info.symbols ?? [])
      .filter(
        (item) =>
          item.status === "TRADING" &&
          item.quoteAsset === "USDT" &&
          item.isSpotTradingAllowed !== false
      )
      .map((item) => String(item.symbol ?? ""))
      .filter(Boolean)
  );

  return payload
    .map((ticker): Mover | null => {
      const symbol = String(ticker.symbol ?? "");
      if (!tradingUsdt.has(symbol)) return null;

      const parsed = splitUsdtPair(symbol);
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

async function fetchBybitDirect(): Promise<Mover[]> {
  const [tickerResponse, infoResponse] = await Promise.all([
    fetchFirstOk([
      "https://api.bybit.com/v5/market/tickers?category=spot",
      "https://api.bytick.com/v5/market/tickers?category=spot",
    ]),
    fetchFirstOk([
      "https://api.bybit.com/v5/market/instruments-info?category=spot&status=Trading",
      "https://api.bytick.com/v5/market/instruments-info?category=spot&status=Trading",
    ]),
  ]);

  const payload = (await tickerResponse.json()) as {
    retCode?: number;
    result?: { list?: Array<Record<string, unknown>> };
  };
  const info = (await infoResponse.json()) as {
    retCode?: number;
    result?: { list?: Array<Record<string, unknown>> };
  };

  if ((payload.retCode ?? 0) !== 0 || (info.retCode ?? 0) !== 0) {
    throw new Error("Bybit market metadata request failed");
  }

  const tradingUsdt = new Set(
    (info.result?.list ?? [])
      .filter(
        (item) =>
          String(item.status ?? "Trading") === "Trading" &&
          String(item.quoteCoin ?? "") === "USDT"
      )
      .map((item) => String(item.symbol ?? ""))
      .filter(Boolean)
  );

  return (payload.result?.list ?? [])
    .map((ticker): Mover | null => {
      const symbol = String(ticker.symbol ?? "");
      if (!tradingUsdt.has(symbol)) return null;

      const parsed = splitUsdtPair(symbol);
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

async function fetchBybitViaCoinGecko(): Promise<Mover[]> {
  const exchangeResponse = await fetchFirstOk([
    "https://api.coingecko.com/api/v3/exchanges/bybit_spot/tickers?page=1&depth=false",
  ]);

  const exchangePayload = (await exchangeResponse.json()) as {
    tickers?: Array<Record<string, unknown>>;
  };

  const usdtTickers = (exchangePayload.tickers ?? []).filter((ticker) => {
    const target = String(ticker.target ?? "").toUpperCase();
    const base = String(ticker.base ?? "").toUpperCase();
    return target === "USDT" && base && !EXCLUDED_BASES.has(base);
  });

  const coinIds = Array.from(
    new Set(
      usdtTickers
        .map((ticker) => String(ticker.coin_id ?? ""))
        .filter(Boolean)
    )
  ).slice(0, 100);

  if (coinIds.length === 0) {
    throw new Error("CoinGecko returned no Bybit spot-market identifiers");
  }

  const marketsUrl = new URL("https://api.coingecko.com/api/v3/coins/markets");
  marketsUrl.searchParams.set("vs_currency", "usd");
  marketsUrl.searchParams.set("ids", coinIds.join(","));
  marketsUrl.searchParams.set("order", "market_cap_desc");
  marketsUrl.searchParams.set("per_page", "100");
  marketsUrl.searchParams.set("page", "1");
  marketsUrl.searchParams.set("sparkline", "false");
  marketsUrl.searchParams.set("price_change_percentage", "24h");

  const marketsResponse = await fetchFirstOk([marketsUrl.toString()]);
  const markets = (await marketsResponse.json()) as Array<Record<string, unknown>>;
  const marketById = new Map(
    markets.map((coin) => [String(coin.id ?? ""), coin] as const)
  );

  return usdtTickers
    .map((ticker): Mover | null => {
      const coinId = String(ticker.coin_id ?? "");
      const coin = marketById.get(coinId);
      if (!coin) return null;

      const symbol = String(ticker.base ?? coin.symbol ?? "").toUpperCase();
      const convertedLast = ticker.converted_last as
        | Record<string, unknown>
        | undefined;
      const convertedVolume = ticker.converted_volume as
        | Record<string, unknown>
        | undefined;
      const price = num(convertedLast?.usd) ?? num(coin.current_price);
      const change = num(coin.price_change_percentage_24h);
      if (!symbol || price === null || change === null) return null;

      return {
        id: `bybit-${coinId}-${symbol}`,
        symbol,
        name: String(coin.name ?? symbol),
        pair: `${symbol}/USDT`,
        price,
        change24h: change,
        volume24hUsd: num(convertedVolume?.usd),
        marketCap: num(coin.market_cap),
        image: typeof coin.image === "string" ? coin.image : null,
        source: "bybit",
      };
    })
    .filter((row): row is Mover => row !== null);
}

async function fetchBybit(): Promise<BybitResult> {
  try {
    const rows = await fetchBybitDirect();
    if (rows.length === 0) throw new Error("Bybit returned no usable spot rows");
    return { rows, provider: "direct" };
  } catch (directError) {
    console.warn(
      "PRISM Bybit direct feed unavailable; using CoinGecko exchange fallback:",
      directError
    );
    const rows = await fetchBybitViaCoinGecko();
    return { rows, provider: "coingecko-fallback" };
  }
}

async function fetchOkx(): Promise<Mover[]> {
  const [tickerResponse, infoResponse] = await Promise.all([
    fetchFirstOk(["https://www.okx.com/api/v5/market/tickers?instType=SPOT"]),
    fetchFirstOk(["https://www.okx.com/api/v5/public/instruments?instType=SPOT"]),
  ]);

  const payload = (await tickerResponse.json()) as {
    code?: string;
    data?: Array<Record<string, unknown>>;
  };
  const info = (await infoResponse.json()) as {
    code?: string;
    data?: Array<Record<string, unknown>>;
  };

  if ((payload.code && payload.code !== "0") || (info.code && info.code !== "0")) {
    throw new Error("OKX market metadata request failed");
  }

  const liveUsdt = new Set(
    (info.data ?? [])
      .filter(
        (item) =>
          String(item.state ?? "live") === "live" &&
          String(item.quoteCcy ?? "") === "USDT"
      )
      .map((item) => String(item.instId ?? ""))
      .filter(Boolean)
  );

  return (payload.data ?? [])
    .map((ticker): Mover | null => {
      const instId = String(ticker.instId ?? "");
      if (!liveUsdt.has(instId)) return null;

      const [base = "", quote = ""] = instId.split("-");
      if (quote !== "USDT" || EXCLUDED_BASES.has(base)) return null;

      const price = num(ticker.last);
      const open24h = num(ticker.open24h);
      if (price === null || open24h === null || open24h <= 0) return null;

      const change = ((price - open24h) / open24h) * 100;

      return {
        id: `okx-${instId}`,
        symbol: base,
        name: base,
        pair: `${base}/USDT`,
        price,
        change24h: change,
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
      const parsed = splitUsdtPair(symbol);
      const price = num(ticker.lastPrice);
      if (!parsed || price === null) return null;

      let change = num(ticker.priceChangePercent);
      if (change !== null) {
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
  const sourceParam =
    request.nextUrl.searchParams.get("source")?.toLowerCase() ?? "all";
  const viewParam =
    request.nextUrl.searchParams.get("view")?.toLowerCase() ?? "gainers";

  const source: Source = ["all", "binance", "bybit", "okx", "mexc"].includes(
    sourceParam
  )
    ? (sourceParam as Source)
    : "all";
  const view: View = ["gainers", "losers", "volume"].includes(viewParam)
    ? (viewParam as View)
    : "gainers";

  try {
    let rows: Mover[];
    let provider: DataProvider = "direct";

    if (source === "binance") {
      rows = await fetchBinance();
    } else if (source === "bybit") {
      const result = await fetchBybit();
      rows = result.rows;
      provider = result.provider;
    } else if (source === "okx") {
      rows = await fetchOkx();
    } else if (source === "mexc") {
      rows = await fetchMexc();
    } else {
      rows = await fetchAllMarket();
    }

    const methodology =
      source === "all"
        ? "Whole-market ranking from CoinGecko's current market snapshot."
        : source === "bybit" && provider === "coingecko-fallback"
        ? "Bybit USDT spot-pair membership, price and exchange volume are read through CoinGecko's Bybit exchange feed when Bybit's direct public API is unavailable from PRISM's server. The 24-hour percentage change comes from CoinGecko's current market snapshot."
        : `Ranking from ${source.toUpperCase()}'s own currently tradable USDT spot markets and public 24-hour ticker snapshot. No PRISM liquidity cutoff is applied.`;

    return NextResponse.json({
      source,
      view,
      provider,
      generatedAt: new Date().toISOString(),
      marketScope: source === "all" ? "whole-market" : "USDT-spot",
      methodology,
      movers: rank(rows, view),
    });
  } catch (error) {
    console.error("PRISM market movers error:", error);

    return NextResponse.json(
      {
        error:
          source === "bybit"
            ? "Bybit market data is temporarily unavailable from both the direct feed and PRISM's fallback market feed. Try another source or refresh shortly."
            : source === "binance"
            ? "Binance public market data could not be reached from PRISM's server. Try another source or refresh shortly."
            : "This market source is temporarily unavailable. Try another source or refresh shortly.",
        source,
        view,
      },
      { status: 502 }
    );
  }
}

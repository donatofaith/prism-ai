import { NextRequest, NextResponse } from "next/server";

type SearchCoin = {
  id: string;
  name: string;
  symbol: string;
  market_cap_rank?: number | null;
};

type CoinListItem = {
  id: string;
  name: string;
  symbol: string;
};

type CoinGeckoMarket = {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number;
  market_cap: number;
  total_volume: number;
  price_change_percentage_24h: number | null;
};

type CoinGeckoContractCoin = {
  id: string;
  symbol: string;
  name: string;
  asset_platform_id?: string | null;
  contract_address?: string | null;
  image?: {
    thumb?: string | null;
    small?: string | null;
    large?: string | null;
  };
  market_data?: {
    current_price?: { usd?: number | null };
    market_cap?: { usd?: number | null };
    total_volume?: { usd?: number | null };
    price_change_percentage_24h?: number | null;
  };
};

type CoinGeckoDetail = CoinGeckoContractCoin;

type ContractPlatform = {
  id: string;
  label: string;
  addressType: "evm" | "solana";
};

const CONTRACT_PLATFORMS: ContractPlatform[] = [
  { id: "ethereum", label: "Ethereum", addressType: "evm" },
  { id: "arbitrum-one", label: "Arbitrum", addressType: "evm" },
  { id: "base", label: "Base", addressType: "evm" },
  { id: "optimistic-ethereum", label: "Optimism", addressType: "evm" },
  { id: "polygon-pos", label: "Polygon", addressType: "evm" },
  { id: "binance-smart-chain", label: "BNB Smart Chain", addressType: "evm" },
  { id: "avalanche", label: "Avalanche", addressType: "evm" },
  { id: "solana", label: "Solana", addressType: "solana" },
];

function isEvmContractAddress(value: string) {
  return /^0x[a-fA-F0-9]{40}$/.test(value);
}

function isLikelySolanaAddress(value: string) {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value);
}

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function coinRank(coin: SearchCoin) {
  return coin.market_cap_rank ?? Number.MAX_SAFE_INTEGER;
}

function coingeckoHeaders() {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "User-Agent": "PRISM-Crypto-Intelligence/1.0",
  };

  const demoKey = process.env.COINGECKO_DEMO_API_KEY;
  if (demoKey) headers["x-cg-demo-api-key"] = demoKey;

  return headers;
}

async function fetchCoinGecko(url: string, revalidate?: number) {
  try {
    return await fetch(url, {
      headers: coingeckoHeaders(),
      ...(revalidate
        ? { next: { revalidate } }
        : { cache: "no-store" as const }),
      signal: AbortSignal.timeout(9000),
    });
  } catch {
    return null;
  }
}

async function fetchContractCoin(
  platform: ContractPlatform,
  contractAddress: string
) {
  const response = await fetchCoinGecko(
    `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(
      platform.id
    )}/contract/${encodeURIComponent(contractAddress)}`
  );

  if (!response?.ok) return null;

  const coin = (await response.json()) as CoinGeckoContractCoin;
  return coin?.id ? coin : null;
}

async function resolveByContractAddress(query: string) {
  const addressType = isEvmContractAddress(query)
    ? "evm"
    : isLikelySolanaAddress(query)
    ? "solana"
    : null;

  if (!addressType) return null;

  const platforms = CONTRACT_PLATFORMS.filter(
    (platform) => platform.addressType === addressType
  );

  for (const platform of platforms) {
    const coin = await fetchContractCoin(platform, query);
    if (coin) return { coin, platform };
  }

  return null;
}

function marketFromDetail(detail: CoinGeckoDetail): CoinGeckoMarket | null {
  const price = detail.market_data?.current_price?.usd;
  if (typeof price !== "number" || !Number.isFinite(price)) return null;

  return {
    id: detail.id,
    symbol: detail.symbol,
    name: detail.name,
    image:
      detail.image?.large ?? detail.image?.small ?? detail.image?.thumb ?? "",
    current_price: price,
    market_cap: detail.market_data?.market_cap?.usd ?? 0,
    total_volume: detail.market_data?.total_volume?.usd ?? 0,
    price_change_percentage_24h:
      detail.market_data?.price_change_percentage_24h ?? 0,
  };
}

async function fetchMarketsByIds(ids: string[]) {
  if (!ids.length) return [] as CoinGeckoMarket[];

  const response = await fetchCoinGecko(
    `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${encodeURIComponent(
      ids.join(",")
    )}&price_change_percentage=24h`,
    30
  );

  if (!response?.ok) return [] as CoinGeckoMarket[];
  return (await response.json()) as CoinGeckoMarket[];
}

async function fetchMarketData(coinId: string) {
  const rows = await fetchMarketsByIds([coinId]);
  if (rows[0]) return rows[0];

  // Fallback to the coin detail endpoint so one failing CoinGecko endpoint does
  // not break the whole PRISM investigation.
  const detailResponse = await fetchCoinGecko(
    `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(
      coinId
    )}?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false&sparkline=false`,
    30
  );

  if (!detailResponse?.ok) return null;

  const detail = (await detailResponse.json()) as CoinGeckoDetail;
  return detail?.id ? marketFromDetail(detail) : null;
}

async function searchCoinGecko(query: string) {
  const response = await fetchCoinGecko(
    `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(query)}`,
    60
  );

  if (!response?.ok) return null;

  const data = (await response.json()) as { coins?: SearchCoin[] };
  return data.coins ?? [];
}

async function fetchCoinList() {
  const response = await fetchCoinGecko(
    "https://api.coingecko.com/api/v3/coins/list",
    3600
  );

  if (!response?.ok) return null;
  return (await response.json()) as CoinListItem[];
}

async function resolveFromCoinList(query: string) {
  const list = await fetchCoinList();
  if (!list) return null;

  const q = normalize(query);
  const exactId = list.find((coin) => normalize(coin.id) === q);
  const exactName = list.find((coin) => normalize(coin.name) === q);

  if (exactId || exactName) {
    const match = exactId ?? exactName!;
    return {
      coin: match,
      inputType: exactId ? ("id" as const) : ("name" as const),
    };
  }

  const symbolMatches = list.filter((coin) => normalize(coin.symbol) === q);
  if (!symbolMatches.length) return null;

  // Symbols are not unique. Ask CoinGecko for all exact-symbol candidates in one
  // request and use the largest current market cap instead of hard-coding tokens.
  const candidates = symbolMatches.slice(0, 50);
  const markets = await fetchMarketsByIds(candidates.map((coin) => coin.id));

  if (markets.length) {
    const best = [...markets].sort(
      (a, b) => (b.market_cap ?? 0) - (a.market_cap ?? 0)
    )[0];
    const matchingCoin = candidates.find((coin) => coin.id === best.id);
    if (matchingCoin) {
      return { coin: matchingCoin, inputType: "symbol" as const, market: best };
    }
  }

  return { coin: candidates[0], inputType: "symbol" as const };
}

async function resolveToken(query: string) {
  const q = normalize(query);
  const searchResults = await searchCoinGecko(query);

  if (searchResults?.length) {
    const exactIdMatch = searchResults.find((coin) => normalize(coin.id) === q);
    const exactNameMatch = searchResults.find((coin) => normalize(coin.name) === q);
    const exactSymbolMatches = searchResults
      .filter((coin) => normalize(coin.symbol) === q)
      .sort((a, b) => coinRank(a) - coinRank(b));
    const ranked = [...searchResults].sort((a, b) => coinRank(a) - coinRank(b));

    const selected =
      exactIdMatch ??
      exactNameMatch ??
      exactSymbolMatches[0] ??
      ranked[0] ??
      searchResults[0];

    const inputType =
      exactSymbolMatches[0]?.id === selected.id
        ? ("symbol" as const)
        : exactNameMatch?.id === selected.id
        ? ("name" as const)
        : exactIdMatch?.id === selected.id
        ? ("id" as const)
        : ("search" as const);

    return { coin: selected, inputType };
  }

  // Generic fallback for every CoinGecko-listed token. This is used when the
  // search endpoint is rate-limited, unavailable, or simply returns no match.
  return resolveFromCoinList(query);
}

export async function GET(request: NextRequest) {
  try {
    const query = request.nextUrl.searchParams.get("q")?.trim();

    if (!query) {
      return NextResponse.json(
        { error: "Enter a token name, symbol, or contract address." },
        { status: 400 }
      );
    }

    const looksLikeContract =
      isEvmContractAddress(query) || isLikelySolanaAddress(query);

    if (looksLikeContract) {
      const resolved = await resolveByContractAddress(query);

      if (!resolved) {
        return NextResponse.json(
          {
            error:
              "PRISM could not resolve this contract address on its current contract-discovery networks.",
            inputType: "contract",
            supportedContractNetworks: CONTRACT_PLATFORMS.map(
              (platform) => platform.label
            ),
          },
          { status: 404 }
        );
      }

      const { coin, platform } = resolved;
      const market = await fetchMarketData(coin.id);

      return NextResponse.json({
        id: coin.id,
        name: coin.name,
        symbol: coin.symbol.toUpperCase(),
        image:
          market?.image ??
          coin.image?.large ??
          coin.image?.small ??
          coin.image?.thumb ??
          "",
        price: market?.current_price ?? coin.market_data?.current_price?.usd ?? 0,
        marketCap: market?.market_cap ?? coin.market_data?.market_cap?.usd ?? 0,
        volume24h: market?.total_volume ?? coin.market_data?.total_volume?.usd ?? 0,
        change24h:
          market?.price_change_percentage_24h ??
          coin.market_data?.price_change_percentage_24h ??
          0,
        inputType: "contract",
        contractAddress: coin.contract_address ?? query,
        platform: platform.id,
        platformLabel: platform.label,
        contractDiscovery: true,
      });
    }

    const resolved = await resolveToken(query);

    if (!resolved) {
      return NextResponse.json(
        { error: `No token found for "${query}".` },
        { status: 404 }
      );
    }

    const market =
      "market" in resolved && resolved.market
        ? resolved.market
        : await fetchMarketData(resolved.coin.id);

    if (!market) {
      return NextResponse.json(
        {
          error:
            "PRISM found the token, but live market data is temporarily unavailable. Please retry shortly.",
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      id: market.id,
      name: market.name,
      symbol: market.symbol.toUpperCase(),
      image: market.image,
      price: market.current_price,
      marketCap: market.market_cap,
      volume24h: market.total_volume,
      change24h: market.price_change_percentage_24h ?? 0,
      inputType: resolved.inputType,
      contractAddress: null,
      platform: null,
      platformLabel: null,
      contractDiscovery: false,
    });
  } catch (error) {
    console.error("PRISM market API error:", error);

    return NextResponse.json(
      { error: "Something went wrong while retrieving market data." },
      { status: 500 }
    );
  }
}

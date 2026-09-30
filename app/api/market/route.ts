import { NextRequest, NextResponse } from "next/server";

type SearchCoin = {
  id: string;
  name: string;
  symbol: string;
  market_cap_rank?: number | null;
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

// These aliases bypass CoinGecko's search endpoint for common PRISM assets.
// This makes symbol lookup more reliable when the provider's search endpoint is
// temporarily rate-limited while keeping the canonical CoinGecko id intact.
const KNOWN_COIN_IDS: Record<string, string> = {
  BTC: "bitcoin",
  BITCOIN: "bitcoin",
  ETH: "ethereum",
  ETHEREUM: "ethereum",
  SOL: "solana",
  SOLANA: "solana",
  CYS: "cysic",
  CYSIC: "cysic",
  ENS: "ethereum-name-service",
  AAVE: "aave",
  UNI: "uniswap",
  UNISWAP: "uniswap",
  ARB: "arbitrum",
  ARBITRUM: "arbitrum",
  OP: "optimism",
  OPTIMISM: "optimism",
  LDO: "lido-dao",
  LIDO: "lido-dao",
  COMP: "compound-governance-token",
  COMPOUND: "compound-governance-token",
  SUSHI: "sushi",
  SUSHISWAP: "sushi",
  POL: "polygon-ecosystem-token",
  MATIC: "polygon-ecosystem-token",
  POLYGON: "polygon-ecosystem-token",
  CVX: "convex-finance",
  CONVEX: "convex-finance",
  FXS: "frax-share",
  FRAX: "frax-share",
};

function isEvmContractAddress(value: string) {
  return /^0x[a-fA-F0-9]{40}$/.test(value);
}

function isLikelySolanaAddress(value: string) {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value);
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

  if (!response || !response.ok) return null;

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

async function fetchMarketData(coinId: string) {
  const marketUrl =
    `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${encodeURIComponent(
      coinId
    )}&price_change_percentage=24h`;

  const marketResponse = await fetchCoinGecko(marketUrl, 30);

  if (marketResponse?.ok) {
    const marketData = (await marketResponse.json()) as CoinGeckoMarket[];
    if (marketData[0]) return marketData[0];
  }

  // Secondary CoinGecko endpoint. This prevents a temporary failure on
  // /coins/markets from breaking the entire investigation flow.
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

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get("q")?.trim();

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

      const price =
        market?.current_price ?? coin.market_data?.current_price?.usd ?? 0;
      const marketCap =
        market?.market_cap ?? coin.market_data?.market_cap?.usd ?? 0;
      const volume24h =
        market?.total_volume ?? coin.market_data?.total_volume?.usd ?? 0;
      const change24h =
        market?.price_change_percentage_24h ??
        coin.market_data?.price_change_percentage_24h ??
        0;
      const image =
        market?.image ??
        coin.image?.large ??
        coin.image?.small ??
        coin.image?.thumb ??
        "";

      return NextResponse.json({
        id: coin.id,
        name: coin.name,
        symbol: coin.symbol.toUpperCase(),
        image,
        price,
        marketCap,
        volume24h,
        change24h,
        inputType: "contract",
        contractAddress: coin.contract_address ?? query,
        platform: platform.id,
        platformLabel: platform.label,
        contractDiscovery: true,
      });
    }

    const normalizedQuery = query.toLowerCase();
    const knownCoinId = KNOWN_COIN_IDS[query.toUpperCase()];

    let selectedCoin: SearchCoin | null = null;
    let inputType: "symbol" | "name" | "id" | "search" = "search";

    if (knownCoinId) {
      selectedCoin = {
        id: knownCoinId,
        name: query,
        symbol: query,
      };
      inputType = "symbol";
    } else {
      const coins = await searchCoinGecko(query);

      if (coins === null) {
        return NextResponse.json(
          {
            error:
              "PRISM's market-data provider is temporarily unavailable. Please retry in a moment.",
          },
          { status: 502 }
        );
      }

      if (coins.length === 0) {
        return NextResponse.json(
          { error: `No token found for "${query}".` },
          { status: 404 }
        );
      }

      const exactIdMatch = coins.find(
        (coin) => coin.id.toLowerCase() === normalizedQuery
      );
      const exactNameMatch = coins.find(
        (coin) => coin.name.toLowerCase() === normalizedQuery
      );
      const exactSymbolMatches = coins
        .filter((coin) => coin.symbol.toLowerCase() === normalizedQuery)
        .sort((a, b) => coinRank(a) - coinRank(b));
      const rankedCoins = [...coins].sort((a, b) => coinRank(a) - coinRank(b));

      selectedCoin =
        exactIdMatch ??
        exactNameMatch ??
        exactSymbolMatches[0] ??
        rankedCoins[0] ??
        coins[0];

      inputType =
        exactSymbolMatches[0]?.id === selectedCoin.id
          ? "symbol"
          : exactNameMatch?.id === selectedCoin.id
          ? "name"
          : exactIdMatch?.id === selectedCoin.id
          ? "id"
          : "search";
    }

    const coin = await fetchMarketData(selectedCoin.id);

    if (!coin) {
      return NextResponse.json(
        {
          error:
            "PRISM found the token, but live market data is temporarily unavailable. Please retry shortly.",
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      id: coin.id,
      name: coin.name,
      symbol: coin.symbol.toUpperCase(),
      image: coin.image,
      price: coin.current_price,
      marketCap: coin.market_cap,
      volume24h: coin.total_volume,
      change24h: coin.price_change_percentage_24h ?? 0,
      inputType,
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

function coinRank(coin: SearchCoin) {
  return coin.market_cap_rank ?? Number.MAX_SAFE_INTEGER;
}

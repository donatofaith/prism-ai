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
    current_price?: {
      usd?: number | null;
    };
    market_cap?: {
      usd?: number | null;
    };
    total_volume?: {
      usd?: number | null;
    };
    price_change_percentage_24h?: number | null;
  };
};

type ContractPlatform = {
  id: string;
  label: string;
  addressType: "evm" | "solana";
};

const CONTRACT_PLATFORMS: ContractPlatform[] = [
  {
    id: "ethereum",
    label: "Ethereum",
    addressType: "evm",
  },
  {
    id: "arbitrum-one",
    label: "Arbitrum",
    addressType: "evm",
  },
  {
    id: "base",
    label: "Base",
    addressType: "evm",
  },
  {
    id: "optimistic-ethereum",
    label: "Optimism",
    addressType: "evm",
  },
  {
    id: "polygon-pos",
    label: "Polygon",
    addressType: "evm",
  },
  {
    id: "binance-smart-chain",
    label: "BNB Smart Chain",
    addressType: "evm",
  },
  {
    id: "avalanche",
    label: "Avalanche",
    addressType: "evm",
  },
  {
    id: "solana",
    label: "Solana",
    addressType: "solana",
  },
];

function isEvmContractAddress(value: string) {
  return /^0x[a-fA-F0-9]{40}$/.test(value);
}

function isLikelySolanaAddress(value: string) {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value);
}

async function fetchContractCoin(
  platform: ContractPlatform,
  contractAddress: string
) {
  const response = await fetch(
    `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(
      platform.id
    )}/contract/${encodeURIComponent(contractAddress)}`,
    {
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
    }
  );

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    return null;
  }

  const coin = (await response.json()) as CoinGeckoContractCoin;

  if (!coin?.id) {
    return null;
  }

  return coin;
}

async function resolveByContractAddress(query: string) {
  const addressType = isEvmContractAddress(query)
    ? "evm"
    : isLikelySolanaAddress(query)
    ? "solana"
    : null;

  if (!addressType) {
    return null;
  }

  const platforms = CONTRACT_PLATFORMS.filter(
    (platform) => platform.addressType === addressType
  );

  for (const platform of platforms) {
    const coin = await fetchContractCoin(platform, query);

    if (!coin) {
      continue;
    }

    return {
      coin,
      platform,
    };
  }

  return null;
}

async function fetchMarketData(coinId: string) {
  const marketResponse = await fetch(
    `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${encodeURIComponent(
      coinId
    )}&price_change_percentage=24h`,
    {
      headers: {
        Accept: "application/json",
      },
      next: {
        revalidate: 30,
      },
    }
  );

  if (!marketResponse.ok) {
    return null;
  }

  const marketData: CoinGeckoMarket[] = await marketResponse.json();

  return marketData[0] ?? null;
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

    const searchResponse = await fetch(
      `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(
        query
      )}`,
      {
        headers: {
          Accept: "application/json",
        },
        next: {
          revalidate: 60,
        },
      }
    );

    if (!searchResponse.ok) {
      return NextResponse.json(
        { error: "Market data provider is currently unavailable." },
        { status: 502 }
      );
    }

    const searchData = await searchResponse.json();
    const coins: SearchCoin[] = searchData.coins ?? [];

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
      .sort((a, b) => {
        const rankA = coinRank(a);
        const rankB = coinRank(b);
        return rankA - rankB;
      });

    const rankedCoins = [...coins].sort((a, b) => coinRank(a) - coinRank(b));

    const selectedCoin =
      exactIdMatch ??
      exactNameMatch ??
      exactSymbolMatches[0] ??
      rankedCoins[0] ??
      coins[0];

    const coin = await fetchMarketData(selectedCoin.id);

    if (!coin) {
      return NextResponse.json(
        { error: "No market data is available for this token." },
        { status: 404 }
      );
    }

    const inputType =
      exactSymbolMatches[0]?.id === selectedCoin.id
        ? "symbol"
        : exactNameMatch?.id === selectedCoin.id
        ? "name"
        : exactIdMatch?.id === selectedCoin.id
        ? "id"
        : "search";

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

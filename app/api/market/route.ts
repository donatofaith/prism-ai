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

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get("q")?.trim();

    if (!query) {
      return NextResponse.json(
        { error: "A token symbol or name is required." },
        { status: 400 }
      );
    }

    const normalizedQuery = query.toLowerCase();

    // Search CoinGecko
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

    /*
      Matching priority:

      1. Exact CoinGecko ID
         bitcoin -> bitcoin

      2. Exact token name
         Bitcoin -> Bitcoin

      3. Exact symbol
         BTC -> BTC

      4. Highest-ranked result
    */

    const exactIdMatch = coins.find(
      (coin) => coin.id.toLowerCase() === normalizedQuery
    );

    const exactNameMatch = coins.find(
      (coin) => coin.name.toLowerCase() === normalizedQuery
    );

    const exactSymbolMatches = coins
      .filter((coin) => coin.symbol.toLowerCase() === normalizedQuery)
      .sort((a, b) => {
        const rankA = a.market_cap_rank ?? Number.MAX_SAFE_INTEGER;
        const rankB = b.market_cap_rank ?? Number.MAX_SAFE_INTEGER;

        return rankA - rankB;
      });

    const rankedCoins = [...coins].sort((a, b) => {
      const rankA = a.market_cap_rank ?? Number.MAX_SAFE_INTEGER;
      const rankB = b.market_cap_rank ?? Number.MAX_SAFE_INTEGER;

      return rankA - rankB;
    });

    const selectedCoin =
      exactIdMatch ??
      exactNameMatch ??
      exactSymbolMatches[0] ??
      rankedCoins[0] ??
      coins[0];

    const marketResponse = await fetch(
      `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${encodeURIComponent(
        selectedCoin.id
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
      return NextResponse.json(
        { error: "Unable to retrieve live market information." },
        { status: 502 }
      );
    }

    const marketData: CoinGeckoMarket[] = await marketResponse.json();

    if (!marketData.length) {
      return NextResponse.json(
        { error: "No market data is available for this token." },
        { status: 404 }
      );
    }

    const coin = marketData[0];

    return NextResponse.json({
      id: coin.id,
      name: coin.name,
      symbol: coin.symbol.toUpperCase(),
      image: coin.image,
      price: coin.current_price,
      marketCap: coin.market_cap,
      volume24h: coin.total_volume,
      change24h: coin.price_change_percentage_24h ?? 0,
    });
  } catch (error) {
    console.error("PRISM market API error:", error);

    return NextResponse.json(
      { error: "Something went wrong while retrieving market data." },
      { status: 500 }
    );
  }
}
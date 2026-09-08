import { NextRequest, NextResponse } from "next/server";

type CoinGeckoHistoryPoint = [number, number];

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    const coinId = searchParams.get("id")?.trim();
    const days = searchParams.get("days")?.trim() || "7";

    if (!coinId) {
      return NextResponse.json(
        { error: "A CoinGecko token id is required." },
        { status: 400 }
      );
    }

    const allowedDays = ["1", "7", "30", "90"];

    if (!allowedDays.includes(days)) {
      return NextResponse.json(
        { error: "Unsupported history range." },
        { status: 400 }
      );
    }

    const response = await fetch(
      `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(
        coinId
      )}/market_chart?vs_currency=usd&days=${days}`,
      {
        headers: {
          Accept: "application/json",
        },
        cache: "no-store",
      }
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: "Unable to retrieve historical market data." },
        { status: 502 }
      );
    }

    const data = await response.json();

    const prices: CoinGeckoHistoryPoint[] = data.prices ?? [];

    if (!prices.length) {
      return NextResponse.json(
        { error: "No historical price data is available." },
        { status: 404 }
      );
    }

    const formattedPrices = prices.map(([timestamp, price]) => ({
      timestamp,
      price,
    }));

    const firstPrice = formattedPrices[0]?.price ?? 0;
    const lastPrice =
      formattedPrices[formattedPrices.length - 1]?.price ?? 0;

    const rangeChange =
      firstPrice > 0
        ? ((lastPrice - firstPrice) / firstPrice) * 100
        : 0;

    return NextResponse.json({
      coinId,
      days: Number(days),
      prices: formattedPrices,
      rangeChange,
    });
  } catch (error) {
    console.error("PRISM history API error:", error);

    return NextResponse.json(
      { error: "Something went wrong while retrieving price history." },
      { status: 500 }
    );
  }
}
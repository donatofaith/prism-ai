import { NextRequest, NextResponse } from "next/server";

type CoinGeckoMarketChartResponse = {
  prices?: [number, number][];
};

type PricePoint = {
  timestamp: number;
  price: number;
};

type HistoricalMatch = {
  startTimestamp: number;
  endTimestamp: number;

  startDate: string;
  endDate: string;

  startPrice: number;
  endPrice: number;

  periodReturn: number;

  similarityDifference: number;

  forwardReturn: number | null;

  forwardEndDate: string | null;

  forwardEndPrice: number | null;
};

function percentageChange(
  start: number,
  end: number
) {
  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    start === 0
  ) {
    return 0;
  }

  return (
    ((end - start) /
      start) *
    100
  );
}

function formatDate(
  timestamp: number
) {
  return new Date(
    timestamp
  ).toISOString().slice(
    0,
    10
  );
}

function average(
  values: number[]
) {
  if (
    values.length ===
    0
  ) {
    return 0;
  }

  return (
    values.reduce(
      (
        total,
        value
      ) =>
        total +
        value,
      0
    ) /
    values.length
  );
}

function median(
  values: number[]
) {
  if (
    values.length ===
    0
  ) {
    return 0;
  }

  const sorted = [
    ...values,
  ].sort(
    (
      a,
      b
    ) =>
      a -
      b
  );

  const middle =
    Math.floor(
      sorted.length /
        2
    );

  if (
    sorted.length %
      2 ===
    0
  ) {
    return (
      (
        sorted[
          middle -
            1
        ] +
        sorted[
          middle
        ]
      ) /
      2
    );
  }

  return sorted[
    middle
  ];
}

function getDailyPrices(
  prices: [
    number,
    number
  ][]
): PricePoint[] {
  const dailyMap =
    new Map<
      string,
      PricePoint
    >();

  for (
    const [
      timestamp,
      price,
    ] of prices
  ) {
    if (
      !Number.isFinite(
        timestamp
      ) ||
      !Number.isFinite(
        price
      )
    ) {
      continue;
    }

    const day =
      formatDate(
        timestamp
      );

    /*
      CoinGecko may return more than one
      point per day depending on the
      requested range.

      Keep the latest point for each day.
    */
    dailyMap.set(
      day,
      {
        timestamp,
        price,
      }
    );
  }

  return Array.from(
    dailyMap.values()
  ).sort(
    (
      a,
      b
    ) =>
      a.timestamp -
      b.timestamp
  );
}

function buildMatches(
  prices: PricePoint[],
  currentReturn: number,
  lookbackDays: number,
  forwardDays: number,
  maxMatches: number
) {
  const matches:
    HistoricalMatch[] =
      [];

  /*
    We leave the newest period out of the
    historical comparison because that is
    the current pattern itself.
  */
  const latestIndex =
    prices.length -
    1;

  const currentWindowStart =
    latestIndex -
    lookbackDays;

  for (
    let endIndex =
      lookbackDays;
    endIndex <
    currentWindowStart;
    endIndex++
  ) {
    const startIndex =
      endIndex -
      lookbackDays;

    const start =
      prices[
        startIndex
      ];

    const end =
      prices[
        endIndex
      ];

    if (
      !start ||
      !end
    ) {
      continue;
    }

    const periodReturn =
      percentageChange(
        start.price,
        end.price
      );

    const similarityDifference =
      Math.abs(
        periodReturn -
          currentReturn
      );

    const forwardIndex =
      endIndex +
      forwardDays;

    const forwardPoint =
      prices[
        forwardIndex
      ];

    let forwardReturn:
      number | null =
      null;

    let forwardEndDate:
      string | null =
      null;

    let forwardEndPrice:
      number | null =
      null;

    if (
      forwardPoint
    ) {
      forwardReturn =
        percentageChange(
          end.price,
          forwardPoint.price
        );

      forwardEndDate =
        formatDate(
          forwardPoint.timestamp
        );

      forwardEndPrice =
        forwardPoint.price;
    }

    matches.push({
      startTimestamp:
        start.timestamp,

      endTimestamp:
        end.timestamp,

      startDate:
        formatDate(
          start.timestamp
        ),

      endDate:
        formatDate(
          end.timestamp
        ),

      startPrice:
        start.price,

      endPrice:
        end.price,

      periodReturn,

      similarityDifference,

      forwardReturn,

      forwardEndDate,

      forwardEndPrice,
    });
  }

  return matches
    .sort(
      (
        a,
        b
      ) =>
        a.similarityDifference -
        b.similarityDifference
    )
    .slice(
      0,
      maxMatches
    );
}

export async function GET(
  request: NextRequest
) {
  try {
    const coinId =
      request.nextUrl.searchParams
        .get("id")
        ?.trim();

    const lookbackParam =
      request.nextUrl.searchParams
        .get(
          "lookback"
        );

    const forwardParam =
      request.nextUrl.searchParams
        .get(
          "forward"
        );

    const lookbackDays =
      Math.min(
        Math.max(
          Number(
            lookbackParam ??
              7
          ),
          1
        ),
        30
      );

    const forwardDays =
      Math.min(
        Math.max(
          Number(
            forwardParam ??
              7
          ),
          1
        ),
        30
      );

    if (
      !coinId
    ) {
      return NextResponse.json(
        {
          error:
            "A CoinGecko coin id is required.",
        },
        {
          status:
            400,
        }
      );
    }

    const response =
      await fetch(
        `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(
          coinId
        )}/market_chart?vs_currency=usd&days=365`,
        {
          headers: {
            accept:
              "application/json",
          },

          cache:
            "no-store",
        }
      );

    if (
      !response.ok
    ) {
      const text =
        await response.text();

      console.error(
        "CoinGecko Replay response:",
        text
      );

      return NextResponse.json(
        {
          error:
            "Unable to retrieve enough historical data for Replay.",
        },
        {
          status:
            response.status
        }
      );
    }

    const raw =
      (await response.json()) as CoinGeckoMarketChartResponse;

    const dailyPrices =
      getDailyPrices(
        raw.prices ??
          []
      );

    if (
      dailyPrices.length <
      lookbackDays +
        forwardDays +
        20
    ) {
      return NextResponse.json(
        {
          error:
            "Not enough historical data is available for this token yet.",
        },
        {
          status:
            400,
        }
      );
    }

    const latestIndex =
      dailyPrices.length -
      1;

    const currentStartIndex =
      latestIndex -
      lookbackDays;

    const currentStart =
      dailyPrices[
        currentStartIndex
      ];

    const currentEnd =
      dailyPrices[
        latestIndex
      ];

    if (
      !currentStart ||
      !currentEnd
    ) {
      return NextResponse.json(
        {
          error:
            "Unable to calculate the current Replay pattern.",
        },
        {
          status:
            500,
        }
      );
    }

    const currentReturn =
      percentageChange(
        currentStart.price,
        currentEnd.price
      );

    const matches =
      buildMatches(
        dailyPrices,
        currentReturn,
        lookbackDays,
        forwardDays,
        5
      );

    const completedMatches =
      matches.filter(
        (
          match
        ): match is HistoricalMatch & {
          forwardReturn: number;
        } =>
          match.forwardReturn !==
          null
      );

    const forwardReturns =
      completedMatches.map(
        (match) =>
          match.forwardReturn
      );

    const positiveAfter =
      completedMatches.filter(
        (match) =>
          match.forwardReturn >
          0
      ).length;

    const negativeAfter =
      completedMatches.filter(
        (match) =>
          match.forwardReturn <
          0
      ).length;

    const flatAfter =
      completedMatches.filter(
        (match) =>
          match.forwardReturn ===
          0
      ).length;

    const averageForwardReturn =
      average(
        forwardReturns
      );

    const medianForwardReturn =
      median(
        forwardReturns
      );

    let headline =
      "Historical analogues were mixed.";

    if (
      completedMatches.length >
      0
    ) {
      if (
        positiveAfter >
        negativeAfter
      ) {
        headline =
          `Most similar historical periods were followed by higher prices over the next ${forwardDays} days.`;
      } else if (
        negativeAfter >
        positiveAfter
      ) {
        headline =
          `Most similar historical periods were followed by lower prices over the next ${forwardDays} days.`;
      } else {
        headline =
          "Similar historical periods produced mixed forward outcomes.";
      }
    }

    return NextResponse.json({
      coinId,

      model:
        "historical-pattern-replay",

      currentPattern: {
        lookbackDays,

        startDate:
          formatDate(
            currentStart.timestamp
          ),

        endDate:
          formatDate(
            currentEnd.timestamp
          ),

        startPrice:
          currentStart.price,

        endPrice:
          currentEnd.price,

        return:
          currentReturn,
      },

      forwardWindowDays:
        forwardDays,

      matchCount:
        completedMatches.length,

      summary: {
        headline,

        positiveAfter,

        negativeAfter,

        flatAfter,

        averageForwardReturn,

        medianForwardReturn,
      },

      matches,

      interpretationPolicy:
        "Replay compares the current price pattern with similar historical periods. Historical similarity is descriptive evidence, not a forecast, trading signal, or guarantee of future price behavior.",

      methodology:
        `PRISM compared the current ${lookbackDays}-day USD price return against previous ${lookbackDays}-day windows from approximately one year of historical data, ranked the closest matches, and measured what happened during the following ${forwardDays} days.`,
    });
  } catch (
    error
  ) {
    console.error(
      "PRISM Replay error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "PRISM Replay could not analyze historical patterns.",
      },
      {
        status:
          500,
      }
    );
  }
}
import { NextRequest, NextResponse } from "next/server";
import { GET as getWalletData } from "../wallet/route";

type SupportedChain =
  | "ethereum"
  | "arbitrum"
  | "base"
  | "optimism"
  | "polygon"
  | "bnb"
  | "avalanche";

const PRICE_CONFIG: Record<
  SupportedChain,
  {
    coingeckoPlatform: string;
    nativeCoinId: string;
    dexScreenerChain: string;
  }
> = {
  ethereum: {
    coingeckoPlatform: "ethereum",
    nativeCoinId: "ethereum",
    dexScreenerChain: "ethereum",
  },
  arbitrum: {
    coingeckoPlatform: "arbitrum-one",
    nativeCoinId: "ethereum",
    dexScreenerChain: "arbitrum",
  },
  base: {
    coingeckoPlatform: "base",
    nativeCoinId: "ethereum",
    dexScreenerChain: "base",
  },
  optimism: {
    coingeckoPlatform: "optimistic-ethereum",
    nativeCoinId: "ethereum",
    dexScreenerChain: "optimism",
  },
  polygon: {
    coingeckoPlatform: "polygon-pos",
    nativeCoinId: "polygon-ecosystem-token",
    dexScreenerChain: "polygon",
  },
  bnb: {
    coingeckoPlatform: "binance-smart-chain",
    nativeCoinId: "binancecoin",
    dexScreenerChain: "bsc",
  },
  avalanche: {
    coingeckoPlatform: "avalanche",
    nativeCoinId: "avalanche-2",
    dexScreenerChain: "avalanche",
  },
};

function normalizeAddress(value?: string | null) {
  return value?.trim().toLowerCase() ?? "";
}

function formatUsd(value: number) {
  return `$${value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

async function getContractPrices(chain: SupportedChain, contracts: string[]) {
  const config = PRICE_CONFIG[chain];
  const prices = new Map<string, number>();
  const unique = Array.from(
    new Set(contracts.map(normalizeAddress).filter(Boolean))
  );

  if (!unique.length) return prices;

  try {
    const url = `https://api.coingecko.com/api/v3/simple/token_price/${encodeURIComponent(
      config.coingeckoPlatform
    )}?contract_addresses=${encodeURIComponent(
      unique.join(",")
    )}&vs_currencies=usd`;

    const response = await fetch(url, {
      cache: "no-store",
      headers: { accept: "application/json" },
    });

    if (response.ok) {
      const data = await response.json();
      for (const contract of unique) {
        const price = Number(data?.[contract]?.usd);
        if (Number.isFinite(price) && price > 0) prices.set(contract, price);
      }
    }
  } catch {
    // Price enrichment is best-effort and must never break Account Intelligence.
  }

  const missing = unique.filter((contract) => !prices.has(contract));

  if (missing.length) {
    try {
      const response = await fetch(
        `https://api.dexscreener.com/latest/dex/tokens/${missing.join(",")}`,
        { cache: "no-store", headers: { accept: "application/json" } }
      );

      if (response.ok) {
        const data = await response.json();
        const pairs = Array.isArray(data?.pairs) ? data.pairs : [];

        for (const contract of missing) {
          const candidates = pairs
            .filter(
              (pair: any) =>
                pair?.chainId === config.dexScreenerChain &&
                normalizeAddress(pair?.baseToken?.address) === contract &&
                Number(pair?.priceUsd) > 0
            )
            .sort(
              (a: any, b: any) =>
                Number(b?.liquidity?.usd ?? 0) -
                Number(a?.liquidity?.usd ?? 0)
            );

          const price = Number(candidates[0]?.priceUsd);
          if (Number.isFinite(price) && price > 0) prices.set(contract, price);
        }
      }
    } catch {
      // No quote available; keep the transfer without a USD estimate.
    }
  }

  return prices;
}

async function getNativePrice(chain: SupportedChain) {
  const config = PRICE_CONFIG[chain];
  try {
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(
        config.nativeCoinId
      )}&vs_currencies=usd`,
      { cache: "no-store", headers: { accept: "application/json" } }
    );

    if (!response.ok) return null;
    const data = await response.json();
    const price = Number(data?.[config.nativeCoinId]?.usd);
    return Number.isFinite(price) && price > 0 ? price : null;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const original = await getWalletData(request);

  if (!original.ok) return original;

  const data = await original.json();
  const chain = data?.chain as SupportedChain | undefined;

  if (!chain || !PRICE_CONFIG[chain] || !Array.isArray(data?.activity)) {
    return NextResponse.json(data, { status: original.status });
  }

  const contracts = data.activity
    .map((item: any) => item?.tokenContract)
    .filter(Boolean) as string[];

  const hasNative = data.activity.some(
    (item: any) => item?.category === "external"
  );

  const [contractPrices, nativePrice] = await Promise.all([
    getContractPrices(chain, contracts),
    hasNative ? getNativePrice(chain) : Promise.resolve(null),
  ]);

  const activity = data.activity.map((item: any) => {
    const amount = typeof item?.value === "number" ? item.value : null;
    const contract = normalizeAddress(item?.tokenContract);
    const price =
      item?.category === "external"
        ? nativePrice
        : contract
        ? contractPrices.get(contract) ?? null
        : null;
    const usdValue =
      amount !== null && price !== null && Number.isFinite(amount * price)
        ? amount * price
        : null;

    if (usdValue === null) {
      return {
        ...item,
        usdPrice: price,
        usdValue: null,
        usdValueBasis: null,
      };
    }

    const valueText = formatUsd(usdValue);
    const note =
      typeof item?.note === "string" && item.note.length
        ? `${item.note} Estimated current value: ≈ ${valueText}.`
        : `Estimated current value: ≈ ${valueText}.`;

    return {
      ...item,
      usdPrice: price,
      usdValue,
      usdValueBasis: "current_market_price",
      note,
    };
  });

  return NextResponse.json({
    ...data,
    activity,
    pricing: {
      basis: "current_market_price",
      note:
        "USD values are estimates using the latest available market quote. They are not transaction-time valuations.",
    },
  });
}

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

type PriceConfig = {
  coingeckoPlatform: string;
  nativeCoinId: string;
  dexScreenerChain: string;
  explorerBase: string;
  publicRpcs: string[];
};

const PRICE_CONFIG: Record<SupportedChain, PriceConfig> = {
  ethereum: {
    coingeckoPlatform: "ethereum",
    nativeCoinId: "ethereum",
    dexScreenerChain: "ethereum",
    explorerBase: "https://etherscan.io",
    publicRpcs: ["https://ethereum-rpc.publicnode.com", "https://rpc.ankr.com/eth"],
  },
  arbitrum: {
    coingeckoPlatform: "arbitrum-one",
    nativeCoinId: "ethereum",
    dexScreenerChain: "arbitrum",
    explorerBase: "https://arbiscan.io",
    publicRpcs: ["https://arb1.arbitrum.io/rpc", "https://arbitrum-one-rpc.publicnode.com"],
  },
  base: {
    coingeckoPlatform: "base",
    nativeCoinId: "ethereum",
    dexScreenerChain: "base",
    explorerBase: "https://basescan.org",
    publicRpcs: ["https://base-rpc.publicnode.com", "https://mainnet.base.org"],
  },
  optimism: {
    coingeckoPlatform: "optimistic-ethereum",
    nativeCoinId: "ethereum",
    dexScreenerChain: "optimism",
    explorerBase: "https://optimistic.etherscan.io",
    publicRpcs: ["https://optimism-rpc.publicnode.com", "https://mainnet.optimism.io"],
  },
  polygon: {
    coingeckoPlatform: "polygon-pos",
    nativeCoinId: "polygon-ecosystem-token",
    dexScreenerChain: "polygon",
    explorerBase: "https://polygonscan.com",
    publicRpcs: ["https://polygon-bor-rpc.publicnode.com", "https://polygon-rpc.com"],
  },
  bnb: {
    coingeckoPlatform: "binance-smart-chain",
    nativeCoinId: "binancecoin",
    dexScreenerChain: "bsc",
    explorerBase: "https://bscscan.com",
    publicRpcs: ["https://bsc-rpc.publicnode.com", "https://bsc-dataseed.binance.org"],
  },
  avalanche: {
    coingeckoPlatform: "avalanche",
    nativeCoinId: "avalanche-2",
    dexScreenerChain: "avalanche",
    explorerBase: "https://snowtrace.io",
    publicRpcs: ["https://avalanche-c-chain-rpc.publicnode.com", "https://api.avax.network/ext/bc/C/rpc"],
  },
};

const TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

function normalizeAddress(value?: string | null) {
  return value?.trim().toLowerCase() ?? "";
}

function short(address?: string | null) {
  return address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "Unknown";
}

function fromTopic(topic?: string) {
  if (!topic || topic.length < 42) return "";
  return `0x${topic.slice(-40)}`;
}

function hexToNumber(hex?: string | null) {
  if (!hex) return 0;
  try {
    return Number(BigInt(hex));
  } catch {
    return 0;
  }
}

function decodeAmount(rawHex: string | null, decimals: number) {
  if (!rawHex || decimals < 0 || decimals > 36) return null;
  try {
    const raw = BigInt(rawHex);
    const base = 10n ** BigInt(decimals);
    const whole = raw / base;
    const fraction = raw % base;
    const fractionText = fraction
      .toString()
      .padStart(decimals, "0")
      .replace(/0+$/, "")
      .slice(0, 8);
    const value = Number(
      fractionText ? `${whole.toString()}.${fractionText}` : whole.toString()
    );
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

function decodeAbiString(hex?: string | null) {
  if (!hex || hex === "0x") return null;
  const raw = hex.replace(/^0x/, "");
  try {
    if (raw.length === 64) {
      return Buffer.from(raw, "hex").toString("utf8").replace(/\0+$/g, "").trim() || null;
    }
    if (raw.length >= 128) {
      const offset = parseInt(raw.slice(0, 64), 16) * 2;
      const length = parseInt(raw.slice(offset, offset + 64), 16);
      const value = raw.slice(offset + 64, offset + 64 + length * 2);
      return Buffer.from(value, "hex").toString("utf8").replace(/\0+$/g, "").trim() || null;
    }
  } catch {
    return null;
  }
  return null;
}

function formatUsd(value: number) {
  return `$${value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

async function rpc(chain: SupportedChain, method: string, params: unknown[]) {
  const config = PRICE_CONFIG[chain];
  const override = process.env[`PRISM_${chain.toUpperCase()}_RPC_URL`];
  const candidates = [override, ...config.publicRpcs].filter(Boolean) as string[];
  let lastError = `${method} failed.`;

  for (const url of candidates) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
        cache: "no-store",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.error) {
        lastError = data?.error?.message || lastError;
        continue;
      }
      return data.result;
    } catch (error) {
      lastError = error instanceof Error ? error.message : lastError;
    }
  }
  throw new Error(lastError);
}

async function detectErc20(chain: SupportedChain, address: string) {
  try {
    const [code, decimalsHex, symbolHex, nameHex] = await Promise.all([
      rpc(chain, "eth_getCode", [address, "latest"]),
      rpc(chain, "eth_call", [{ to: address, data: "0x313ce567" }, "latest"]),
      rpc(chain, "eth_call", [{ to: address, data: "0x95d89b41" }, "latest"]).catch(() => null),
      rpc(chain, "eth_call", [{ to: address, data: "0x06fdde03" }, "latest"]).catch(() => null),
    ]);
    const decimals = hexToNumber(decimalsHex);
    if (!code || code === "0x" || decimals < 0 || decimals > 36) return null;
    return {
      decimals,
      symbol: decodeAbiString(symbolHex)?.toUpperCase() || "TOKEN",
      name: decodeAbiString(nameHex) || null,
    };
  } catch {
    return null;
  }
}

async function recentContractActivity(
  chain: SupportedChain,
  address: string,
  token: { decimals: number; symbol: string; name: string | null }
) {
  const latest = hexToNumber(await rpc(chain, "eth_blockNumber", []));
  const logs: any[] = [];
  const chunk = 3000;
  let cursor = latest;
  let scanned = 0;

  while (cursor >= 0 && scanned < 120000 && logs.length < 12) {
    const from = Math.max(0, cursor - chunk + 1);
    try {
      const result = await rpc(chain, "eth_getLogs", [
        {
          address,
          topics: [TRANSFER_TOPIC],
          fromBlock: `0x${from.toString(16)}`,
          toBlock: `0x${cursor.toString(16)}`,
        },
      ]);
      if (Array.isArray(result) && result.length) logs.push(...result);
    } catch {
      break;
    }
    scanned += cursor - from + 1;
    cursor = from - 1;
  }

  if (!logs.length) return [];
  logs.sort((a, b) => hexToNumber(b.blockNumber) - hexToNumber(a.blockNumber));
  const selected = logs.slice(0, 12);
  const timestampCache = new Map<string, string | null>();

  for (const log of selected) {
    if (!log.blockNumber || timestampCache.has(log.blockNumber)) continue;
    try {
      const block = await rpc(chain, "eth_getBlockByNumber", [log.blockNumber, false]);
      const seconds = hexToNumber(block?.timestamp);
      timestampCache.set(
        log.blockNumber,
        seconds ? new Date(seconds * 1000).toISOString() : null
      );
    } catch {
      timestampCache.set(log.blockNumber, null);
    }
  }

  const config = PRICE_CONFIG[chain];
  return selected.map((log: any) => {
    const from = fromTopic(log.topics?.[1]);
    const to = fromTopic(log.topics?.[2]);
    const value = decodeAmount(typeof log.data === "string" ? log.data : null, token.decimals);
    const blockNumber = hexToNumber(log.blockNumber);
    const note = `${
      value === null
        ? "An unknown amount of"
        : value.toLocaleString("en-US", { maximumFractionDigits: 8 })
    } ${token.symbol} transferred from ${short(from)} to ${short(to)} in block ${blockNumber.toLocaleString("en-US")}.`;

    return {
      hash: log.transactionHash ?? null,
      blockNumber,
      timestamp: timestampCache.get(log.blockNumber) ?? null,
      direction: "contract",
      asset: token.symbol,
      assetName: token.name,
      value,
      category: "erc20",
      tokenContract: address,
      verification: "unverified",
      verificationReason:
        "PRISM detected ERC-20-compatible contract behaviour on the selected network. Token identity is not treated as verified unless an exact contract/source record exists in the attribution registry.",
      tokenLogo: null,
      from,
      to,
      counterparty: to || from,
      counterpartyShort: short(to || from),
      attribution: {
        address: to || from,
        label: "Unknown counterparty",
        entity: null,
        entityType: "unknown",
        confidence: "unknown",
        source: null,
        sourceUrl: null,
        explanation: "PRISM has no reliable public attribution for this counterparty.",
      },
      movementContext: "unknown",
      explorerUrl: log.transactionHash
        ? `${config.explorerBase}/tx/${log.transactionHash}`
        : null,
      importance: "low",
      type: "token_transfer",
      note,
      contextExplanation:
        "This is an emitted token Transfer event. It does not by itself prove buying, selling, project ownership or intent.",
    };
  });
}

async function getContractPrices(chain: SupportedChain, contracts: string[]) {
  const config = PRICE_CONFIG[chain];
  const prices = new Map<string, number>();
  const unique = Array.from(new Set(contracts.map(normalizeAddress).filter(Boolean)));
  if (!unique.length) return prices;

  try {
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/token_price/${encodeURIComponent(
        config.coingeckoPlatform
      )}?contract_addresses=${encodeURIComponent(unique.join(","))}&vs_currencies=usd`,
      { cache: "no-store", headers: { accept: "application/json" } }
    );
    if (response.ok) {
      const data = await response.json();
      for (const contract of unique) {
        const price = Number(data?.[contract]?.usd);
        if (Number.isFinite(price) && price > 0) prices.set(contract, price);
      }
    }
  } catch {
    // Best effort only.
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
                Number(b?.liquidity?.usd ?? 0) - Number(a?.liquidity?.usd ?? 0)
            );
          const price = Number(candidates[0]?.priceUsd);
          if (Number.isFinite(price) && price > 0) prices.set(contract, price);
        }
      }
    } catch {
      // No quote available.
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

  let data = await original.json();
  const chain = data?.chain as SupportedChain | undefined;
  if (!chain || !PRICE_CONFIG[chain] || !Array.isArray(data?.activity)) {
    return NextResponse.json(data, { status: original.status });
  }

  const address = normalizeAddress(request.nextUrl.searchParams.get("address"));

  // Generic ERC-20 detection closes the gap where an unregistered token contract
  // would otherwise be interpreted like an ordinary wallet and return no useful activity.
  if (address && data?.activityScope !== "token-contract") {
    const detectedToken = await detectErc20(chain, address);
    if (detectedToken) {
      const contractActivity = await recentContractActivity(chain, address, detectedToken);
      if (contractActivity.length) {
        data = {
          ...data,
          activityScope: "token-contract",
          activity: contractActivity,
          assets: [detectedToken.symbol],
          scannedWallet: {
            ...(data.scannedWallet ?? {}),
            headline: `${detectedToken.name || detectedToken.symbol} token contract detected on ${data.chainName}`,
            explanation:
              "PRISM detected ERC-20-compatible token behaviour and switched from wallet mode to emitted Transfer-event analysis. Identity remains unverified unless the exact contract is backed by a registry/source record.",
          },
          summary: {
            ...(data.summary ?? {}),
            totalTransfers: contractActivity.length,
            incomingTransfers: 0,
            outgoingTransfers: 0,
            verifiedTransfers: 0,
            unverifiedTransfers: contractActivity.length,
            attributedTransfers: 0,
            exchangeInteractions: 0,
            exchangeInflows: 0,
            exchangeOutflows: 0,
            projectInteractions: 0,
          },
          intelligence: {
            ...(data.intelligence ?? {}),
            status: "normal",
            headline: `${contractActivity.length} recent token Transfer event${
              contractActivity.length === 1 ? "" : "s"
            } available for review`,
            explanation:
              "PRISM automatically detected that this address behaves like an ERC-20 token contract and decoded recent emitted Transfer events instead of treating it as a wallet.",
          },
        };
      }
    }
  }

  const contracts = data.activity
    .map((item: any) => item?.tokenContract)
    .filter(Boolean) as string[];
  const hasNative = data.activity.some((item: any) => item?.category === "external");
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
      return { ...item, usdPrice: price, usdValue: null, usdValueBasis: null };
    }

    const valueText = formatUsd(usdValue);
    return {
      ...item,
      usdPrice: price,
      usdValue,
      usdValueBasis: "current_market_price",
      note:
        typeof item?.note === "string" && item.note.length
          ? `${item.note} Estimated current value: ≈ ${valueText}.`
          : `Estimated current value: ≈ ${valueText}.`,
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

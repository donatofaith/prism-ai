import { NextRequest, NextResponse } from "next/server";

import {
  getWalletAttribution,
  type WalletAttribution,
} from "@/lib/wallet-attribution";

type EvmWalletChain =
  | "ethereum"
  | "arbitrum"
  | "base"
  | "optimism"
  | "polygon"
  | "bnb"
  | "avalanche";

type Direction = "incoming" | "outgoing" | "contract";
type VerificationStatus = "native" | "verified" | "unverified";
type Importance = "high" | "medium" | "low";
type MovementContext =
  | "exchange_inflow"
  | "exchange_outflow"
  | "project_transfer"
  | "treasury_transfer"
  | "team_transfer"
  | "investor_transfer"
  | "unknown";

type ChainConfig = {
  name: string;
  alchemyBase: string;
  publicRpcs: string[];
  explorerBase: string;
  nativeSymbol: string;
  nativeName: string;
};

type VerifiedToken = {
  symbol: string;
  name: string;
  decimals: number;
};

type RawTransfer = {
  hash: string | null;
  blockNumber: string | null;
  timestamp: string | null;
  direction: Direction;
  tokenContract: string | null;
  value: number | null;
  rawValueHex: string | null;
  asset: string | null;
  category: "external" | "erc20";
  from: string;
  to: string;
};

type TokenMeta = {
  name: string | null;
  symbol: string;
  decimals: number | null;
};

const EVM_WALLET_CHAINS: EvmWalletChain[] = [
  "ethereum",
  "arbitrum",
  "base",
  "optimism",
  "polygon",
  "bnb",
  "avalanche",
];

const CHAIN_CONFIG: Record<EvmWalletChain, ChainConfig> = {
  ethereum: {
    name: "Ethereum Mainnet",
    alchemyBase: "https://eth-mainnet.g.alchemy.com/v2",
    publicRpcs: [
      "https://ethereum-rpc.publicnode.com",
      "https://rpc.ankr.com/eth",
    ],
    explorerBase: "https://etherscan.io",
    nativeSymbol: "ETH",
    nativeName: "Ether",
  },
  arbitrum: {
    name: "Arbitrum One",
    alchemyBase: "https://arb-mainnet.g.alchemy.com/v2",
    publicRpcs: [
      "https://arb1.arbitrum.io/rpc",
      "https://arbitrum-one-rpc.publicnode.com",
    ],
    explorerBase: "https://arbiscan.io",
    nativeSymbol: "ETH",
    nativeName: "Ether",
  },
  base: {
    name: "Base Mainnet",
    alchemyBase: "https://base-mainnet.g.alchemy.com/v2",
    publicRpcs: [
      "https://base-rpc.publicnode.com",
      "https://mainnet.base.org",
    ],
    explorerBase: "https://basescan.org",
    nativeSymbol: "ETH",
    nativeName: "Ether",
  },
  optimism: {
    name: "OP Mainnet",
    alchemyBase: "https://opt-mainnet.g.alchemy.com/v2",
    publicRpcs: [
      "https://optimism-rpc.publicnode.com",
      "https://mainnet.optimism.io",
    ],
    explorerBase: "https://optimistic.etherscan.io",
    nativeSymbol: "ETH",
    nativeName: "Ether",
  },
  polygon: {
    name: "Polygon PoS",
    alchemyBase: "https://polygon-mainnet.g.alchemy.com/v2",
    publicRpcs: [
      "https://polygon-bor-rpc.publicnode.com",
      "https://polygon-rpc.com",
    ],
    explorerBase: "https://polygonscan.com",
    nativeSymbol: "POL",
    nativeName: "POL",
  },
  bnb: {
    name: "BNB Smart Chain",
    alchemyBase: "https://bnb-mainnet.g.alchemy.com/v2",
    publicRpcs: [
      "https://bsc-rpc.publicnode.com",
      "https://bsc-dataseed.binance.org",
    ],
    explorerBase: "https://bscscan.com",
    nativeSymbol: "BNB",
    nativeName: "BNB",
  },
  avalanche: {
    name: "Avalanche C-Chain",
    alchemyBase: "https://avax-mainnet.g.alchemy.com/v2",
    publicRpcs: [
      "https://avalanche-c-chain-rpc.publicnode.com",
      "https://api.avax.network/ext/bc/C/rpc",
    ],
    explorerBase: "https://snowtrace.io",
    nativeSymbol: "AVAX",
    nativeName: "Avalanche",
  },
};

const VERIFIED_TOKENS: Record<
  EvmWalletChain,
  Record<string, VerifiedToken>
> = {
  ethereum: {
    "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48": {
      symbol: "USDC",
      name: "USD Coin",
      decimals: 6,
    },
    "0xdac17f958d2ee523a2206206994597c13d831ec7": {
      symbol: "USDT",
      name: "Tether USD",
      decimals: 6,
    },
    "0x6b175474e89094c44da98b954eedeac495271d0f": {
      symbol: "DAI",
      name: "Dai Stablecoin",
      decimals: 18,
    },
    "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2": {
      symbol: "WETH",
      name: "Wrapped Ether",
      decimals: 18,
    },
    "0x514910771af9ca656af840dff83e8264ecf986ca": {
      symbol: "LINK",
      name: "Chainlink",
      decimals: 18,
    },
    "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984": {
      symbol: "UNI",
      name: "Uniswap",
      decimals: 18,
    },
    "0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9": {
      symbol: "AAVE",
      name: "Aave",
      decimals: 18,
    },
    "0xc18360217d8f7ab5e7c516566761ea12ce7f9d72": {
      symbol: "ENS",
      name: "Ethereum Name Service",
      decimals: 18,
    },
  },
  arbitrum: {
    "0x912ce59144191c1204e64559fe8253a0e49e6548": {
      symbol: "ARB",
      name: "Arbitrum",
      decimals: 18,
    },
    "0xaf88d065e77c8cc2239327c5edb3a432268e5831": {
      symbol: "USDC",
      name: "USD Coin",
      decimals: 6,
    },
    "0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9": {
      symbol: "USDT",
      name: "Tether USD",
      decimals: 6,
    },
  },
  base: {
    "0x19e8d59ff3d7a31289e0dc04db48d43b02c7ffa6": {
      symbol: "CYS",
      name: "Cysic",
      decimals: 18,
    },
  },
  optimism: {
    "0x4200000000000000000000000000000000000042": {
      symbol: "OP",
      name: "Optimism",
      decimals: 18,
    },
  },
  polygon: {},
  bnb: {
    "0x0c69199c1562233640e0db5ce2c399a88eb507c7": {
      symbol: "CYS",
      name: "Cysic",
      decimals: 18,
    },
  },
  avalanche: {},
};

const TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

function normalizeAddress(value?: string | null) {
  return value?.trim().toLowerCase() ?? "";
}

function isAddress(value: string) {
  return /^0x[a-fA-F0-9]{40}$/.test(value);
}

function isChain(value: string): value is EvmWalletChain {
  return EVM_WALLET_CHAINS.includes(value as EvmWalletChain);
}

function short(address?: string | null) {
  return address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "Unknown";
}

function topicAddress(address: string) {
  return `0x${normalizeAddress(address)
    .replace(/^0x/, "")
    .padStart(64, "0")}`;
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

function decodeTokenAmount(rawValueHex: string | null, decimals: number | null) {
  if (!rawValueHex || decimals === null || decimals < 0 || decimals > 36) {
    return null;
  }

  try {
    const raw = BigInt(rawValueHex);
    const base = 10n ** BigInt(decimals);
    const whole = raw / base;
    const fraction = raw % base;
    const fractionText = fraction
      .toString()
      .padStart(decimals, "0")
      .replace(/0+$/, "")
      .slice(0, 8);
    const text = fractionText
      ? `${whole.toString()}.${fractionText}`
      : whole.toString();
    const value = Number(text);
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

function readableAmount(value: number | null) {
  if (value === null) return "An unknown amount of";
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 8,
  }).format(value);
}

async function jsonRpc(
  url: string,
  method: string,
  params: unknown[],
  id = 1
) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
    cache: "no-store",
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || data?.error) {
    throw new Error(data?.error?.message || `${method} failed on RPC provider.`);
  }

  return data.result;
}

function rpcCandidates(chain: EvmWalletChain, preferred?: string | null) {
  const config = CHAIN_CONFIG[chain];
  const override = process.env[`PRISM_${chain.toUpperCase()}_RPC_URL`];
  const apiKey = process.env.ALCHEMY_API_KEY;
  const alchemy = apiKey ? `${config.alchemyBase}/${apiKey}` : null;

  return Array.from(
    new Set(
      [preferred, override, ...config.publicRpcs, alchemy].filter(Boolean) as string[]
    )
  );
}

async function rpcWithFallback(
  chain: EvmWalletChain,
  method: string,
  params: unknown[],
  preferred?: string | null
) {
  let lastError = "No RPC provider responded.";

  for (const url of rpcCandidates(chain, preferred)) {
    try {
      const result = await jsonRpc(url, method, params);
      return { result, url };
    } catch (error) {
      lastError = error instanceof Error ? error.message : lastError;
    }
  }

  throw new Error(lastError);
}

async function firstWorkingRpc(chain: EvmWalletChain) {
  const response = await rpcWithFallback(chain, "eth_blockNumber", []);
  return response.url;
}

async function alchemyTransfers(
  apiKey: string,
  chain: EvmWalletChain,
  wallet: string,
  direction: Exclude<Direction, "contract">
) {
  const config = CHAIN_CONFIG[chain];
  const directionParams =
    direction === "incoming"
      ? { toAddress: wallet }
      : { fromAddress: wallet };

  const result = await jsonRpc(
    `${config.alchemyBase}/${apiKey}`,
    "alchemy_getAssetTransfers",
    [
      {
        fromBlock: "0x0",
        toBlock: "latest",
        order: "desc",
        withMetadata: true,
        excludeZeroValue: true,
        maxCount: "0x32",
        category: ["external", "erc20"],
        ...directionParams,
      },
    ],
    direction === "incoming" ? 11 : 12
  );

  return (result?.transfers ?? []).map(
    (t: any): RawTransfer => ({
      hash: t.hash ?? null,
      blockNumber: t.blockNum ?? null,
      timestamp: t.metadata?.blockTimestamp ?? null,
      direction,
      tokenContract: normalizeAddress(t.rawContract?.address) || null,
      value: typeof t.value === "number" ? t.value : null,
      rawValueHex: null,
      asset: t.asset ?? null,
      category: t.category === "external" ? "external" : "erc20",
      from: t.from ?? "",
      to: t.to ?? "",
    })
  );
}

async function scanRecentLogs(
  chain: EvmWalletChain,
  filter: { address?: string; topics: (string | null)[] },
  maxResults = 20
) {
  const preferred = await firstWorkingRpc(chain);
  const latestResponse = await rpcWithFallback(
    chain,
    "eth_blockNumber",
    [],
    preferred
  );
  const latest = hexToNumber(latestResponse.result);
  const chunkSizes = [5000, 2000, 1000];
  const maxBlocksToInspect = 250000;

  for (const chunkSize of chunkSizes) {
    const collected: any[] = [];
    let cursor = latest;
    let scanned = 0;
    let currentPreferred = latestResponse.url;
    let providerAcceptedRange = false;

    while (
      cursor >= 0 &&
      scanned < maxBlocksToInspect &&
      collected.length < maxResults
    ) {
      const from = Math.max(0, cursor - chunkSize + 1);

      try {
        const response = await rpcWithFallback(
          chain,
          "eth_getLogs",
          [
            {
              fromBlock: `0x${from.toString(16)}`,
              toBlock: `0x${cursor.toString(16)}`,
              ...filter,
            },
          ],
          currentPreferred
        );

        currentPreferred = response.url;
        providerAcceptedRange = true;
        if (Array.isArray(response.result) && response.result.length) {
          collected.push(...response.result);
        }
        scanned += cursor - from + 1;
        cursor = from - 1;
      } catch {
        providerAcceptedRange = false;
        break;
      }
    }

    if (providerAcceptedRange) {
      return {
        logs: collected
          .sort(
            (a, b) =>
              hexToNumber(b.blockNumber) - hexToNumber(a.blockNumber)
          )
          .slice(0, maxResults),
        rpc: currentPreferred,
      };
    }
  }

  return { logs: [] as any[], rpc: preferred };
}

async function blockTimestampMap(
  chain: EvmWalletChain,
  logs: any[],
  preferred?: string | null
) {
  const uniqueBlocks = Array.from(
    new Set(logs.map((log) => log.blockNumber).filter(Boolean))
  ).slice(0, 12) as string[];

  const map = new Map<string, string | null>();
  let currentPreferred = preferred ?? null;

  // Intentionally sequential: public RPCs often rate-limit large parallel bursts.
  for (const blockNumber of uniqueBlocks) {
    try {
      const response = await rpcWithFallback(
        chain,
        "eth_getBlockByNumber",
        [blockNumber, false],
        currentPreferred
      );
      currentPreferred = response.url;
      const seconds = hexToNumber(response.result?.timestamp);
      map.set(
        blockNumber,
        seconds ? new Date(seconds * 1000).toISOString() : null
      );
    } catch {
      map.set(blockNumber, null);
    }
  }

  return map;
}

async function recentTransferLogs(
  chain: EvmWalletChain,
  wallet: string,
  direction: Exclude<Direction, "contract">
) {
  const topics =
    direction === "incoming"
      ? [TRANSFER_TOPIC, null, topicAddress(wallet)]
      : [TRANSFER_TOPIC, topicAddress(wallet)];

  const { logs, rpc } = await scanRecentLogs(chain, { topics });
  const timestamps = await blockTimestampMap(chain, logs, rpc);

  return {
    rpc,
    transfers: logs.map(
      (log: any): RawTransfer => ({
        hash: log.transactionHash ?? null,
        blockNumber: log.blockNumber ?? null,
        timestamp: timestamps.get(log.blockNumber) ?? null,
        direction,
        tokenContract: normalizeAddress(log.address) || null,
        value: null,
        rawValueHex: typeof log.data === "string" ? log.data : null,
        asset: null,
        category: "erc20",
        from: fromTopic(log.topics?.[1]),
        to: fromTopic(log.topics?.[2]),
      })
    ),
  };
}

async function recentTokenContractLogs(
  chain: EvmWalletChain,
  contract: string
) {
  const { logs, rpc } = await scanRecentLogs(
    chain,
    { address: normalizeAddress(contract), topics: [TRANSFER_TOPIC] },
    12
  );
  const timestamps = await blockTimestampMap(chain, logs, rpc);

  return {
    rpc,
    transfers: logs.map(
      (log: any): RawTransfer => ({
        hash: log.transactionHash ?? null,
        blockNumber: log.blockNumber ?? null,
        timestamp: timestamps.get(log.blockNumber) ?? null,
        direction: "contract",
        tokenContract: normalizeAddress(contract),
        value: null,
        rawValueHex: typeof log.data === "string" ? log.data : null,
        asset: null,
        category: "erc20",
        from: fromTopic(log.topics?.[1]),
        to: fromTopic(log.topics?.[2]),
      })
    ),
  };
}

function decodeAbiString(hex?: string | null) {
  if (!hex || hex === "0x") return null;
  const raw = hex.replace(/^0x/, "");

  try {
    if (raw.length === 64) {
      const buf = Buffer.from(raw, "hex");
      return buf.toString("utf8").replace(/\0+$/g, "").trim() || null;
    }

    if (raw.length >= 128) {
      const offset = parseInt(raw.slice(0, 64), 16) * 2;
      const lenStart = offset;
      const dataStart = lenStart + 64;
      const len = parseInt(raw.slice(lenStart, dataStart), 16);
      const data = raw.slice(dataStart, dataStart + len * 2);
      return (
        Buffer.from(data, "hex")
          .toString("utf8")
          .replace(/\0+$/g, "")
          .trim() || null
      );
    }
  } catch {
    return null;
  }

  return null;
}

async function tokenMeta(
  chain: EvmWalletChain,
  contract: string,
  preferred?: string | null
): Promise<TokenMeta> {
  const canonical = VERIFIED_TOKENS[chain][contract];
  let symbol = canonical?.symbol ?? "";
  let name = canonical?.name ?? null;
  let decimals: number | null = canonical?.decimals ?? null;
  let currentPreferred = preferred ?? null;

  try {
    const response = await rpcWithFallback(
      chain,
      "eth_call",
      [{ to: contract, data: "0x313ce567" }, "latest"],
      currentPreferred
    );
    currentPreferred = response.url;
    const candidate = hexToNumber(response.result);
    if (candidate >= 0 && candidate <= 36) decimals = candidate;
  } catch {
    // A verified canonical decimal value, when present, remains available.
  }

  try {
    const response = await rpcWithFallback(
      chain,
      "eth_call",
      [{ to: contract, data: "0x95d89b41" }, "latest"],
      currentPreferred
    );
    currentPreferred = response.url;
    symbol = decodeAbiString(response.result)?.toUpperCase() || symbol;
  } catch {
    // Symbol is optional and canonical metadata remains available.
  }

  try {
    const response = await rpcWithFallback(
      chain,
      "eth_call",
      [{ to: contract, data: "0x06fdde03" }, "latest"],
      currentPreferred
    );
    name = decodeAbiString(response.result) || name;
  } catch {
    // Name is optional and canonical metadata remains available.
  }

  return {
    name,
    symbol: symbol || "UNKNOWN",
    decimals,
  };
}

function movementContext(
  direction: Direction,
  attribution: WalletAttribution
): MovementContext {
  if (direction === "contract") return "unknown";
  if (attribution.entityType === "exchange") {
    return direction === "outgoing" ? "exchange_inflow" : "exchange_outflow";
  }
  if (attribution.entityType === "project") return "project_transfer";
  if (attribution.entityType === "treasury") return "treasury_transfer";
  if (attribution.entityType === "team") return "team_transfer";
  if (attribution.entityType === "investor") return "investor_transfer";
  return "unknown";
}

export async function GET(request: NextRequest) {
  try {
    const wallet = request.nextUrl.searchParams.get("address")?.trim();
    const chainParam =
      request.nextUrl.searchParams.get("chain")?.trim().toLowerCase() ||
      "ethereum";

    if (!wallet) {
      return NextResponse.json(
        { error: "An account address is required." },
        { status: 400 }
      );
    }

    if (!isAddress(wallet)) {
      return NextResponse.json(
        { error: "Enter a valid EVM account or contract address." },
        { status: 400 }
      );
    }

    if (!isChain(chainParam)) {
      return NextResponse.json(
        {
          error:
            "This EVM network is not supported by the current PRISM scanner.",
          supportedWalletChains: EVM_WALLET_CHAINS,
        },
        { status: 400 }
      );
    }

    const chain = chainParam;
    const config = CHAIN_CONFIG[chain];
    const normalizedWallet = normalizeAddress(wallet);
    const apiKey = process.env.ALCHEMY_API_KEY;
    const scannedWallet = getWalletAttribution(wallet);
    const scannedToken = VERIFIED_TOKENS[chain][normalizedWallet];
    const activityScope: "account" | "token-contract" = scannedToken
      ? "token-contract"
      : "account";

    let providerMode: "alchemy" | "public-rpc" | "limited" = "limited";
    let providerNote = "";
    let incoming: RawTransfer[] = [];
    let outgoing: RawTransfer[] = [];
    let contractActivity: RawTransfer[] = [];
    let rpc: string | null = null;

    if (activityScope === "token-contract") {
      try {
        const result = await recentTokenContractLogs(chain, normalizedWallet);
        rpc = result.rpc;
        contractActivity = result.transfers;
        providerMode = "public-rpc";
        providerNote = `PRISM recognised this address as the verified ${scannedToken.name} token contract on ${config.name}. PRISM is decoding recent Transfer events directly from the contract, including amount, sender, receiver, block and time when the network RPC exposes them.`;
      } catch {
        providerMode = "limited";
        providerNote = `${config.name} token-contract event history is temporarily unavailable. Verified project attribution remains available.`;
      }
    } else {
      if (apiKey) {
        try {
          [incoming, outgoing] = await Promise.all([
            alchemyTransfers(apiKey, chain, wallet, "incoming"),
            alchemyTransfers(apiKey, chain, wallet, "outgoing"),
          ]);
          providerMode = "alchemy";
        } catch {
          providerMode = "limited";
        }
      }

      if (providerMode !== "alchemy") {
        try {
          const [incomingResult, outgoingResult] = await Promise.all([
            recentTransferLogs(chain, wallet, "incoming"),
            recentTransferLogs(chain, wallet, "outgoing"),
          ]);
          incoming = incomingResult.transfers;
          outgoing = outgoingResult.transfers;
          rpc = incomingResult.rpc || outgoingResult.rpc;
          providerMode = "public-rpc";
          providerNote = `PRISM automatically switched to a public ${config.name} RPC. Recent ERC-20 activity is decoded directly from on-chain Transfer events.`;
        } catch {
          providerMode = "limited";
          providerNote = `${config.name} live transfer history is temporarily unavailable. Verified project attribution remains available.`;
        }
      }
    }

    const combined =
      activityScope === "token-contract"
        ? contractActivity
        : [...incoming, ...outgoing];

    const contracts = Array.from(
      new Set(combined.map((t) => t.tokenContract).filter(Boolean))
    ) as string[];
    const metaMap = new Map<string, TokenMeta>();

    if (contracts.length) {
      const pairs = await Promise.all(
        contracts.slice(0, 20).map(async (contract) => {
          const meta = await tokenMeta(chain, contract, rpc);
          return [contract, meta] as const;
        })
      );
      pairs.forEach(([contract, meta]) => metaMap.set(contract, meta));
    }

    const cleaned = combined.map((t) => {
      const contract = t.tokenContract;
      const canonical = contract ? VERIFIED_TOKENS[chain][contract] : undefined;
      const meta = contract ? metaMap.get(contract) : undefined;
      const symbol =
        canonical?.symbol ||
        meta?.symbol ||
        t.asset ||
        (t.category === "external" ? config.nativeSymbol : "UNKNOWN");
      const name =
        canonical?.name ||
        meta?.name ||
        (t.category === "external" ? config.nativeName : null);
      const decimals = canonical?.decimals ?? meta?.decimals ?? null;
      const verification: VerificationStatus =
        t.category === "external"
          ? "native"
          : canonical
          ? "verified"
          : "unverified";
      const resolvedValue =
        t.value ?? decodeTokenAmount(t.rawValueHex, decimals);

      const fromAttribution = getWalletAttribution(t.from);
      const toAttribution = getWalletAttribution(t.to);
      const accountCounterparty = t.direction === "incoming" ? t.from : t.to;
      const contractCounterparty =
        fromAttribution.entityType !== "unknown"
          ? t.from
          : toAttribution.entityType !== "unknown"
          ? t.to
          : t.to || t.from;
      const counterparty =
        t.direction === "contract" ? contractCounterparty : accountCounterparty;
      const attribution =
        t.direction === "contract"
          ? fromAttribution.entityType !== "unknown"
            ? fromAttribution
            : toAttribution.entityType !== "unknown"
            ? toAttribution
            : getWalletAttribution(counterparty)
          : getWalletAttribution(counterparty);
      const context = movementContext(t.direction, attribution);

      const blockNumber = t.blockNumber ? hexToNumber(t.blockNumber) : null;
      const blockLabel = blockNumber
        ? ` in block ${blockNumber.toLocaleString("en-US")}`
        : "";
      const contractEventNote = `${readableAmount(
        resolvedValue
      )} ${symbol} transferred from ${short(t.from)} to ${short(
        t.to
      )}${blockLabel}.`;
      const accountNote = `${readableAmount(resolvedValue)} ${symbol} ${
        t.direction === "incoming" ? "entered" : "left"
      } this account${blockLabel}.`;
      const contractContext =
        attribution.entityType !== "unknown"
          ? `One side of this token transfer is publicly attributed as ${attribution.label}. This does not prove project ownership, buying, selling, or intent.`
          : `From ${t.from || "unknown"} to ${
              t.to || "unknown"
            }. PRISM does not infer ownership or intent from the transfer alone.`;

      return {
        hash: t.hash,
        blockNumber,
        timestamp: t.timestamp,
        direction: t.direction,
        asset: symbol,
        assetName: name,
        value: resolvedValue,
        category: t.category,
        tokenContract: contract,
        verification,
        verificationReason: canonical
          ? `Contract address matches a canonical ${config.name} token contract.`
          : t.category === "external"
          ? `${config.nativeSymbol} is the native gas asset used by ${config.name}.`
          : "PRISM observed this token contract on the selected network but has not independently verified its project identity.",
        tokenLogo: null,
        from: t.from,
        to: t.to,
        counterparty,
        counterpartyShort: short(counterparty),
        attribution,
        movementContext: context,
        explorerUrl: t.hash ? `${config.explorerBase}/tx/${t.hash}` : null,
        importance:
          attribution.entityType !== "unknown"
            ? ("medium" as Importance)
            : ("low" as Importance),
        type:
          t.category === "external" ? "native_transfer" : "token_transfer",
        note: t.direction === "contract" ? contractEventNote : accountNote,
        contextExplanation:
          t.direction === "contract"
            ? contractContext
            : attribution.entityType === "unknown"
            ? "PRISM does not currently have reliable public attribution for this counterparty."
            : `The counterparty is publicly attributed as ${attribution.label}.`,
      };
    });

    const seen = new Set<string>();
    const activity = cleaned
      .filter((t) => {
        const key = `${t.hash}|${t.direction}|${t.tokenContract}|${t.from}|${t.to}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 12);

    const incomingCount = activity.filter(
      (t) => t.direction === "incoming"
    ).length;
    const outgoingCount = activity.filter(
      (t) => t.direction === "outgoing"
    ).length;
    const verified = activity.filter(
      (t) => t.verification === "verified" || t.verification === "native"
    );
    const attributed = activity.filter(
      (t) => t.attribution.entityType !== "unknown"
    );
    const exchanges = attributed.filter(
      (t) => t.attribution.entityType === "exchange"
    );
    const projects = attributed.filter((t) =>
      ["project", "treasury", "team", "investor"].includes(
        t.attribution.entityType
      )
    );
    const assets = Array.from(new Set(verified.map((t) => t.asset)));
    const latest = activity[0];
    const exchangeInflows = activity.filter(
      (t) => t.movementContext === "exchange_inflow"
    ).length;
    const exchangeOutflows = activity.filter(
      (t) => t.movementContext === "exchange_outflow"
    ).length;

    if (scannedToken && !assets.includes(scannedToken.symbol)) {
      assets.push(scannedToken.symbol);
    }

    return NextResponse.json({
      chain,
      chainName: config.name,
      walletScanner: "evm",
      activityScope,
      supportedChains: EVM_WALLET_CHAINS,
      address: wallet,
      addressShort: short(wallet),
      scannerStatus: providerMode === "limited" ? "limited" : "ready",
      provider: {
        mode: providerMode,
        note: providerNote || null,
      },
      scannedWallet: {
        attribution: scannedWallet,
        isAttributed: scannedWallet.entityType !== "unknown",
        headline: scannedToken
          ? `${scannedToken.name} token contract identified on ${config.name}`
          : scannedWallet.entityType !== "unknown"
          ? `${scannedWallet.label} identified on ${config.name}`
          : `Account identity is currently unknown on ${config.name}`,
        explanation: scannedToken
          ? `PRISM verified this as the ${scannedToken.symbol} token contract on ${config.name}. Contract activity is decoded from emitted token Transfer events.`
          : scannedWallet.entityType !== "unknown"
          ? scannedWallet.explanation
          : `PRISM has no reliable public attribution for this account on ${config.name}.`,
      },
      summary: {
        totalTransfers: activity.length,
        incomingTransfers: incomingCount,
        outgoingTransfers: outgoingCount,
        highImportanceTransfers: 0,
        verifiedTransfers: verified.length,
        unverifiedTransfers: activity.length - verified.length,
        suspiciousTransfersHidden: 0,
        trustedAssets: assets.length,
        attributedTransfers: attributed.length,
        exchangeInteractions: exchanges.length,
        exchangeInflows,
        exchangeOutflows,
        mintEvents: 0,
        burnEvents: 0,
        projectInteractions: projects.length,
      },
      assets,
      entities: Array.from(
        new Map(
          attributed
            .filter((t) => t.attribution.entity)
            .map((t) => [
              `${t.attribution.entity}-${t.attribution.entityType}`,
              {
                entity: t.attribution.entity,
                type: t.attribution.entityType,
                confidence: t.attribution.confidence,
              },
            ])
        ).values()
      ),
      activity,
      latestActivity: {
        timestamp: latest?.timestamp ?? null,
        direction: latest?.direction ?? null,
        asset: latest?.asset ?? null,
        attribution: latest?.attribution ?? null,
        movementContext: latest?.movementContext ?? null,
      },
      attributionIntelligence: {
        headline: attributed.length
          ? `${attributed.length} publicly attributed interaction${
              attributed.length === 1 ? "" : "s"
            } detected`
          : activityScope === "token-contract"
          ? "No publicly attributed transfer parties detected in the current token-event window."
          : "No publicly attributed counterparties detected in the current activity window.",
        explanation: attributed.length
          ? "PRISM found activity involving addresses with public attribution evidence."
          : activityScope === "token-contract"
          ? "PRISM reviewed recent Transfer events emitted by the verified token contract and did not infer labels for unknown addresses."
          : "PRISM will not infer ownership where reliable public attribution is unavailable.",
        verifiedEntityInteractions: attributed.length,
        exchangeInflows,
        exchangeOutflows,
        projectInteractions: projects.length,
        mintEvents: 0,
        burnEvents: 0,
      },
      intelligence: {
        status: exchanges.length || projects.length ? "attention" : "normal",
        headline: activity.length
          ? activityScope === "token-contract"
            ? `${activity.length} recent token Transfer event${
                activity.length === 1 ? "" : "s"
              } available for review`
            : `${activity.length} recent transfer${
                activity.length === 1 ? "" : "s"
              } available for review`
          : providerMode === "limited"
          ? activityScope === "token-contract"
            ? `Live token-contract event history is temporarily limited on ${config.name}`
            : `Live transfer history is temporarily limited on ${config.name}`
          : activityScope === "token-contract"
          ? `No recent Transfer events were returned for this verified token contract on ${config.name}`
          : `No recent ERC-20 transfers were returned for this address on ${config.name}`,
        explanation:
          activityScope === "token-contract"
            ? providerNote
            : providerMode === "alchemy"
            ? `PRISM analyzed activity through its primary ${config.name} provider.`
            : providerMode === "public-rpc"
            ? `PRISM used its automatic ${config.name} fallback adapter. Public-RPC mode focuses on recent ERC-20 transfer evidence.`
            : providerNote,
        attribution:
          "PRISM only attaches an entity label when the exact address has reliable public attribution evidence.",
        verificationPolicy:
          "Token identity is verified by contract address on the selected network. Verification on one network is not inherited by another.",
        interpretationPolicy:
          activityScope === "token-contract"
            ? "Token Transfer events describe observable contract activity. They do not prove project ownership, buying, selling, intent, or future price direction."
            : "Observed transfers and attributed relationships provide context only; they do not prove buying, selling, intent, or future price direction.",
      },
    });
  } catch (error) {
    console.error("PRISM wallet API error:", error);
    return NextResponse.json(
      {
        error:
          "PRISM could not retrieve live account activity right now. Please try again shortly.",
      },
      { status: 503 }
    );
  }
}

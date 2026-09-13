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

type Direction = "incoming" | "outgoing";
type VerificationStatus = "native" | "verified" | "unverified" | "suspicious";
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

type RawTransfer = {
  hash: string | null;
  blockNumber: string | null;
  timestamp: string | null;
  direction: Direction;
  tokenContract: string | null;
  value: number | null;
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
    publicRpcs: ["https://ethereum-rpc.publicnode.com", "https://rpc.ankr.com/eth"],
    explorerBase: "https://etherscan.io",
    nativeSymbol: "ETH",
    nativeName: "Ether",
  },
  arbitrum: {
    name: "Arbitrum One",
    alchemyBase: "https://arb-mainnet.g.alchemy.com/v2",
    publicRpcs: ["https://arb1.arbitrum.io/rpc", "https://arbitrum-one-rpc.publicnode.com"],
    explorerBase: "https://arbiscan.io",
    nativeSymbol: "ETH",
    nativeName: "Ether",
  },
  base: {
    name: "Base Mainnet",
    alchemyBase: "https://base-mainnet.g.alchemy.com/v2",
    publicRpcs: ["https://mainnet.base.org", "https://base-rpc.publicnode.com"],
    explorerBase: "https://basescan.org",
    nativeSymbol: "ETH",
    nativeName: "Ether",
  },
  optimism: {
    name: "OP Mainnet",
    alchemyBase: "https://opt-mainnet.g.alchemy.com/v2",
    publicRpcs: ["https://mainnet.optimism.io", "https://optimism-rpc.publicnode.com"],
    explorerBase: "https://optimistic.etherscan.io",
    nativeSymbol: "ETH",
    nativeName: "Ether",
  },
  polygon: {
    name: "Polygon PoS",
    alchemyBase: "https://polygon-mainnet.g.alchemy.com/v2",
    publicRpcs: ["https://polygon-rpc.com", "https://polygon-bor-rpc.publicnode.com"],
    explorerBase: "https://polygonscan.com",
    nativeSymbol: "POL",
    nativeName: "POL",
  },
  bnb: {
    name: "BNB Smart Chain",
    alchemyBase: "https://bnb-mainnet.g.alchemy.com/v2",
    publicRpcs: ["https://bsc-dataseed.binance.org", "https://bsc-rpc.publicnode.com"],
    explorerBase: "https://bscscan.com",
    nativeSymbol: "BNB",
    nativeName: "BNB",
  },
  avalanche: {
    name: "Avalanche C-Chain",
    alchemyBase: "https://avax-mainnet.g.alchemy.com/v2",
    publicRpcs: ["https://api.avax.network/ext/bc/C/rpc", "https://avalanche-c-chain-rpc.publicnode.com"],
    explorerBase: "https://snowtrace.io",
    nativeSymbol: "AVAX",
    nativeName: "Avalanche",
  },
};

const VERIFIED_TOKENS: Record<EvmWalletChain, Record<string, { symbol: string; name: string }>> = {
  ethereum: {
    "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48": { symbol: "USDC", name: "USD Coin" },
    "0xdac17f958d2ee523a2206206994597c13d831ec7": { symbol: "USDT", name: "Tether USD" },
    "0x6b175474e89094c44da98b954eedeac495271d0f": { symbol: "DAI", name: "Dai Stablecoin" },
    "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2": { symbol: "WETH", name: "Wrapped Ether" },
    "0x514910771af9ca656af840dff83e8264ecf986ca": { symbol: "LINK", name: "Chainlink" },
    "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984": { symbol: "UNI", name: "Uniswap" },
    "0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9": { symbol: "AAVE", name: "Aave" },
    "0xc18360217d8f7ab5e7c516566761ea12ce7f9d72": { symbol: "ENS", name: "Ethereum Name Service" },
  },
  arbitrum: {
    "0x912ce59144191c1204e64559fe8253a0e49e6548": { symbol: "ARB", name: "Arbitrum" },
    "0xaf88d065e77c8cc2239327c5edb3a432268e5831": { symbol: "USDC", name: "USD Coin" },
    "0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9": { symbol: "USDT", name: "Tether USD" },
  },
  base: {
    "0x19e8d59ff3d7a31289e0dc04db48d43b02c7ffa6": { symbol: "CYS", name: "Cysic" },
  },
  optimism: {
    "0x4200000000000000000000000000000000000042": { symbol: "OP", name: "Optimism" },
  },
  polygon: {},
  bnb: {
    "0x0c69199c1562233640e0db5ce2c399a88eb507c7": { symbol: "CYS", name: "Cysic" },
  },
  avalanche: {},
};

const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

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
  return `0x${normalizeAddress(address).replace(/^0x/, "").padStart(64, "0")}`;
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

async function jsonRpc(url: string, method: string, params: unknown[], id = 1) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
    cache: "no-store",
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || data?.error) {
    throw new Error(data?.error?.message || `${method} failed on RPC provider.`);
  }

  return data.result;
}

async function firstWorkingRpc(chain: EvmWalletChain) {
  const config = CHAIN_CONFIG[chain];
  const override = process.env[`PRISM_${chain.toUpperCase()}_RPC_URL`];
  const candidates = [override, ...config.publicRpcs].filter(Boolean) as string[];
  let lastError = "No RPC provider responded.";

  for (const url of candidates) {
    try {
      await jsonRpc(url, "eth_blockNumber", []);
      return url;
    } catch (error) {
      lastError = error instanceof Error ? error.message : lastError;
    }
  }

  throw new Error(lastError);
}

async function alchemyTransfers(
  apiKey: string,
  chain: EvmWalletChain,
  wallet: string,
  direction: Direction
) {
  const config = CHAIN_CONFIG[chain];
  const directionParams = direction === "incoming" ? { toAddress: wallet } : { fromAddress: wallet };

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

  return (result?.transfers ?? []).map((t: any): RawTransfer => ({
    hash: t.hash ?? null,
    blockNumber: t.blockNum ?? null,
    timestamp: t.metadata?.blockTimestamp ?? null,
    direction,
    tokenContract: normalizeAddress(t.rawContract?.address) || null,
    value: typeof t.value === "number" ? t.value : null,
    asset: t.asset ?? null,
    category: t.category === "external" ? "external" : "erc20",
    from: t.from ?? "",
    to: t.to ?? "",
  }));
}

async function recentTransferLogs(rpc: string, wallet: string, direction: Direction) {
  const latestHex = await jsonRpc(rpc, "eth_blockNumber", []);
  const latest = hexToNumber(latestHex);
  const windows = [50000, 10000, 2000];
  let logs: any[] = [];
  let worked = false;

  for (const window of windows) {
    const from = Math.max(0, latest - window);
    const topics =
      direction === "incoming"
        ? [TRANSFER_TOPIC, null, topicAddress(wallet)]
        : [TRANSFER_TOPIC, topicAddress(wallet)];

    try {
      logs = await jsonRpc(rpc, "eth_getLogs", [
        {
          fromBlock: `0x${from.toString(16)}`,
          toBlock: "latest",
          topics,
        },
      ]);
      worked = true;
      break;
    } catch {
      // Retry a smaller recent block window.
    }
  }

  if (!worked) return [] as RawTransfer[];

  return logs.slice(-50).reverse().map((log: any): RawTransfer => {
    const from = fromTopic(log.topics?.[1]);
    const to = fromTopic(log.topics?.[2]);

    return {
      hash: log.transactionHash ?? null,
      blockNumber: log.blockNumber ?? null,
      timestamp: null,
      direction,
      tokenContract: normalizeAddress(log.address) || null,
      value: null,
      asset: null,
      category: "erc20",
      from,
      to,
    };
  });
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
      const len = parseInt(raw.slice(64, 128), 16);
      const data = raw.slice(128, 128 + len * 2);
      return Buffer.from(data, "hex").toString("utf8").replace(/\0+$/g, "").trim() || null;
    }
  } catch {
    return null;
  }

  return null;
}

async function tokenMeta(rpc: string, chain: EvmWalletChain, contract: string): Promise<TokenMeta> {
  const canonical = VERIFIED_TOKENS[chain][contract];
  let symbol = canonical?.symbol ?? "";
  let name = canonical?.name ?? null;
  let decimals: number | null = null;

  try {
    const [symbolHex, nameHex, decimalsHex] = await Promise.all([
      jsonRpc(rpc, "eth_call", [{ to: contract, data: "0x95d89b41" }, "latest"]),
      jsonRpc(rpc, "eth_call", [{ to: contract, data: "0x06fdde03" }, "latest"]),
      jsonRpc(rpc, "eth_call", [{ to: contract, data: "0x313ce567" }, "latest"]),
    ]);

    symbol = decodeAbiString(symbolHex)?.toUpperCase() || symbol;
    name = decodeAbiString(nameHex) || name;
    decimals = decimalsHex ? hexToNumber(decimalsHex) : null;
  } catch {
    // Metadata is optional; attribution and transfer evidence can still render.
  }

  return { name, symbol: symbol || "UNKNOWN", decimals };
}

function movementContext(direction: Direction, attribution: WalletAttribution): MovementContext {
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
      request.nextUrl.searchParams.get("chain")?.trim().toLowerCase() || "ethereum";

    if (!wallet) {
      return NextResponse.json({ error: "An account address is required." }, { status: 400 });
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
          error: "This EVM network is not supported by the current PRISM scanner.",
          supportedWalletChains: EVM_WALLET_CHAINS,
        },
        { status: 400 }
      );
    }

    const chain = chainParam;
    const config = CHAIN_CONFIG[chain];
    const apiKey = process.env.ALCHEMY_API_KEY;
    const scannedWallet = getWalletAttribution(wallet);

    let providerMode: "alchemy" | "public-rpc" | "limited" = "limited";
    let providerNote = "";
    let incoming: RawTransfer[] = [];
    let outgoing: RawTransfer[] = [];
    let rpc: string | null = null;

    if (apiKey) {
      try {
        [incoming, outgoing] = await Promise.all([
          alchemyTransfers(apiKey, chain, wallet, "incoming"),
          alchemyTransfers(apiKey, chain, wallet, "outgoing"),
        ]);
        providerMode = "alchemy";
      } catch (error) {
        providerNote =
          error instanceof Error ? error.message : "Primary network adapter unavailable.";
      }
    }

    if (providerMode !== "alchemy") {
      try {
        rpc = await firstWorkingRpc(chain);
        [incoming, outgoing] = await Promise.all([
          recentTransferLogs(rpc, wallet, "incoming"),
          recentTransferLogs(rpc, wallet, "outgoing"),
        ]);
        providerMode = "public-rpc";
        providerNote = `PRISM automatically switched to a public ${config.name} RPC because the primary provider was unavailable for this network. Recent ERC-20 activity is shown where the public RPC exposes it.`;
      } catch {
        providerMode = "limited";
        providerNote = `${config.name} live transfer history is temporarily unavailable. Verified project attribution remains available, and PRISM will not expose provider setup errors to users.`;
      }
    }

    const combined = [...incoming, ...outgoing];
    const contracts = Array.from(
      new Set(combined.map((t) => t.tokenContract).filter(Boolean))
    ) as string[];
    const metaMap = new Map<string, TokenMeta>();

    if (rpc && contracts.length) {
      const pairs = await Promise.all(
        contracts.slice(0, 20).map(async (contract) => [
          contract,
          await tokenMeta(rpc!, chain, contract),
        ] as const)
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
      const verification: VerificationStatus =
        t.category === "external" ? "native" : canonical ? "verified" : "unverified";
      const counterparty = t.direction === "incoming" ? t.from : t.to;
      const attribution = getWalletAttribution(counterparty);
      const context = movementContext(t.direction, attribution);

      return {
        hash: t.hash,
        timestamp: t.timestamp,
        direction: t.direction,
        asset: symbol,
        assetName: name,
        value: t.value,
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
          attribution.entityType !== "unknown" ? ("medium" as Importance) : ("low" as Importance),
        type: t.category === "external" ? "native_transfer" : "token_transfer",
        note: `${symbol} ${t.direction === "incoming" ? "entered" : "left"} this account.`,
        contextExplanation:
          attribution.entityType === "unknown"
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

    const incomingCount = activity.filter((t) => t.direction === "incoming").length;
    const outgoingCount = activity.filter((t) => t.direction === "outgoing").length;
    const verified = activity.filter(
      (t) => t.verification === "verified" || t.verification === "native"
    );
    const attributed = activity.filter((t) => t.attribution.entityType !== "unknown");
    const exchanges = attributed.filter((t) => t.attribution.entityType === "exchange");
    const projects = attributed.filter((t) =>
      ["project", "treasury", "team", "investor"].includes(t.attribution.entityType)
    );
    const assets = Array.from(new Set(verified.map((t) => t.asset)));
    const latest = activity[0];
    const exchangeInflows = activity.filter(
      (t) => t.movementContext === "exchange_inflow"
    ).length;
    const exchangeOutflows = activity.filter(
      (t) => t.movementContext === "exchange_outflow"
    ).length;

    return NextResponse.json({
      chain,
      chainName: config.name,
      walletScanner: "evm",
      supportedChains: EVM_WALLET_CHAINS,
      address: wallet,
      addressShort: short(wallet),
      scannerStatus: providerMode === "limited" ? "limited" : "ready",
      provider: { mode: providerMode, note: providerNote || null },
      scannedWallet: {
        attribution: scannedWallet,
        isAttributed: scannedWallet.entityType !== "unknown",
        headline:
          scannedWallet.entityType !== "unknown"
            ? `${scannedWallet.label} identified on ${config.name}`
            : `Account identity is currently unknown on ${config.name}`,
        explanation:
          scannedWallet.entityType !== "unknown"
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
          : "No publicly attributed counterparties detected in the current activity window.",
        explanation: attributed.length
          ? "PRISM found activity involving addresses with public attribution evidence."
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
          ? `${activity.length} recent transfer${activity.length === 1 ? "" : "s"} available for review`
          : providerMode === "limited"
          ? `Live transfer history is temporarily limited on ${config.name}`
          : `No recent ERC-20 transfers were returned for this address on ${config.name}`,
        explanation:
          providerMode === "alchemy"
            ? `PRISM analyzed activity through its primary ${config.name} provider.`
            : providerMode === "public-rpc"
            ? `PRISM used its automatic ${config.name} fallback adapter. Public-RPC mode focuses on recent ERC-20 transfer evidence.`
            : providerNote,
        attribution:
          "PRISM only attaches an entity label when the exact address has reliable public attribution evidence.",
        verificationPolicy:
          "Token identity is verified by contract address on the selected network. Verification on one network is not inherited by another.",
        interpretationPolicy:
          "Observed transfers and attributed relationships provide context only; they do not prove buying, selling, intent, or future price direction.",
      },
    });
  } catch (error) {
    console.error("PRISM wallet API error:", error);
    return NextResponse.json(
      {
        error: "PRISM could not retrieve live account activity right now. Please try again shortly.",
      },
      { status: 503 }
    );
  }
}

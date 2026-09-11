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

type AlchemyTransfer = {
  hash?: string;
  from?: string;
  to?: string | null;
  value?: number | null;
  asset?: string | null;
  category?: string;
  rawContract?: {
    address?: string | null;
  };
  metadata?: {
    blockTimestamp?: string;
  };
};

type AlchemyTransfersResponse = {
  result?: {
    transfers?: AlchemyTransfer[];
  };
  error?: {
    code?: number;
    message?: string;
  };
};

type TokenMetadataResponse = {
  result?: {
    name?: string | null;
    symbol?: string | null;
    decimals?: number | null;
    logo?: string | null;
  };
  error?: {
    code?: number;
    message?: string;
  };
};

type VerificationStatus =
  | "native"
  | "verified"
  | "unverified"
  | "suspicious";

type Importance = "high" | "medium" | "low";

type TransferType =
  | "native_transfer"
  | "token_transfer"
  | "large_transfer"
  | "mint"
  | "burn"
  | "unknown_transfer";

type MovementContext =
  | "exchange_inflow"
  | "exchange_outflow"
  | "mint"
  | "burn"
  | "project_transfer"
  | "treasury_transfer"
  | "team_transfer"
  | "investor_transfer"
  | "unknown";

type TokenVerification = {
  contractAddress: string | null;
  name: string | null;
  symbol: string;
  decimals: number | null;
  logo: string | null;
  status: VerificationStatus;
  reason: string;
};

type CleanTransfer = {
  hash: string | null;
  timestamp: string | null;
  direction: "incoming" | "outgoing";
  asset: string;
  assetName: string | null;
  value: number | null;
  category: string;
  tokenContract: string | null;
  verification: VerificationStatus;
  verificationReason: string;
  tokenLogo: string | null;
  from: string;
  to: string;
  counterparty: string;
  counterpartyShort: string;
  attribution: WalletAttribution;
  movementContext: MovementContext;
  explorerUrl: string | null;
  importance: Importance;
  type: TransferType;
  note: string;
  contextExplanation: string;
};

const ZERO_ADDRESS =
  "0x0000000000000000000000000000000000000000";

const DEAD_ADDRESS =
  "0x000000000000000000000000000000000000dead";

const EVM_WALLET_CHAINS: EvmWalletChain[] = [
  "ethereum",
  "arbitrum",
  "base",
  "optimism",
  "polygon",
  "bnb",
  "avalanche",
];

const CHAIN_CONFIG: Record<
  EvmWalletChain,
  {
    name: string;
    rpcBase: string;
    explorerBase: string;
    nativeSymbol: string;
    nativeName: string;
  }
> = {
  ethereum: {
    name: "Ethereum Mainnet",
    rpcBase: "https://eth-mainnet.g.alchemy.com/v2",
    explorerBase: "https://etherscan.io",
    nativeSymbol: "ETH",
    nativeName: "Ether",
  },
  arbitrum: {
    name: "Arbitrum One",
    rpcBase: "https://arb-mainnet.g.alchemy.com/v2",
    explorerBase: "https://arbiscan.io",
    nativeSymbol: "ETH",
    nativeName: "Ether",
  },
  base: {
    name: "Base Mainnet",
    rpcBase: "https://base-mainnet.g.alchemy.com/v2",
    explorerBase: "https://basescan.org",
    nativeSymbol: "ETH",
    nativeName: "Ether",
  },
  optimism: {
    name: "OP Mainnet",
    rpcBase: "https://opt-mainnet.g.alchemy.com/v2",
    explorerBase: "https://optimistic.etherscan.io",
    nativeSymbol: "ETH",
    nativeName: "Ether",
  },
  polygon: {
    name: "Polygon PoS",
    rpcBase: "https://polygon-mainnet.g.alchemy.com/v2",
    explorerBase: "https://polygonscan.com",
    nativeSymbol: "POL",
    nativeName: "POL",
  },
  bnb: {
    name: "BNB Smart Chain",
    rpcBase: "https://bnb-mainnet.g.alchemy.com/v2",
    explorerBase: "https://bscscan.com",
    nativeSymbol: "BNB",
    nativeName: "BNB",
  },
  avalanche: {
    name: "Avalanche C-Chain",
    rpcBase: "https://avax-mainnet.g.alchemy.com/v2",
    explorerBase: "https://snowtrace.io",
    nativeSymbol: "AVAX",
    nativeName: "Avalanche",
  },
};

const VERIFIED_TOKENS: Record<
  EvmWalletChain,
  Record<string, { symbol: string; name: string }>
> = {
  ethereum: {
    "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48": {
      symbol: "USDC",
      name: "USD Coin",
    },
    "0xdac17f958d2ee523a2206206994597c13d831ec7": {
      symbol: "USDT",
      name: "Tether USD",
    },
    "0x6b175474e89094c44da98b954eedeac495271d0f": {
      symbol: "DAI",
      name: "Dai Stablecoin",
    },
    "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2": {
      symbol: "WETH",
      name: "Wrapped Ether",
    },
    "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599": {
      symbol: "WBTC",
      name: "Wrapped BTC",
    },
    "0x514910771af9ca656af840dff83e8264ecf986ca": {
      symbol: "LINK",
      name: "Chainlink",
    },
    "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984": {
      symbol: "UNI",
      name: "Uniswap",
    },
    "0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9": {
      symbol: "AAVE",
      name: "Aave",
    },
    "0xc18360217d8f7ab5e7c516566761ea12ce7f9d72": {
      symbol: "ENS",
      name: "Ethereum Name Service",
    },
  },
  arbitrum: {
    "0x912ce59144191c1204e64559fe8253a0e49e6548": {
      symbol: "ARB",
      name: "Arbitrum",
    },
    "0xaf88d065e77c8cc2239327c5edb3a432268e5831": {
      symbol: "USDC",
      name: "USD Coin",
    },
    "0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9": {
      symbol: "USDT",
      name: "Tether USD",
    },
    "0x82af49447d8a07e3bd95bd0d56f35241523fbab1": {
      symbol: "WETH",
      name: "Wrapped Ether",
    },
  },
  base: {},
  optimism: {},
  polygon: {},
  bnb: {},
  avalanche: {},
};

function isEthereumAddress(value: string) {
  return /^0x[a-fA-F0-9]{40}$/.test(value);
}

function isEvmWalletChain(value: string): value is EvmWalletChain {
  return EVM_WALLET_CHAINS.includes(value as EvmWalletChain);
}

function normalizeAddress(value?: string | null) {
  return value?.trim().toLowerCase() ?? "";
}

function shortenAddress(address?: string | null) {
  if (!address) return "Unknown";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function normalizeSymbol(symbol?: string | null) {
  return symbol?.trim().toUpperCase() ?? "";
}

function hasSuspiciousSymbol(symbol: string) {
  if (!symbol || symbol.length > 16) return true;

  if (!/^[A-Z0-9._+-]+$/.test(symbol)) return true;

  const suspiciousTerms = [
    "HTTP",
    "HTTPS",
    "WWW",
    ".COM",
    ".NET",
    ".ORG",
    "CLAIM",
    "REWARD",
    "VISIT",
    "FREE",
    "AIRDROP",
    "BONUS",
    "GIFT",
    "VOUCHER",
    "PRIZE",
  ];

  return suspiciousTerms.some((term) => symbol.includes(term));
}

function isZeroAddress(address?: string | null) {
  return normalizeAddress(address) === ZERO_ADDRESS;
}

function isDeadAddress(address?: string | null) {
  return normalizeAddress(address) === DEAD_ADDRESS;
}

async function alchemyRpc<T>(
  apiKey: string,
  chain: EvmWalletChain,
  method: string,
  params: unknown[],
  id: number
): Promise<T> {
  const config = CHAIN_CONFIG[chain];

  const response = await fetch(`${config.rpcBase}/${apiKey}`, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id,
      method,
      params,
    }),
    cache: "no-store",
  });

  const data = await response.json();

  if (!response.ok || data.error) {
    throw new Error(
      data.error?.message ||
        `Alchemy request failed for ${method} on ${chain}.`
    );
  }

  return data as T;
}

async function fetchTransfers(
  apiKey: string,
  chain: EvmWalletChain,
  wallet: string,
  direction: "incoming" | "outgoing"
) {
  const directionParams =
    direction === "incoming"
      ? { toAddress: wallet }
      : { fromAddress: wallet };

  const data = await alchemyRpc<AlchemyTransfersResponse>(
    apiKey,
    chain,
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
    direction === "incoming" ? 1 : 2
  );

  return data.result?.transfers ?? [];
}

async function fetchTokenMetadata(
  apiKey: string,
  chain: EvmWalletChain,
  contractAddress: string
) {
  try {
    const data = await alchemyRpc<TokenMetadataResponse>(
      apiKey,
      chain,
      "alchemy_getTokenMetadata",
      [contractAddress],
      10
    );

    return {
      name: data.result?.name ?? null,
      symbol: normalizeSymbol(data.result?.symbol),
      decimals: data.result?.decimals ?? null,
      logo: data.result?.logo ?? null,
    };
  } catch {
    return {
      name: null,
      symbol: "",
      decimals: null,
      logo: null,
    };
  }
}

async function buildTokenVerification(
  apiKey: string,
  chain: EvmWalletChain,
  contractAddress: string,
  fallbackSymbol?: string | null
): Promise<TokenVerification> {
  const normalizedContract = normalizeAddress(contractAddress);
  const canonical = VERIFIED_TOKENS[chain][normalizedContract];
  const metadata = await fetchTokenMetadata(apiKey, chain, normalizedContract);
  const fallback = normalizeSymbol(fallbackSymbol);
  const resolvedSymbol = metadata.symbol || fallback || "UNKNOWN";

  if (canonical) {
    return {
      contractAddress: normalizedContract,
      name: metadata.name || canonical.name,
      symbol: canonical.symbol,
      decimals: metadata.decimals,
      logo: metadata.logo,
      status: "verified",
      reason: `Contract address matches a canonical ${CHAIN_CONFIG[chain].name} token contract.`,
    };
  }

  if (resolvedSymbol !== "UNKNOWN" && hasSuspiciousSymbol(resolvedSymbol)) {
    return {
      contractAddress: normalizedContract,
      name: metadata.name,
      symbol: resolvedSymbol,
      decimals: metadata.decimals,
      logo: metadata.logo,
      status: "suspicious",
      reason: "Token metadata contains suspicious symbol characteristics.",
    };
  }

  return {
    contractAddress: normalizedContract,
    name: metadata.name,
    symbol: resolvedSymbol,
    decimals: metadata.decimals,
    logo: metadata.logo,
    status: "unverified",
    reason:
      "The token contract was observed on-chain, but PRISM has not independently verified its project identity on this network.",
  };
}

function getMovementContext(
  direction: "incoming" | "outgoing",
  from: string,
  to: string,
  attribution: WalletAttribution
): { context: MovementContext; explanation: string } {
  if (direction === "incoming" && isZeroAddress(from)) {
    return {
      context: "mint",
      explanation:
        "Tokens originated from the zero address and entered the scanned account. This is a mint context.",
    };
  }

  if (direction === "outgoing" && (isZeroAddress(to) || isDeadAddress(to))) {
    return {
      context: "burn",
      explanation:
        "Tokens left the scanned account and moved to a burn address. This is a burn context.",
    };
  }

  if (attribution.entityType === "exchange" && direction === "outgoing") {
    return {
      context: "exchange_inflow",
      explanation: `Tokens moved from the scanned account toward ${attribution.label}. This is an exchange inflow context, but it does not prove the assets were sold.`,
    };
  }

  if (attribution.entityType === "exchange" && direction === "incoming") {
    return {
      context: "exchange_outflow",
      explanation: `Tokens moved from ${attribution.label} into the scanned account. This is an exchange outflow context, but it does not prove accumulation intent.`,
    };
  }

  if (attribution.entityType === "project") {
    return {
      context: "project_transfer",
      explanation: `The counterparty is attributed to ${
        attribution.entity ?? attribution.label
      }.`,
    };
  }

  if (attribution.entityType === "treasury") {
    return {
      context: "treasury_transfer",
      explanation: `The counterparty is attributed to a treasury account associated with ${
        attribution.entity ?? attribution.label
      }.`,
    };
  }

  if (attribution.entityType === "team") {
    return {
      context: "team_transfer",
      explanation: `The counterparty is attributed to a team-linked account associated with ${
        attribution.entity ?? attribution.label
      }.`,
    };
  }

  if (attribution.entityType === "investor") {
    return {
      context: "investor_transfer",
      explanation: "The counterparty is attributed to an investor-linked account.",
    };
  }

  return {
    context: "unknown",
    explanation:
      "PRISM does not currently have reliable entity attribution for the counterparty.",
  };
}

function classifyTransfer(
  transfer: AlchemyTransfer,
  direction: "incoming" | "outgoing",
  verification: TokenVerification,
  attribution: WalletAttribution,
  movementContext: MovementContext
) {
  const value = typeof transfer.value === "number" ? transfer.value : null;
  const asset =
    verification.symbol || normalizeSymbol(transfer.asset) || "UNKNOWN";

  let type: TransferType = "unknown_transfer";
  let importance: Importance = "low";
  let note = "Blockchain activity involving this account was detected.";

  if (movementContext === "mint") {
    type = "mint";
    importance = "medium";
    note = `${asset} was minted into this account.`;
  } else if (movementContext === "burn") {
    type = "burn";
    importance = "medium";
    note = `${asset} was sent to a burn address.`;
  } else if (transfer.category === "external") {
    type = "native_transfer";
    importance = "medium";
    note =
      direction === "incoming"
        ? `${asset} entered this account.`
        : `${asset} left this account.`;
  } else if (transfer.category === "erc20") {
    type = "token_transfer";
    importance = verification.status === "verified" ? "medium" : "low";
    note =
      direction === "incoming"
        ? `${asset} entered this account.`
        : `${asset} left this account.`;
  }

  // Temporary token-unit threshold, not USD valuation.
  if (
    verification.status !== "suspicious" &&
    value !== null &&
    value >= 1000 &&
    movementContext !== "mint" &&
    movementContext !== "burn"
  ) {
    type = "large_transfer";
    importance = "high";
    note =
      direction === "incoming"
        ? `A large incoming ${asset} transfer was detected.`
        : `A large outgoing ${asset} transfer was detected.`;
  }

  if (attribution.entityType === "exchange") {
    importance = importance === "high" ? "high" : "medium";
  }

  return { type, importance, note };
}

export async function GET(request: NextRequest) {
  try {
    const apiKey = process.env.ALCHEMY_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "Alchemy API key is not configured on the server." },
        { status: 500 }
      );
    }

    const wallet = request.nextUrl.searchParams.get("address")?.trim();
    const chainParam =
      request.nextUrl.searchParams.get("chain")?.trim().toLowerCase() ??
      "ethereum";

    if (!wallet) {
      return NextResponse.json(
        { error: "An account address is required." },
        { status: 400 }
      );
    }

    if (!isEthereumAddress(wallet)) {
      return NextResponse.json(
        { error: "Enter a valid EVM account or contract address." },
        { status: 400 }
      );
    }

    if (!isEvmWalletChain(chainParam)) {
      return NextResponse.json(
        {
          error: "This EVM network is not supported by the current PRISM scanner.",
          requestedChain: chainParam,
          supportedWalletChains: EVM_WALLET_CHAINS,
          note:
            "Solana uses PRISM's separate Solana account-intelligence adapter.",
        },
        { status: 400 }
      );
    }

    const chain = chainParam;
    const config = CHAIN_CONFIG[chain];
    const scannedWallet = getWalletAttribution(wallet);

    const [incomingRaw, outgoingRaw] = await Promise.all([
      fetchTransfers(apiKey, chain, wallet, "incoming"),
      fetchTransfers(apiKey, chain, wallet, "outgoing"),
    ]);

    const combined = [
      ...incomingRaw.map((transfer) => ({
        ...transfer,
        direction: "incoming" as const,
      })),
      ...outgoingRaw.map((transfer) => ({
        ...transfer,
        direction: "outgoing" as const,
      })),
    ];

    const uniqueContracts = Array.from(
      new Set(
        combined
          .filter(
            (transfer) =>
              transfer.category === "erc20" && transfer.rawContract?.address
          )
          .map((transfer) => normalizeAddress(transfer.rawContract?.address))
          .filter(Boolean)
      )
    );

    const fallbackSymbols = new Map<string, string>();

    for (const transfer of combined) {
      const contract = normalizeAddress(transfer.rawContract?.address);
      if (contract && transfer.asset && !fallbackSymbols.has(contract)) {
        fallbackSymbols.set(contract, transfer.asset);
      }
    }

    const verificationPairs = await Promise.all(
      uniqueContracts.map(async (contract) => {
        const verification = await buildTokenVerification(
          apiKey,
          chain,
          contract,
          fallbackSymbols.get(contract)
        );

        return [contract, verification] as const;
      })
    );

    const verificationMap = new Map<string, TokenVerification>(
      verificationPairs
    );

    const seen = new Set<string>();
    const cleanedTransfers: CleanTransfer[] = [];
    let hiddenSuspiciousTransfers = 0;

    for (const transfer of combined) {
      const contract = normalizeAddress(transfer.rawContract?.address);
      let verification: TokenVerification;

      if (transfer.category === "external") {
        verification = {
          contractAddress: null,
          name: config.nativeName,
          symbol: config.nativeSymbol,
          decimals: 18,
          logo: null,
          status: "native",
          reason: `${config.nativeSymbol} is the native gas asset used by ${config.name}.`,
        };
      } else {
        verification = verificationMap.get(contract) ?? {
          contractAddress: contract || null,
          name: null,
          symbol: normalizeSymbol(transfer.asset) || "UNKNOWN",
          decimals: null,
          logo: null,
          status: "unverified",
          reason:
            "PRISM observed this token contract but has not independently verified its project identity on the selected network.",
        };
      }

      if (verification.status === "suspicious") {
        hiddenSuspiciousTransfers++;
        continue;
      }

      const asset =
        verification.symbol || normalizeSymbol(transfer.asset) || "UNKNOWN";

      const uniqueKey = [
        chain,
        transfer.hash ?? "",
        transfer.category ?? "",
        contract,
        asset,
        transfer.value ?? "",
        normalizeAddress(transfer.from),
        normalizeAddress(transfer.to),
      ].join("|");

      if (seen.has(uniqueKey)) continue;
      seen.add(uniqueKey);

      const from = transfer.from ?? "";
      const to = transfer.to ?? "";
      const counterparty = transfer.direction === "incoming" ? from : to;
      const attribution = getWalletAttribution(counterparty);
      const movement = getMovementContext(
        transfer.direction,
        from,
        to,
        attribution
      );
      const classification = classifyTransfer(
        transfer,
        transfer.direction,
        verification,
        attribution,
        movement.context
      );

      cleanedTransfers.push({
        hash: transfer.hash ?? null,
        timestamp: transfer.metadata?.blockTimestamp ?? null,
        direction: transfer.direction,
        asset,
        assetName: verification.name,
        value: typeof transfer.value === "number" ? transfer.value : null,
        category: transfer.category ?? "unknown",
        tokenContract: verification.contractAddress,
        verification: verification.status,
        verificationReason: verification.reason,
        tokenLogo: verification.logo,
        from,
        to,
        counterparty,
        counterpartyShort: shortenAddress(counterparty),
        attribution,
        movementContext: movement.context,
        explorerUrl: transfer.hash
          ? `${config.explorerBase}/tx/${transfer.hash}`
          : null,
        importance: classification.importance,
        type: classification.type,
        note: classification.note,
        contextExplanation: movement.explanation,
      });
    }

    cleanedTransfers.sort((a, b) => {
      const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return timeB - timeA;
    });

    const verifiedTransfers = cleanedTransfers.filter(
      (transfer) =>
        transfer.verification === "verified" ||
        transfer.verification === "native"
    );
    const unverifiedTransfers = cleanedTransfers.filter(
      (transfer) => transfer.verification === "unverified"
    );
    const incomingTransfers = cleanedTransfers.filter(
      (transfer) => transfer.direction === "incoming"
    );
    const outgoingTransfers = cleanedTransfers.filter(
      (transfer) => transfer.direction === "outgoing"
    );
    const highImportanceTransfers = cleanedTransfers.filter(
      (transfer) => transfer.importance === "high"
    );
    const attributedTransfers = cleanedTransfers.filter(
      (transfer) => transfer.attribution.entityType !== "unknown"
    );
    const exchangeInteractions = cleanedTransfers.filter(
      (transfer) => transfer.attribution.entityType === "exchange"
    );
    const exchangeInflows = cleanedTransfers.filter(
      (transfer) => transfer.movementContext === "exchange_inflow"
    );
    const exchangeOutflows = cleanedTransfers.filter(
      (transfer) => transfer.movementContext === "exchange_outflow"
    );
    const mintEvents = cleanedTransfers.filter(
      (transfer) => transfer.movementContext === "mint"
    );
    const burnEvents = cleanedTransfers.filter(
      (transfer) => transfer.movementContext === "burn"
    );
    const projectInteractions = cleanedTransfers.filter((transfer) =>
      ["project", "treasury", "team", "investor"].includes(
        transfer.attribution.entityType
      )
    );

    const trustedAssets = Array.from(
      new Set(verifiedTransfers.map((transfer) => transfer.asset))
    );

    const entities = Array.from(
      new Map(
        attributedTransfers
          .filter((transfer) => transfer.attribution.entity)
          .map((transfer) => [
            `${chain}-${transfer.attribution.entity}-${transfer.attribution.entityType}`,
            {
              entity: transfer.attribution.entity,
              type: transfer.attribution.entityType,
              confidence: transfer.attribution.confidence,
            },
          ])
      ).values()
    );

    const recentTransfers = cleanedTransfers.slice(0, 12);
    const latest = recentTransfers[0];

    let attributionHeadline =
      "No verified exchange or project-linked counterparties detected in the current activity window.";
    let attributionExplanation =
      "Most counterparties remain unlabelled. PRISM will not infer ownership without reliable public attribution evidence.";

    if (exchangeInflows.length > 0) {
      attributionHeadline = `${exchangeInflows.length} verified exchange inflow${
        exchangeInflows.length === 1 ? "" : "s"
      } detected`;
      attributionExplanation =
        "One or more transfers moved from the scanned account toward a publicly attributed exchange address. This does not prove a sale occurred.";
    } else if (exchangeOutflows.length > 0) {
      attributionHeadline = `${exchangeOutflows.length} verified exchange outflow${
        exchangeOutflows.length === 1 ? "" : "s"
      } detected`;
      attributionExplanation =
        "One or more transfers moved from a publicly attributed exchange address into the scanned account. This does not prove accumulation intent.";
    } else if (projectInteractions.length > 0) {
      attributionHeadline = `${projectInteractions.length} project-linked interaction${
        projectInteractions.length === 1 ? "" : "s"
      } detected`;
      attributionExplanation =
        "PRISM found transfers involving publicly attributed project, treasury, team, or investor addresses.";
    }

    return NextResponse.json({
      chain,
      chainName: config.name,
      walletScanner: "evm",
      supportedChains: EVM_WALLET_CHAINS,
      address: wallet,
      addressShort: shortenAddress(wallet),
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
        totalTransfers: cleanedTransfers.length,
        incomingTransfers: incomingTransfers.length,
        outgoingTransfers: outgoingTransfers.length,
        highImportanceTransfers: highImportanceTransfers.length,
        verifiedTransfers: verifiedTransfers.length,
        unverifiedTransfers: unverifiedTransfers.length,
        suspiciousTransfersHidden: hiddenSuspiciousTransfers,
        trustedAssets: trustedAssets.length,
        attributedTransfers: attributedTransfers.length,
        exchangeInteractions: exchangeInteractions.length,
        exchangeInflows: exchangeInflows.length,
        exchangeOutflows: exchangeOutflows.length,
        mintEvents: mintEvents.length,
        burnEvents: burnEvents.length,
        projectInteractions: projectInteractions.length,
      },
      assets: trustedAssets,
      entities,
      activity: recentTransfers,
      latestActivity: {
        timestamp: latest?.timestamp ?? null,
        direction: latest?.direction ?? null,
        asset: latest?.asset ?? null,
        attribution: latest?.attribution ?? null,
        movementContext: latest?.movementContext ?? null,
      },
      attributionIntelligence: {
        headline: attributionHeadline,
        explanation: attributionExplanation,
        verifiedEntityInteractions: attributedTransfers.length,
        exchangeInflows: exchangeInflows.length,
        exchangeOutflows: exchangeOutflows.length,
        projectInteractions: projectInteractions.length,
        mintEvents: mintEvents.length,
        burnEvents: burnEvents.length,
      },
      intelligence: {
        status:
          highImportanceTransfers.length > 0 || exchangeInteractions.length > 0
            ? "attention"
            : "normal",
        headline:
          highImportanceTransfers.length > 0
            ? `${highImportanceTransfers.length} transfer${
                highImportanceTransfers.length === 1 ? "" : "s"
              } deserve additional review`
            : exchangeInteractions.length > 0
            ? `${exchangeInteractions.length} verified exchange interaction${
                exchangeInteractions.length === 1 ? "" : "s"
              } detected`
            : "No high-importance or verified exchange interactions detected by the current account model",
        explanation: `PRISM analyzed ${cleanedTransfers.length} cleaned transfers on ${config.name}. Token verification and public attribution were applied where evidence was available.`,
        attribution:
          "PRISM only attaches an entity label when the exact address has reliable public attribution evidence.",
        verificationPolicy:
          "Token identity is verified using the contract address on the selected network. A token verified on one network is not automatically considered verified on another.",
        interpretationPolicy:
          "Mint, burn, exchange inflow, exchange outflow, project, treasury, team, and investor contexts describe observable blockchain relationships. They do not prove buying, selling, ownership intent, or future price direction.",
      },
    });
  } catch (error) {
    console.error("PRISM wallet API error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Something went wrong while retrieving account activity.",
      },
      { status: 500 }
    );
  }
}

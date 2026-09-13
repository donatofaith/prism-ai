import { NextRequest, NextResponse } from "next/server";

import {
  getProjectWallets,
  type SupportedChain,
} from "@/lib/project-wallets";

const VALID_CHAINS: SupportedChain[] = [
  "ethereum",
  "arbitrum",
  "base",
  "optimism",
  "polygon",
  "bnb",
  "avalanche",
  "solana",
];

const PLATFORM_TO_CHAIN: Record<string, SupportedChain> = {
  ethereum: "ethereum",
  "arbitrum-one": "arbitrum",
  base: "base",
  "optimistic-ethereum": "optimism",
  "polygon-pos": "polygon",
  "binance-smart-chain": "bnb",
  avalanche: "avalanche",
  solana: "solana",
};

const CHAIN_LABELS: Record<SupportedChain, string> = {
  ethereum: "Ethereum",
  arbitrum: "Arbitrum",
  base: "Base",
  optimism: "Optimism",
  polygon: "Polygon",
  bnb: "BNB Smart Chain",
  avalanche: "Avalanche",
  solana: "Solana",
};

type DynamicAccount = {
  address: string;
  project: string;
  symbol: string | null;
  chain: SupportedChain;
  label: string;
  accountType: "project";
  walletType: "project";
  isWallet: false;
  confidence: "high";
  source: string;
  sourceUrl: string;
  explanation: string;
};

type CoinGeckoSearchCoin = {
  id?: string;
  name?: string;
  symbol?: string;
  market_cap_rank?: number | null;
};

type CoinGeckoDetail = {
  id?: string;
  name?: string;
  symbol?: string;
  platforms?: Record<string, string | null>;
};

function normalizeProjectQuery(value: string) {
  return value.trim().toLowerCase();
}

function normalize(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function isSupportedChain(value: string): value is SupportedChain {
  return VALID_CHAINS.includes(value as SupportedChain);
}

function looksLikeAddress(address: string, chain: SupportedChain) {
  if (chain === "solana") return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

async function discoverProjectContracts(
  project: string,
  chain?: SupportedChain
): Promise<{ accounts: DynamicAccount[]; resolvedName: string | null }> {
  try {
    const searchResponse = await fetch(
      `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(project)}`,
      {
        cache: "no-store",
        headers: {
          accept: "application/json",
          "user-agent": "PRISM-Crypto-Intelligence/1.0",
        },
        signal: AbortSignal.timeout(7000),
      }
    );

    if (!searchResponse.ok) return { accounts: [], resolvedName: null };

    const searchPayload = (await searchResponse.json()) as {
      coins?: CoinGeckoSearchCoin[];
    };
    const coins = Array.isArray(searchPayload.coins) ? searchPayload.coins : [];
    if (coins.length === 0) return { accounts: [], resolvedName: null };

    const target = normalize(project);
    const exact = coins.find(
      (coin) =>
        normalize(coin.symbol) === target ||
        normalize(coin.name) === target ||
        normalize(coin.id) === target
    );
    const selected = exact ?? coins[0];
    if (!selected?.id) return { accounts: [], resolvedName: null };

    const detailResponse = await fetch(
      `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(
        selected.id
      )}?localization=false&tickers=false&market_data=false&community_data=false&developer_data=false&sparkline=false`,
      {
        cache: "no-store",
        headers: {
          accept: "application/json",
          "user-agent": "PRISM-Crypto-Intelligence/1.0",
        },
        signal: AbortSignal.timeout(7000),
      }
    );

    if (!detailResponse.ok) return { accounts: [], resolvedName: selected.name ?? null };

    const detail = (await detailResponse.json()) as CoinGeckoDetail;
    const name = detail.name?.trim() || selected.name?.trim() || project;
    const symbol = (detail.symbol || selected.symbol || "").toUpperCase() || null;
    const platforms = detail.platforms ?? {};

    const accounts: DynamicAccount[] = [];

    for (const [platform, rawAddress] of Object.entries(platforms)) {
      const mappedChain = PLATFORM_TO_CHAIN[platform];
      const address = rawAddress?.trim() ?? "";
      if (!mappedChain || !address || !looksLikeAddress(address, mappedChain)) continue;
      if (chain && mappedChain !== chain) continue;

      accounts.push({
        address,
        project: name,
        symbol,
        chain: mappedChain,
        label: `${name}${symbol ? ` ${symbol}` : ""} token contract — ${CHAIN_LABELS[mappedChain]}`,
        accountType: "project",
        walletType: "project",
        isWallet: false,
        confidence: "high",
        source: "CoinGecko token metadata",
        sourceUrl: `https://www.coingecko.com/en/coins/${selected.id}`,
        explanation:
          `PRISM dynamically discovered this ${CHAIN_LABELS[mappedChain]} token contract from CoinGecko's project metadata. ` +
          "It is a project-linked token contract, not evidence of a treasury, team or investor wallet.",
      });
    }

    const deduped = Array.from(
      new Map(accounts.map((account) => [`${account.chain}:${account.address.toLowerCase()}`, account])).values()
    );

    return { accounts: deduped, resolvedName: name };
  } catch {
    return { accounts: [], resolvedName: null };
  }
}

export async function GET(request: NextRequest) {
  try {
    const project = request.nextUrl.searchParams.get("project")?.trim();
    const chainParam = request.nextUrl.searchParams
      .get("chain")
      ?.trim()
      .toLowerCase();

    if (!project) {
      return NextResponse.json(
        { error: "A project name or symbol is required." },
        { status: 400 }
      );
    }

    let chain: SupportedChain | undefined;

    if (chainParam) {
      if (!isSupportedChain(chainParam)) {
        return NextResponse.json(
          {
            error: "Unsupported chain.",
            supportedChains: VALID_CHAINS,
          },
          { status: 400 }
        );
      }
      chain = chainParam;
    }

    const normalized = normalizeProjectQuery(project);

    const aliasMap: Record<string, string> = {
      ens: "ENS DAO",
      "ethereum name service": "ENS DAO",
      aave: "Aave DAO",
      "aave dao": "Aave DAO",
      uni: "Uniswap DAO",
      uniswap: "Uniswap DAO",
      "uniswap dao": "Uniswap DAO",
      arb: "Arbitrum DAO",
      arbitrum: "Arbitrum DAO",
      "arbitrum dao": "Arbitrum DAO",
      sol: "Solana",
      solana: "Solana",
      op: "Optimism Collective",
      optimism: "Optimism Collective",
      "optimism collective": "Optimism Collective",
      ldo: "Lido DAO",
      lido: "Lido DAO",
      "lido dao": "Lido DAO",
      comp: "Compound",
      compound: "Compound",
      "compound finance": "Compound",
      cys: "Cysic",
      cysic: "Cysic",
      sushi: "Sushi DAO",
      "sushi dao": "Sushi DAO",
      sushiswap: "Sushi DAO",
      pol: "Polygon",
      matic: "Polygon",
      polygon: "Polygon",
      "polygon pos": "Polygon",
      cvx: "Convex Finance",
      convex: "Convex Finance",
      "convex finance": "Convex Finance",
      fxs: "Frax Finance",
      frax: "Frax Finance",
      "frax finance": "Frax Finance",
      eth: "Ethereum",
      ethereum: "Ethereum",
      bnb: "BNB Chain",
      "bnb chain": "BNB Chain",
      binance: "BNB Chain",
      ondo: "Ondo Finance",
      "ondo finance": "Ondo Finance",
      pepe: "Pepe",
      pengu: "Pudgy Penguins",
      "pudgy penguins": "Pudgy Penguins",
      avax: "Avalanche",
      avalanche: "Avalanche",
      link: "Chainlink",
      chainlink: "Chainlink",
      render: "Render Network",
      rndr: "Render Network",
      "render network": "Render Network",
      fet: "Fetch.ai",
      fetch: "Fetch.ai",
      "fetch.ai": "Fetch.ai",
      "artificial superintelligence alliance": "Fetch.ai",
      jup: "Jupiter",
      jupiter: "Jupiter",
    };

    const resolvedProject = aliasMap[normalized] ?? project;
    const curatedAccounts = getProjectWallets(resolvedProject, chain);

    let accounts: Array<ReturnType<typeof getProjectWallets>[number] | DynamicAccount> = curatedAccounts;
    let discovery: "curated" | "dynamic_contracts" | "none" =
      curatedAccounts.length > 0 ? "curated" : "none";
    let dynamicResolvedName: string | null = null;

    if (accounts.length === 0) {
      const dynamic = await discoverProjectContracts(project, chain);
      accounts = dynamic.accounts;
      dynamicResolvedName = dynamic.resolvedName;
      if (accounts.length > 0) discovery = "dynamic_contracts";
    }

    const chains = Array.from(new Set(accounts.map((account) => account.chain)));

    const normalizedAccounts = accounts.map((account) => ({
      address: account.address,
      addressShort:
        account.chain === "solana"
          ? `${account.address.slice(0, 5)}...${account.address.slice(-5)}`
          : `${account.address.slice(0, 6)}...${account.address.slice(-4)}`,
      project: account.project,
      symbol: account.symbol ?? null,
      chain: account.chain,
      label: account.label,
      accountType: account.accountType,
      walletType: account.walletType,
      isWallet: account.isWallet,
      confidence: account.confidence,
      source: account.source,
      sourceUrl: account.sourceUrl,
      explanation: account.explanation,
    }));

    return NextResponse.json({
      query: project,
      resolvedProject: dynamicResolvedName ?? resolvedProject,
      requestedChain: chain ?? null,
      count: normalizedAccounts.length,
      chains,
      accounts: normalizedAccounts,
      wallets: normalizedAccounts,
      discovery,
      discoveryMessage:
        discovery === "dynamic_contracts"
          ? "PRISM found project-linked token contracts dynamically. These contracts are useful investigation anchors but are not automatically treasury, team or investor wallets."
          : discovery === "none"
          ? "PRISM did not find a public project account it could attribute with sufficient evidence."
          : "PRISM returned accounts from its reviewed attribution registry.",
    });
  } catch (error) {
    console.error("PRISM project account API error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Something went wrong while retrieving project accounts.",
      },
      { status: 500 }
    );
  }
}

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

function normalizeProjectQuery(value: string) {
  return value.trim().toLowerCase();
}

function isSupportedChain(value: string): value is SupportedChain {
  return VALID_CHAINS.includes(value as SupportedChain);
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
      arb: "Arbitrum DAO",
      arbitrum: "Arbitrum DAO",
      sol: "Solana",
      solana: "Solana",
      op: "Optimism",
      optimism: "Optimism",
    };

    const resolvedProject = aliasMap[normalized] ?? project;
    const accounts = getProjectWallets(resolvedProject, chain);
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
      resolvedProject,
      requestedChain: chain ?? null,
      count: accounts.length,
      chains,
      accounts: normalizedAccounts,
      wallets: normalizedAccounts,
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

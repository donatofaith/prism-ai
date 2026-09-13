import { NextRequest, NextResponse } from "next/server";

type Direction = "incoming" | "outgoing" | "neutral";
type SolanaActivityType =
  | "sol_transfer"
  | "token_transfer"
  | "program_activity"
  | "transaction";
type SolanaAccountKind = "wallet" | "token-account" | "mint" | "program" | "account";

type SolanaSignature = {
  signature: string;
  slot: number;
  blockTime: number | null;
  err: unknown | null;
  memo: string | null;
  confirmationStatus?: string | null;
};

type SolanaTokenAmount = {
  amount?: string;
  decimals?: number;
  uiAmount?: number | null;
  uiAmountString?: string;
};

type SolanaTokenBalance = {
  accountIndex?: number;
  mint?: string;
  owner?: string;
  uiTokenAmount?: SolanaTokenAmount;
};

type ParsedAccountInfo = {
  executable?: boolean;
  owner?: string;
  data?: {
    program?: string;
    parsed?: {
      type?: string;
      info?: Record<string, unknown>;
    };
  };
};

type SolanaTransaction = {
  blockTime?: number | null;
  slot?: number;
  meta?: {
    err?: unknown | null;
    fee?: number;
    preBalances?: number[];
    postBalances?: number[];
    preTokenBalances?: SolanaTokenBalance[];
    postTokenBalances?: SolanaTokenBalance[];
    innerInstructions?: unknown[];
  } | null;
  transaction?: {
    signatures?: string[];
    message?: {
      accountKeys?: Array<
        | string
        | { pubkey?: string; signer?: boolean; writable?: boolean }
      >;
      instructions?: unknown[];
    };
  };
};

type SolanaActivity = {
  signature: string;
  timestamp: string | null;
  slot: number | null;
  direction: Direction;
  type: SolanaActivityType;
  asset: string;
  mint: string | null;
  amount: number | null;
  feeSol: number | null;
  explorerUrl: string;
  status: "success" | "failed";
  note: string;
  verification: "native" | "verified" | "unverified";
  usdPrice?: number | null;
  usdValue?: number | null;
  usdValueBasis?: "current_market_price" | null;
};

type MintMarket = {
  symbol: string | null;
  name: string | null;
  priceUsd: number | null;
};

const LAMPORTS_PER_SOL = 1_000_000_000;
const SYSTEM_PROGRAM = "11111111111111111111111111111111";
const SOLANA_RPC_CANDIDATES = [
  process.env.PRISM_SOLANA_RPC_URL,
  process.env.ALCHEMY_API_KEY
    ? `https://solana-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`
    : null,
  "https://solana-rpc.publicnode.com",
  "https://api.mainnet-beta.solana.com",
].filter(Boolean) as string[];

function looksLikeSolanaAddress(value: string) {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value);
}

function timestampToIso(timestamp?: number | null) {
  return timestamp ? new Date(timestamp * 1000).toISOString() : null;
}

function safeNumber(value: string | number | null | undefined) {
  if (value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function getAccountKey(account: string | { pubkey?: string } | undefined) {
  if (!account) return "";
  return typeof account === "string" ? account : account.pubkey ?? "";
}

function short(value: string) {
  return value.length > 16 ? `${value.slice(0, 6)}...${value.slice(-5)}` : value;
}

function formatUsd(value: number) {
  return `$${value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

async function rpcResult<T>(method: string, params: unknown[], id = 1): Promise<T> {
  let lastError = `Solana RPC request failed for ${method}.`;

  for (const url of SOLANA_RPC_CANDIDATES) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
        cache: "no-store",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.error) {
        lastError = data?.error?.message || lastError;
        continue;
      }
      return data.result as T;
    } catch (error) {
      lastError = error instanceof Error ? error.message : lastError;
    }
  }

  throw new Error(lastError);
}

async function classifyAccount(address: string) {
  try {
    const value = await rpcResult<ParsedAccountInfo | null>(
      "getAccountInfo",
      [address, { encoding: "jsonParsed", commitment: "confirmed" }],
      2
    );

    if (!value) {
      return { kind: "account" as SolanaAccountKind, owner: null, parsedType: null };
    }

    const parsedType = value.data?.parsed?.type ?? null;
    if (value.executable) {
      return { kind: "program" as SolanaAccountKind, owner: value.owner ?? null, parsedType };
    }
    if (parsedType === "mint") {
      return { kind: "mint" as SolanaAccountKind, owner: value.owner ?? null, parsedType };
    }
    if (parsedType === "account") {
      return { kind: "token-account" as SolanaAccountKind, owner: value.owner ?? null, parsedType };
    }
    if (value.owner === SYSTEM_PROGRAM) {
      return { kind: "wallet" as SolanaAccountKind, owner: value.owner, parsedType };
    }

    return { kind: "account" as SolanaAccountKind, owner: value.owner ?? null, parsedType };
  } catch {
    return { kind: "account" as SolanaAccountKind, owner: null, parsedType: null };
  }
}

async function getRecentSignatures(address: string) {
  return (
    (await rpcResult<SolanaSignature[]>(
      "getSignaturesForAddress",
      [address, { limit: 16, commitment: "confirmed" }],
      3
    )) ?? []
  );
}

async function getTransaction(signature: string, id: number) {
  return await rpcResult<SolanaTransaction | null>(
    "getTransaction",
    [
      signature,
      {
        commitment: "confirmed",
        encoding: "jsonParsed",
        maxSupportedTransactionVersion: 0,
      },
    ],
    id
  );
}

function transactionKeys(transaction: SolanaTransaction) {
  return transaction.transaction?.message?.accountKeys ?? [];
}

function scannedIndexes(address: string, transaction: SolanaTransaction) {
  const result = new Set<number>();
  transactionKeys(transaction).forEach((key, index) => {
    if (getAccountKey(key) === address) result.add(index);
  });
  return result;
}

function calculateSolChange(address: string, transaction: SolanaTransaction) {
  const index = transactionKeys(transaction).findIndex(
    (account) => getAccountKey(account) === address
  );
  if (index < 0) return null;
  const pre = transaction.meta?.preBalances?.[index];
  const post = transaction.meta?.postBalances?.[index];
  if (typeof pre !== "number" || typeof post !== "number") return null;
  return (post - pre) / LAMPORTS_PER_SOL;
}

function tokenBalanceValue(balance: SolanaTokenBalance) {
  return (
    balance.uiTokenAmount?.uiAmount ??
    safeNumber(balance.uiTokenAmount?.uiAmountString) ??
    0
  );
}

function tokenChangesForAccount(address: string, transaction: SolanaTransaction) {
  const indexes = scannedIndexes(address, transaction);
  const collect = (balances: SolanaTokenBalance[] | undefined) => {
    const map = new Map<string, number>();
    for (const balance of balances ?? []) {
      if (!balance.mint) continue;
      const belongsToAddress =
        balance.owner === address ||
        (typeof balance.accountIndex === "number" && indexes.has(balance.accountIndex));
      if (!belongsToAddress) continue;
      map.set(balance.mint, (map.get(balance.mint) ?? 0) + tokenBalanceValue(balance));
    }
    return map;
  };

  const pre = collect(transaction.meta?.preTokenBalances);
  const post = collect(transaction.meta?.postTokenBalances);
  const mints = new Set([...pre.keys(), ...post.keys()]);
  return Array.from(mints)
    .map((mint) => ({ mint, change: (post.get(mint) ?? 0) - (pre.get(mint) ?? 0) }))
    .filter((item) => Math.abs(item.change) > 1e-9);
}

function tokenChangesForMint(mint: string, transaction: SolanaTransaction) {
  const pre = new Map<number, number>();
  const post = new Map<number, number>();

  for (const balance of transaction.meta?.preTokenBalances ?? []) {
    if (balance.mint !== mint || typeof balance.accountIndex !== "number") continue;
    pre.set(balance.accountIndex, tokenBalanceValue(balance));
  }
  for (const balance of transaction.meta?.postTokenBalances ?? []) {
    if (balance.mint !== mint || typeof balance.accountIndex !== "number") continue;
    post.set(balance.accountIndex, tokenBalanceValue(balance));
  }

  const indexes = new Set([...pre.keys(), ...post.keys()]);
  return Array.from(indexes)
    .map((index) => ({
      mint,
      accountIndex: index,
      account: getAccountKey(transactionKeys(transaction)[index]),
      change: (post.get(index) ?? 0) - (pre.get(index) ?? 0),
    }))
    .filter((item) => Math.abs(item.change) > 1e-9);
}

async function getSolPrice() {
  try {
    const response = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd",
      { cache: "no-store", headers: { accept: "application/json" } }
    );
    if (!response.ok) return null;
    const data = await response.json();
    const price = Number(data?.solana?.usd);
    return Number.isFinite(price) && price > 0 ? price : null;
  } catch {
    return null;
  }
}

async function getMintMarkets(mints: string[]) {
  const markets = new Map<string, MintMarket>();
  const unique = Array.from(new Set(mints.filter(Boolean)));
  if (!unique.length) return markets;

  try {
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/token_price/solana?contract_addresses=${encodeURIComponent(
        unique.join(",")
      )}&vs_currencies=usd`,
      { cache: "no-store", headers: { accept: "application/json" } }
    );
    if (response.ok) {
      const data = await response.json();
      for (const mint of unique) {
        const price = Number(data?.[mint]?.usd);
        if (Number.isFinite(price) && price > 0) {
          markets.set(mint, { symbol: null, name: null, priceUsd: price });
        }
      }
    }
  } catch {
    // Best-effort only.
  }

  const missing = unique.filter((mint) => !markets.has(mint));
  for (const mint of missing.slice(0, 8)) {
    try {
      const response = await fetch(
        `https://api.dexscreener.com/latest/dex/tokens/${encodeURIComponent(mint)}`,
        { cache: "no-store", headers: { accept: "application/json" } }
      );
      if (!response.ok) continue;
      const data = await response.json();
      const pairs = (Array.isArray(data?.pairs) ? data.pairs : [])
        .filter(
          (pair: any) =>
            pair?.chainId === "solana" &&
            pair?.baseToken?.address === mint &&
            Number(pair?.priceUsd) > 0
        )
        .sort(
          (a: any, b: any) =>
            Number(b?.liquidity?.usd ?? 0) - Number(a?.liquidity?.usd ?? 0)
        );
      const pair = pairs[0];
      if (!pair) continue;
      markets.set(mint, {
        symbol: pair?.baseToken?.symbol ?? null,
        name: pair?.baseToken?.name ?? null,
        priceUsd: Number(pair?.priceUsd) || null,
      });
    } catch {
      // Leave unknown mints as mint-address evidence rather than inventing identity.
    }
  }

  return markets;
}

function buildActivity(
  address: string,
  kind: SolanaAccountKind,
  signatureData: SolanaSignature,
  transaction: SolanaTransaction
): SolanaActivity[] {
  const timestamp = timestampToIso(transaction.blockTime ?? signatureData.blockTime);
  const signature = signatureData.signature;
  const explorerUrl = `https://solscan.io/tx/${signature}`;
  const status: "success" | "failed" =
    transaction.meta?.err || signatureData.err ? "failed" : "success";
  const feeSol =
    typeof transaction.meta?.fee === "number"
      ? transaction.meta.fee / LAMPORTS_PER_SOL
      : null;
  const common = {
    signature,
    timestamp,
    slot: transaction.slot ?? signatureData.slot ?? null,
    feeSol,
    explorerUrl,
    status,
  };
  const results: SolanaActivity[] = [];

  if (kind === "mint") {
    const changes = tokenChangesForMint(address, transaction);
    for (const change of changes) {
      const direction: Direction = change.change > 0 ? "incoming" : "outgoing";
      results.push({
        ...common,
        direction,
        type: "token_transfer",
        asset: `SPL ${short(address)}`,
        mint: address,
        amount: Math.abs(change.change),
        verification: "unverified",
        note: `${Math.abs(change.change).toLocaleString("en-US", {
          maximumFractionDigits: 9,
        })} units changed in token account ${short(change.account || `#${change.accountIndex}`)} during a transaction referencing this mint.`,
      });
    }

    if (!results.length) {
      results.push({
        ...common,
        direction: "neutral",
        type: "transaction",
        asset: `SPL ${short(address)}`,
        mint: address,
        amount: null,
        verification: "unverified",
        note:
          "This transaction referenced the token mint, but the available pre/post balances did not expose a non-zero mint balance delta. PRISM does not invent a transfer value when the RPC evidence is incomplete.",
      });
    }
    return results;
  }

  if (kind === "program") {
    return [
      {
        ...common,
        direction: "neutral",
        type: "program_activity",
        asset: "PROGRAM",
        mint: null,
        amount: null,
        verification: "unverified",
        note:
          "This executable Solana program participated in the transaction. Program invocations do not necessarily create a direct SOL or SPL balance change on the program address itself.",
      },
    ];
  }

  const solChange = calculateSolChange(address, transaction);
  if (solChange !== null && Math.abs(solChange) > 1e-9) {
    const direction: Direction = solChange > 0 ? "incoming" : "outgoing";
    results.push({
      ...common,
      direction,
      type: "sol_transfer",
      asset: "SOL",
      mint: null,
      amount: Math.abs(solChange),
      verification: "native",
      note:
        direction === "incoming"
          ? "The account's SOL balance increased during this transaction."
          : "The account's SOL balance decreased during this transaction. This balance change may include transaction fees.",
    });
  }

  for (const tokenChange of tokenChangesForAccount(address, transaction)) {
    const direction: Direction = tokenChange.change > 0 ? "incoming" : "outgoing";
    results.push({
      ...common,
      direction,
      type: "token_transfer",
      asset: `SPL ${short(tokenChange.mint)}`,
      mint: tokenChange.mint,
      amount: Math.abs(tokenChange.change),
      verification: "unverified",
      note:
        direction === "incoming"
          ? "An SPL-token balance linked to this account increased during the transaction."
          : "An SPL-token balance linked to this account decreased during the transaction.",
    });
  }

  if (!results.length) {
    results.push({
      ...common,
      direction: "neutral",
      type: "transaction",
      asset: kind === "token-account" ? "TOKEN ACCOUNT" : "SOLANA",
      mint: null,
      amount: null,
      verification: "unverified",
      note:
        "The account participated in this confirmed transaction, but PRISM did not observe a direct SOL or SPL balance delta for this address. The transaction is kept as participation evidence rather than being mislabeled as a transfer.",
    });
  }

  return results;
}

async function enrichMarketValues(activity: SolanaActivity[]) {
  const mints = activity.map((item) => item.mint).filter(Boolean) as string[];
  const needsSol = activity.some((item) => item.asset === "SOL" && item.amount !== null);
  const [markets, solPrice] = await Promise.all([
    getMintMarkets(mints),
    needsSol ? getSolPrice() : Promise.resolve(null),
  ]);

  return activity.map((item) => {
    const market = item.mint ? markets.get(item.mint) : null;
    const price = item.asset === "SOL" ? solPrice : market?.priceUsd ?? null;
    const amount = item.amount;
    const usdValue =
      amount !== null && price !== null && Number.isFinite(amount * price)
        ? amount * price
        : null;
    const asset =
      item.mint && market?.symbol ? market.symbol.toUpperCase() : item.asset;
    const valueText = usdValue !== null ? ` Estimated current value: ≈ ${formatUsd(usdValue)}.` : "";

    return {
      ...item,
      asset,
      usdPrice: price,
      usdValue,
      usdValueBasis: usdValue !== null ? ("current_market_price" as const) : null,
      note: `${item.note}${valueText}`,
    };
  });
}

export async function GET(request: NextRequest) {
  try {
    const address = request.nextUrl.searchParams.get("address")?.trim();
    if (!address) {
      return NextResponse.json({ error: "A Solana account or mint address is required." }, { status: 400 });
    }
    if (!looksLikeSolanaAddress(address)) {
      return NextResponse.json({ error: "Enter a valid Solana account or mint address." }, { status: 400 });
    }

    const account = await classifyAccount(address);
    const signatures = await getRecentSignatures(address);

    if (!signatures.length) {
      return NextResponse.json({
        chain: "solana",
        chainName: "Solana Mainnet",
        walletScanner: "solana",
        accountKind: account.kind,
        address,
        addressShort: short(address),
        summary: {
          transactions: 0,
          activityItems: 0,
          incoming: 0,
          outgoing: 0,
          neutral: 0,
          solMovements: 0,
          tokenMovements: 0,
          programActivities: 0,
        },
        activity: [],
        intelligence: {
          status: "normal",
          headline: "No recent Solana activity found",
          explanation: `PRISM identified this address as a Solana ${account.kind} and did not find recent confirmed transactions in the current activity window.`,
          verificationPolicy:
            "PRISM distinguishes wallets, token accounts, token mints and executable programs before interpreting activity.",
          interpretationPolicy:
            "Observable activity is context only. PRISM does not infer buying, selling, ownership intent or future market direction from participation alone.",
        },
      });
    }

    const transactions = await Promise.all(
      signatures.map(async (signature, index) => {
        try {
          return {
            signature,
            transaction: await getTransaction(signature.signature, index + 20),
          };
        } catch (error) {
          console.error(`Unable to load Solana transaction ${signature.signature}:`, error);
          return { signature, transaction: null };
        }
      })
    );

    const rawActivity: SolanaActivity[] = [];
    for (const item of transactions) {
      if (!item.transaction) continue;
      rawActivity.push(...buildActivity(address, account.kind, item.signature, item.transaction));
    }

    rawActivity.sort((a, b) => {
      const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return timeB - timeA;
    });

    const movements = rawActivity.filter((item) => item.direction !== "neutral");
    const neutral = rawActivity.filter((item) => item.direction === "neutral");
    const selected =
      movements.length > 0
        ? [...movements.slice(0, 16), ...neutral.slice(0, 4)].slice(0, 20)
        : neutral.slice(0, account.kind === "program" || account.kind === "mint" ? 12 : 6);
    const activity = await enrichMarketValues(selected);

    const incoming = activity.filter((item) => item.direction === "incoming");
    const outgoing = activity.filter((item) => item.direction === "outgoing");
    const neutralItems = activity.filter((item) => item.direction === "neutral");
    const solMovements = activity.filter((item) => item.type === "sol_transfer");
    const tokenMovements = activity.filter((item) => item.type === "token_transfer");
    const programActivities = activity.filter((item) => item.type === "program_activity");
    const failed = activity.filter((item) => item.status === "failed");

    const modeExplanation =
      account.kind === "mint"
        ? "PRISM identified this address as an SPL-token mint. It reviews transactions referencing the mint and reconstructs token-account balance deltas where the RPC exposes them."
        : account.kind === "program"
        ? "PRISM identified this address as an executable Solana program. Program participation is shown as invocation evidence because programs do not normally hold transfer balances like wallets."
        : account.kind === "token-account"
        ? "PRISM identified this address as an SPL-token account and tracks balance changes at the token-account index as well as owner-linked token balances."
        : `PRISM identified this address as a Solana ${account.kind} and reviewed its recent confirmed transactions.`;

    return NextResponse.json({
      chain: "solana",
      chainName: "Solana Mainnet",
      walletScanner: "solana",
      accountKind: account.kind,
      address,
      addressShort: short(address),
      summary: {
        transactions: signatures.length,
        activityItems: activity.length,
        incoming: incoming.length,
        outgoing: outgoing.length,
        neutral: neutralItems.length,
        solMovements: solMovements.length,
        tokenMovements: tokenMovements.length,
        programActivities: programActivities.length,
        failedActivities: failed.length,
      },
      activity,
      pricing: {
        basis: "current_market_price",
        note:
          "USD values, when available, use the latest market quote and are not transaction-time valuations.",
      },
      intelligence: {
        status: movements.length || programActivities.length ? "attention" : "normal",
        headline:
          account.kind === "program"
            ? `${programActivities.length} recent program participation event${programActivities.length === 1 ? "" : "s"} available for review`
            : `${movements.length} observable balance movement${movements.length === 1 ? "" : "s"} found`,
        explanation: modeExplanation,
        verificationPolicy:
          "PRISM classifies the Solana address first so wallets, token accounts, token mints and executable programs are not interpreted as if they were the same kind of account. SPL identity is only named when market metadata for the exact mint is available.",
        interpretationPolicy:
          "PRISM reports observable balance changes and program participation. Incoming, outgoing or program activity does not by itself prove buying, selling, investment intent, project ownership or future price direction.",
      },
    });
  } catch (error) {
    console.error("PRISM Solana wallet API error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Something went wrong while retrieving Solana activity.",
      },
      { status: 503 }
    );
  }
}

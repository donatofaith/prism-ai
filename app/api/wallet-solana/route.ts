import { NextRequest, NextResponse } from "next/server";

type SolanaSignature = {
  signature: string;
  slot: number;
  blockTime: number | null;
  err: unknown | null;
  memo: string | null;
  confirmationStatus?: string | null;
};

type SolanaSignatureResponse = {
  jsonrpc?: string;
  id?: number;
  result?: SolanaSignature[];
  error?: {
    code?: number;
    message?: string;
  };
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

type SolanaTransactionResponse = {
  jsonrpc?: string;
  id?: number;

  result?: {
    blockTime?: number | null;
    slot?: number;

    meta?: {
      err?: unknown | null;

      fee?: number;

      preBalances?: number[];
      postBalances?: number[];

      preTokenBalances?: SolanaTokenBalance[];
      postTokenBalances?: SolanaTokenBalance[];
    } | null;

    transaction?: {
      signatures?: string[];

      message?: {
        accountKeys?: Array<
          | string
          | {
              pubkey?: string;
              signer?: boolean;
              writable?: boolean;
            }
        >;
      };
    };
  } | null;

  error?: {
    code?: number;
    message?: string;
  };
};

type SolanaActivityType =
  | "sol_transfer"
  | "token_transfer"
  | "transaction";

type Direction =
  | "incoming"
  | "outgoing"
  | "neutral";

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

  status:
    | "success"
    | "failed";

  note: string;

  verification:
    | "native"
    | "unverified";
};

const SOLANA_RPC_BASE =
  "https://solana-mainnet.g.alchemy.com/v2";

const LAMPORTS_PER_SOL =
  1_000_000_000;

/*
  Base58 characters exclude:
  0, O, I and l.

  A Solana public key is normally
  32 bytes represented as roughly
  32-44 Base58 characters.
*/
function looksLikeSolanaAddress(
  address: string
) {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(
    address
  );
}

function timestampToIso(
  timestamp?: number | null
) {
  if (!timestamp) {
    return null;
  }

  return new Date(
    timestamp * 1000
  ).toISOString();
}

function lamportsToSol(
  lamports: number
) {
  return (
    lamports /
    LAMPORTS_PER_SOL
  );
}

function safeNumber(
  value:
    string |
    number |
    null |
    undefined
) {
  if (
    value === null ||
    value === undefined
  ) {
    return null;
  }

  const number =
    Number(value);

  if (
    !Number.isFinite(
      number
    )
  ) {
    return null;
  }

  return number;
}

function getAccountKey(
  account:
    | string
    | {
        pubkey?: string;
      }
    | undefined
) {
  if (!account) {
    return "";
  }

  if (
    typeof account ===
    "string"
  ) {
    return account;
  }

  return (
    account.pubkey ??
    ""
  );
}

async function solanaRpc<T>(
  apiKey: string,
  method: string,
  params: unknown[],
  id: number
): Promise<T> {
  const response =
    await fetch(
      `${SOLANA_RPC_BASE}/${apiKey}`,
      {
        method:
          "POST",

        headers: {
          "Content-Type":
            "application/json",

          Accept:
            "application/json",
        },

        body:
          JSON.stringify({
            jsonrpc:
              "2.0",

            id,

            method,

            params,
          }),

        cache:
          "no-store",
      }
    );

  const data =
    await response.json();

  if (
    !response.ok ||
    data.error
  ) {
    throw new Error(
      data.error?.message ||
        `Solana RPC request failed for ${method}.`
    );
  }

  return data as T;
}

async function getRecentSignatures(
  apiKey: string,
  wallet: string
) {
  const response =
    await solanaRpc<SolanaSignatureResponse>(
      apiKey,

      "getSignaturesForAddress",

      [
        wallet,

        {
          limit:
            12,

          commitment:
            "confirmed",
        },
      ],

      1
    );

  return (
    response.result ??
    []
  );
}

async function getTransaction(
  apiKey: string,
  signature: string,
  id: number
) {
  const response =
    await solanaRpc<SolanaTransactionResponse>(
      apiKey,

      "getTransaction",

      [
        signature,

        {
          commitment:
            "confirmed",

          encoding:
            "jsonParsed",

          maxSupportedTransactionVersion:
            0,
        },
      ],

      id
    );

  return (
    response.result ??
    null
  );
}

function calculateSolChange(
  wallet: string,
  transaction:
    NonNullable<
      SolanaTransactionResponse["result"]
    >
) {
  const keys =
    transaction.transaction
      ?.message
      ?.accountKeys ??
    [];

  const walletIndex =
    keys.findIndex(
      (account) =>
        getAccountKey(
          account
        ) === wallet
    );

  if (
    walletIndex === -1
  ) {
    return null;
  }

  const pre =
    transaction.meta
      ?.preBalances?.[
        walletIndex
      ];

  const post =
    transaction.meta
      ?.postBalances?.[
        walletIndex
      ];

  if (
    typeof pre !==
      "number" ||
    typeof post !==
      "number"
  ) {
    return null;
  }

  return lamportsToSol(
    post - pre
  );
}

function getWalletTokenBalances(
  wallet: string,
  balances:
    SolanaTokenBalance[] |
    undefined
) {
  const map =
    new Map<
      string,
      number
    >();

  for (
    const balance of
    balances ?? []
  ) {
    if (
      balance.owner !==
      wallet
    ) {
      continue;
    }

    if (
      !balance.mint
    ) {
      continue;
    }

    const amount =
      balance.uiTokenAmount
        ?.uiAmount ??
      safeNumber(
        balance
          .uiTokenAmount
          ?.uiAmountString
      ) ??
      0;

    const existing =
      map.get(
        balance.mint
      ) ??
      0;

    map.set(
      balance.mint,
      existing +
        amount
    );
  }

  return map;
}

function calculateTokenChanges(
  wallet: string,
  transaction:
    NonNullable<
      SolanaTransactionResponse["result"]
    >
) {
  const preBalances =
    getWalletTokenBalances(
      wallet,

      transaction.meta
        ?.preTokenBalances
    );

  const postBalances =
    getWalletTokenBalances(
      wallet,

      transaction.meta
        ?.postTokenBalances
    );

  const mints =
    new Set([
      ...preBalances.keys(),
      ...postBalances.keys(),
    ]);

  const changes: Array<{
    mint: string;
    change: number;
  }> = [];

  for (
    const mint of
    mints
  ) {
    const before =
      preBalances.get(
        mint
      ) ??
      0;

    const after =
      postBalances.get(
        mint
      ) ??
      0;

    const change =
      after -
      before;

    /*
      Ignore tiny floating-point
      leftovers.
    */
    if (
      Math.abs(
        change
      ) <
      0.000000001
    ) {
      continue;
    }

    changes.push({
      mint,
      change,
    });
  }

  return changes;
}

function buildTransactionActivity(
  wallet: string,
  signatureData: SolanaSignature,
  transaction:
    NonNullable<
      SolanaTransactionResponse["result"]
    >
): SolanaActivity[] {
  const results:
    SolanaActivity[] =
      [];

  const timestamp =
    timestampToIso(
      transaction.blockTime ??
        signatureData.blockTime
    );

  const signature =
    signatureData.signature;

  const explorerUrl =
    `https://solscan.io/tx/${signature}`;

  const status:
    | "success"
    | "failed" =
    transaction.meta?.err ||
    signatureData.err
      ? "failed"
      : "success";

  const feeSol =
    typeof transaction.meta
      ?.fee ===
    "number"
      ? lamportsToSol(
          transaction.meta.fee
        )
      : null;

  const solChange =
    calculateSolChange(
      wallet,
      transaction
    );

  /*
    The fee is paid by the transaction
    fee payer, so a wallet's raw SOL
    balance change can include fees.

    PRISM describes this as a balance
    change rather than claiming every
    change is a simple transfer.
  */
  if (
    solChange !== null &&
    Math.abs(
      solChange
    ) >
      0.000000001
  ) {
    const direction:
      Direction =
      solChange > 0
        ? "incoming"
        : "outgoing";

    results.push({
      signature,

      timestamp,

      slot:
        transaction.slot ??
        signatureData.slot ??
        null,

      direction,

      type:
        "sol_transfer",

      asset:
        "SOL",

      mint:
        null,

      amount:
        Math.abs(
          solChange
        ),

      feeSol,

      explorerUrl,

      status,

      verification:
        "native",

      note:
        direction ===
        "incoming"
          ? "The wallet's SOL balance increased during this transaction."
          : "The wallet's SOL balance decreased during this transaction. This balance change may include transaction fees.",
    });
  }

  const tokenChanges =
    calculateTokenChanges(
      wallet,
      transaction
    );

  for (
    const tokenChange of
    tokenChanges
  ) {
    const direction:
      Direction =
      tokenChange.change >
      0
        ? "incoming"
        : "outgoing";

    results.push({
      signature,

      timestamp,

      slot:
        transaction.slot ??
        signatureData.slot ??
        null,

      direction,

      type:
        "token_transfer",

      asset:
        "SPL Token",

      mint:
        tokenChange.mint,

      amount:
        Math.abs(
          tokenChange.change
        ),

      feeSol,

      explorerUrl,

      status,

      verification:
        "unverified",

      note:
        direction ===
        "incoming"
          ? "An SPL token balance increased in this wallet during the transaction."
          : "An SPL token balance decreased in this wallet during the transaction.",
    });
  }

  /*
    Some transactions involve the
    wallet without changing its SOL
    or token balance.

    Keep one neutral activity record
    instead of silently dropping it.
  */
  if (
    results.length ===
    0
  ) {
    results.push({
      signature,

      timestamp,

      slot:
        transaction.slot ??
        signatureData.slot ??
        null,

      direction:
        "neutral",

      type:
        "transaction",

      asset:
        "SOLANA",

      mint:
        null,

      amount:
        null,

      feeSol,

      explorerUrl,

      status,

      verification:
        "unverified",

      note:
        "The wallet participated in this transaction, but PRISM did not detect a direct SOL or SPL token balance change.",
    });
  }

  return results;
}

export async function GET(
  request:
    NextRequest
) {
  try {
    const apiKey =
      process.env
        .ALCHEMY_API_KEY;

    if (
      !apiKey
    ) {
      return NextResponse.json(
        {
          error:
            "Alchemy API key is not configured on the server.",
        },

        {
          status:
            500,
        }
      );
    }

    const wallet =
      request.nextUrl
        .searchParams
        .get(
          "address"
        )
        ?.trim();

    if (
      !wallet
    ) {
      return NextResponse.json(
        {
          error:
            "A Solana wallet address is required.",
        },

        {
          status:
            400,
        }
      );
    }

    if (
      !looksLikeSolanaAddress(
        wallet
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Enter a valid Solana wallet address.",
        },

        {
          status:
            400,
        }
      );
    }

    const signatures =
      await getRecentSignatures(
        apiKey,
        wallet
      );

    if (
      signatures.length ===
      0
    ) {
      return NextResponse.json({
        chain:
          "solana",

        chainName:
          "Solana Mainnet",

        walletScanner:
          "solana",

        address:
          wallet,

        addressShort:
          `${wallet.slice(
            0,
            5
          )}...${wallet.slice(
            -5
          )}`,

        summary: {
          transactions:
            0,

          activityItems:
            0,

          incoming:
            0,

          outgoing:
            0,

          neutral:
            0,

          solMovements:
            0,

          tokenMovements:
            0,
        },

        activity:
          [],

        intelligence: {
          status:
            "normal",

          headline:
            "No recent Solana activity found",

          explanation:
            "PRISM did not find recent confirmed transactions for this address in the current activity window.",

          interpretationPolicy:
            "PRISM reports observable Solana balance changes. A balance increase or decrease alone does not prove buying, selling, investment intent, or ownership intent.",
        },
      });
    }

    /*
      Fetch transaction details in
      parallel.

      Keep this window deliberately
      small so the hackathon build
      remains fast and avoids sending
      dozens of expensive requests.
    */
    const transactionResults =
      await Promise.all(
        signatures.map(
          async (
            signature,
            index
          ) => {
            try {
              const transaction =
                await getTransaction(
                  apiKey,

                  signature.signature,

                  index + 10
                );

              return {
                signature,
                transaction,
              };
            } catch (
              error
            ) {
              console.error(
                `Unable to load Solana transaction ${signature.signature}:`,
                error
              );

              return {
                signature,
                transaction:
                  null,
              };
            }
          }
        )
      );

    const activity:
      SolanaActivity[] =
        [];

    for (
      const item of
      transactionResults
    ) {
      if (
        !item.transaction
      ) {
        continue;
      }

      activity.push(
        ...buildTransactionActivity(
          wallet,
          item.signature,
          item.transaction
        )
      );
    }

    activity.sort(
      (
        a,
        b
      ) => {
        const timeA =
          a.timestamp
            ? new Date(
                a.timestamp
              ).getTime()
            : 0;

        const timeB =
          b.timestamp
            ? new Date(
                b.timestamp
              ).getTime()
            : 0;

        return (
          timeB -
          timeA
        );
      }
    );

    const incoming =
      activity.filter(
        (item) =>
          item.direction ===
          "incoming"
      );

    const outgoing =
      activity.filter(
        (item) =>
          item.direction ===
          "outgoing"
      );

    const neutral =
      activity.filter(
        (item) =>
          item.direction ===
          "neutral"
      );

    const solMovements =
      activity.filter(
        (item) =>
          item.type ===
          "sol_transfer"
      );

    const tokenMovements =
      activity.filter(
        (item) =>
          item.type ===
          "token_transfer"
      );

    const failed =
      activity.filter(
        (item) =>
          item.status ===
          "failed"
      );

    return NextResponse.json({
      chain:
        "solana",

      chainName:
        "Solana Mainnet",

      walletScanner:
        "solana",

      address:
        wallet,

      addressShort:
        `${wallet.slice(
          0,
          5
        )}...${wallet.slice(
          -5
        )}`,

      summary: {
        transactions:
          signatures.length,

        activityItems:
          activity.length,

        incoming:
          incoming.length,

        outgoing:
          outgoing.length,

        neutral:
          neutral.length,

        solMovements:
          solMovements.length,

        tokenMovements:
          tokenMovements.length,

        failedActivities:
          failed.length,
      },

      activity:
        activity.slice(
          0,
          20
        ),

      intelligence: {
        status:
          activity.length >
          0
            ? "attention"
            : "normal",

        headline:
          `${activity.length} observable Solana activity item${
            activity.length ===
            1
              ? ""
              : "s"
          } found`,

        explanation:
          `PRISM reviewed ${signatures.length} recent confirmed Solana transactions and detected ${solMovements.length} SOL balance movement${
            solMovements.length ===
            1
              ? ""
              : "s"
          } and ${tokenMovements.length} SPL token balance movement${
            tokenMovements.length ===
            1
              ? ""
              : "s"
          }.`,

        verificationPolicy:
          "SOL is treated as the native Solana asset. SPL token mint addresses are retained exactly, but this first adapter does not yet claim token identity from ticker symbols alone.",

        interpretationPolicy:
          "PRISM reports observable balance changes and transaction relationships. Incoming or outgoing activity does not by itself prove buying, selling, investment intent, project ownership, or future price direction.",
      },
    });
  } catch (
    error
  ) {
    console.error(
      "PRISM Solana wallet API error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof
          Error
            ? error.message
            : "Something went wrong while retrieving Solana wallet activity.",
      },

      {
        status:
          500,
      }
    );
  }
}
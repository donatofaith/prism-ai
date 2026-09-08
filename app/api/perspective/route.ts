import { NextRequest, NextResponse } from "next/server";

type Chain =
  | "ethereum"
  | "arbitrum"
  | "optimism"
  | "polygon"
  | "solana";

type ProjectAccountType =
  | "treasury"
  | "governance"
  | "multisig"
  | "program"
  | "team"
  | "investor"
  | "project";

type PerspectiveProjectAccount = {
  label: string;
  project: string;
  chain: Chain;
  accountType: ProjectAccountType;

  confidence:
    | "verified"
    | "high"
    | "medium";

  isWallet: boolean;
};

type EvmSummary = {
  totalTransfers?: number;
  incomingTransfers?: number;
  outgoingTransfers?: number;
  highImportanceTransfers?: number;

  attributedTransfers?: number;

  exchangeInteractions?: number;
  exchangeInflows?: number;
  exchangeOutflows?: number;

  mintEvents?: number;
  burnEvents?: number;

  projectInteractions?: number;
};

type SolanaSummary = {
  transactions?: number;
  activityItems?: number;

  incoming?: number;
  outgoing?: number;
  neutral?: number;

  solMovements?: number;
  tokenMovements?: number;

  failedActivities?: number;
};

type PerspectiveRequest = {
  token?: {
    id?: string;
    name?: string;
    symbol?: string;

    price?: number;
    change24h?: number;
    marketCap?: number;
    volume24h?: number;

    rangeChange?: number;
    rangeDays?: number;
  };

  projectAccounts?: PerspectiveProjectAccount[];

  account?: {
    address?: string;
    label?: string;
    chain?: Chain;

    accountType?: ProjectAccountType;

    isAttributed?: boolean;

    confidence?:
      | "verified"
      | "high"
      | "medium"
      | "unknown";
  };

  evmSummary?: EvmSummary;

  solanaSummary?: SolanaSummary;
};

type EvidenceItem = {
  id: string;

  category:
    | "market"
    | "attribution"
    | "exchange"
    | "project"
    | "protocol"
    | "activity";

  importance:
    | "high"
    | "medium"
    | "low";

  title: string;

  observation: string;

  limitation: string;
};

function safeNumber(
  value: unknown
) {
  return typeof value === "number" &&
    Number.isFinite(value)
    ? value
    : 0;
}

function plural(
  amount: number,
  singular: string,
  pluralValue?: string
) {
  if (amount === 1) {
    return singular;
  }

  return pluralValue ?? `${singular}s`;
}

function accountTypeLabel(
  type: ProjectAccountType
) {
  if (type === "treasury") {
    return "treasury";
  }

  if (type === "governance") {
    return "governance";
  }

  if (type === "multisig") {
    return "multisig";
  }

  if (type === "program") {
    return "program";
  }

  if (type === "team") {
    return "team-linked";
  }

  if (type === "investor") {
    return "investor-linked";
  }

  return "project";
}

function buildMarketEvidence(
  body: PerspectiveRequest
): EvidenceItem[] {
  const token = body.token;

  if (!token) {
    return [];
  }

  const evidence: EvidenceItem[] = [];

  const change24h =
    safeNumber(token.change24h);

  if (
    token.change24h !== undefined
  ) {
    const direction =
      change24h > 0
        ? "higher"
        : change24h < 0
        ? "lower"
        : "roughly unchanged";

    const magnitude =
      Math.abs(change24h);

    evidence.push({
      id: "market-24h",

      category: "market",

      importance:
        magnitude >= 10
          ? "high"
          : magnitude >= 4
          ? "medium"
          : "low",

      title:
        "24-hour market move",

      observation:
        `${token.name ?? token.symbol ?? "The token"} is ${direction} by ${magnitude.toFixed(
          2
        )}% over the last 24 hours.`,

      limitation:
        "Price movement alone does not identify the cause of the move.",
    });
  }

  if (
    token.rangeChange !== undefined &&
    token.rangeDays
  ) {
    const rangeChange =
      safeNumber(
        token.rangeChange
      );

    const direction =
      rangeChange > 0
        ? "up"
        : rangeChange < 0
        ? "down"
        : "flat";

    evidence.push({
      id: "market-range",

      category: "market",

      importance:
        Math.abs(rangeChange) >= 15
          ? "medium"
          : "low",

      title:
        `${token.rangeDays}-day trend`,

      observation:
        `${token.name ?? token.symbol ?? "The token"} is ${direction} ${Math.abs(
          rangeChange
        ).toFixed(2)}% across the selected historical window.`,

      limitation:
        "Historical direction does not predict what the market will do next.",
    });
  }

  return evidence;
}

function buildProjectAccountEvidence(
  body: PerspectiveRequest
): EvidenceItem[] {
  const accounts =
    body.projectAccounts ?? [];

  if (accounts.length === 0) {
    return [];
  }

  const evidence: EvidenceItem[] = [];

  const verified =
    accounts.filter(
      (account) =>
        account.confidence ===
        "verified"
    );

  const chains =
    Array.from(
      new Set(
        accounts.map(
          (account) =>
            account.chain
        )
      )
    );

  const accountTypes =
    Array.from(
      new Set(
        accounts.map(
          (account) =>
            accountTypeLabel(
              account.accountType
            )
        )
      )
    );

  evidence.push({
    id: "project-accounts",

    category:
      "attribution",

    importance:
      verified.length > 0
        ? "medium"
        : "low",

    title:
      "Project attribution",

    observation:
      `PRISM found ${accounts.length} evidence-backed ${plural(
        accounts.length,
        "project account"
      )} across ${chains.length} ${plural(
        chains.length,
        "chain"
      )}. The registry includes ${accountTypes.join(
        ", "
      )} context.`,

    limitation:
      "A publicly attributed project account does not imply that every transaction involving it reflects project leadership intent.",
  });

  return evidence;
}

function buildEvmEvidence(
  body: PerspectiveRequest
): EvidenceItem[] {
  const summary =
    body.evmSummary;

  if (!summary) {
    return [];
  }

  const evidence: EvidenceItem[] = [];

  const attributed =
    safeNumber(
      summary.attributedTransfers
    );

  const projectInteractions =
    safeNumber(
      summary.projectInteractions
    );

  const exchangeInteractions =
    safeNumber(
      summary.exchangeInteractions
    );

  const exchangeInflows =
    safeNumber(
      summary.exchangeInflows
    );

  const exchangeOutflows =
    safeNumber(
      summary.exchangeOutflows
    );

  const mintEvents =
    safeNumber(
      summary.mintEvents
    );

  const burnEvents =
    safeNumber(
      summary.burnEvents
    );

  const highImportance =
    safeNumber(
      summary.highImportanceTransfers
    );

  if (attributed > 0) {
    evidence.push({
      id: "evm-attribution",

      category:
        "attribution",

      importance:
        attributed >= 5
          ? "medium"
          : "low",

      title:
        "Attributed counterparties",

      observation:
        `${attributed} recent ${plural(
          attributed,
          "interaction"
        )} involved counterparties that PRISM could identify using its evidence-backed address registry.`,

      limitation:
        "Entity attribution describes the counterparty. It does not establish why the transaction occurred.",
    });
  }

  if (projectInteractions > 0) {
    evidence.push({
      id: "evm-project",

      category:
        "project",

      importance:
        projectInteractions >= 5
          ? "medium"
          : "low",

      title:
        "Project-linked activity",

      observation:
        `${projectInteractions} recent ${plural(
          projectInteractions,
          "interaction"
        )} involved project, treasury, team or investor-linked accounts.`,

      limitation:
        "Project-linked movement does not prove insider trading, liquidation, accumulation or coordinated activity.",
    });
  }

  if (exchangeInteractions > 0) {
    const pieces: string[] = [];

    if (exchangeInflows > 0) {
      pieces.push(
        `${exchangeInflows} toward an attributed exchange`
      );
    }

    if (exchangeOutflows > 0) {
      pieces.push(
        `${exchangeOutflows} from an attributed exchange`
      );
    }

    evidence.push({
      id: "evm-exchange",

      category:
        "exchange",

      importance:
        "high",

      title:
        "Exchange-linked movement",

      observation:
        `${exchangeInteractions} verified exchange-linked ${plural(
          exchangeInteractions,
          "interaction"
        )} were detected${
          pieces.length > 0
            ? `, including ${pieces.join(
                " and "
              )}`
            : ""
        }.`,

      limitation:
        "Transfers toward an exchange do not prove that assets were sold. Transfers from an exchange do not prove accumulation.",
    });
  }

  if (
    mintEvents > 0 ||
    burnEvents > 0
  ) {
    const pieces: string[] = [];

    if (mintEvents > 0) {
      pieces.push(
        `${mintEvents} ${plural(
          mintEvents,
          "mint"
        )}`
      );
    }

    if (burnEvents > 0) {
      pieces.push(
        `${burnEvents} ${plural(
          burnEvents,
          "burn"
        )}`
      );
    }

    evidence.push({
      id: "evm-protocol",

      category:
        "protocol",

      importance:
        "medium",

      title:
        "Protocol events",

      observation:
        `The current activity window contains ${pieces.join(
          " and "
        )} ${plural(
          mintEvents +
            burnEvents,
          "event"
        )}.`,

      limitation:
        "Mint and burn context describes token mechanics and should not automatically be interpreted as bullish or bearish.",
    });
  }

  if (highImportance > 0) {
    evidence.push({
      id: "evm-large",

      category:
        "activity",

      importance:
        "medium",

      title:
        "Large token-unit movements",

      observation:
        `${highImportance} recent ${plural(
          highImportance,
          "transfer"
        )} crossed PRISM's temporary high-importance token-unit threshold.`,

      limitation:
        "This threshold is based on token units rather than USD value, so different assets are not directly comparable.",
    });
  }

  return evidence;
}

function buildSolanaEvidence(
  body: PerspectiveRequest
): EvidenceItem[] {
  const summary =
    body.solanaSummary;

  if (!summary) {
    return [];
  }

  const evidence: EvidenceItem[] = [];

  const transactions =
    safeNumber(
      summary.transactions
    );

  const incoming =
    safeNumber(
      summary.incoming
    );

  const outgoing =
    safeNumber(
      summary.outgoing
    );

  const solMovements =
    safeNumber(
      summary.solMovements
    );

  const tokenMovements =
    safeNumber(
      summary.tokenMovements
    );

  if (transactions > 0) {
    evidence.push({
      id: "solana-activity",

      category:
        "activity",

      importance:
        transactions >= 10
          ? "medium"
          : "low",

      title:
        "Recent Solana activity",

      observation:
        `PRISM reviewed ${transactions} recent Solana ${plural(
          transactions,
          "transaction"
        )}, containing ${incoming} incoming and ${outgoing} outgoing observable balance ${plural(
          incoming +
            outgoing,
          "movement"
        )}.`,

      limitation:
        "A Solana transaction may contain several instructions. Balance changes alone do not identify the economic purpose of the transaction.",
    });
  }

  if (
    solMovements > 0 ||
    tokenMovements > 0
  ) {
    evidence.push({
      id: "solana-assets",

      category:
        "protocol",

      importance:
        tokenMovements > 0
          ? "medium"
          : "low",

      title:
        "Solana asset movements",

      observation:
        `The activity includes ${solMovements} SOL balance ${plural(
          solMovements,
          "movement"
        )} and ${tokenMovements} SPL token ${plural(
          tokenMovements,
          "movement"
        )}.`,

      limitation:
        "SPL token mint addresses remain unverified unless PRISM has independent evidence for the token identity.",
    });
  }

  return evidence;
}

function importanceScore(
  importance:
    EvidenceItem["importance"]
) {
  if (
    importance ===
    "high"
  ) {
    return 3;
  }

  if (
    importance ===
    "medium"
  ) {
    return 2;
  }

  return 1;
}

function buildPerspective(
  body:
    PerspectiveRequest
) {
  const evidence = [
    ...buildMarketEvidence(
      body
    ),

    ...buildProjectAccountEvidence(
      body
    ),

    ...buildEvmEvidence(
      body
    ),

    ...buildSolanaEvidence(
      body
    ),
  ].sort(
    (
      a,
      b
    ) =>
      importanceScore(
        b.importance
      ) -
      importanceScore(
        a.importance
      )
  );

  const highEvidence =
    evidence.filter(
      (item) =>
        item.importance ===
        "high"
    );

  const mediumEvidence =
    evidence.filter(
      (item) =>
        item.importance ===
        "medium"
    );

  const tokenName =
    body.token?.name ??
    body.token?.symbol ??
    "this asset";

  let status:
    | "quiet"
    | "watch"
    | "attention" =
    "quiet";

  if (
    highEvidence.length >
    0
  ) {
    status =
      "attention";
  } else if (
    mediumEvidence.length >
    0
  ) {
    status =
      "watch";
  }

  let headline =
    `No strong attributed signal stands out for ${tokenName}.`;

  if (
    highEvidence.some(
      (item) =>
        item.category ===
        "exchange"
    )
  ) {
    headline =
      `Verified exchange-linked movement deserves attention around ${tokenName}.`;
  } else if (
    evidence.some(
      (item) =>
        item.category ===
        "project"
    )
  ) {
    headline =
      `PRISM sees recent project-linked activity around ${tokenName}.`;
  } else if (
    evidence.some(
      (item) =>
        item.category ===
        "attribution"
    )
  ) {
    headline =
      `${tokenName} has useful evidence-backed project attribution available.`;
  } else if (
    evidence.some(
      (item) =>
        item.category ===
        "market"
    )
  ) {
    headline =
      `PRISM sees market movement in ${tokenName}, but no attributed on-chain cause has been established.`;
  }

  const strongest =
    evidence.slice(
      0,
      3
    );

  const whatPrismSees =
    strongest.length > 0
      ? strongest
          .map(
            (item) =>
              item.observation
          )
          .join(" ")
      : "PRISM does not currently have enough evidence to build a strong account-level interpretation.";

  const whyItMayMatterParts: string[] =
    [];

  if (
    evidence.some(
      (item) =>
        item.category ===
        "exchange"
    )
  ) {
    whyItMayMatterParts.push(
      "Exchange-linked movements can matter because they change where assets are held and may affect available liquidity."
    );
  }

  if (
    evidence.some(
      (item) =>
        item.category ===
        "project"
    )
  ) {
    whyItMayMatterParts.push(
      "Project-linked account activity can be worth monitoring because treasuries and governance accounts may participate in operational, governance or liquidity-related transactions."
    );
  }

  if (
    evidence.some(
      (item) =>
        item.category ===
        "protocol"
    )
  ) {
    whyItMayMatterParts.push(
      "Protocol-level events and token movements can provide additional context around changes in supply or account activity."
    );
  }

  if (
    whyItMayMatterParts.length ===
    0
  ) {
    whyItMayMatterParts.push(
      "The evidence provides context for further investigation, even when it does not establish a specific market narrative."
    );
  }

  const limitations =
    Array.from(
      new Set(
        strongest.map(
          (item) =>
            item.limitation
        )
      )
    );

  limitations.push(
    "PRISM does not treat correlation as proof of causation."
  );

  limitations.push(
    "This analysis does not predict future price direction."
  );

  return {
    status,

    headline,

    whatPrismSees,

    whyItMayMatter:
      whyItMayMatterParts.join(
        " "
      ),

    whatWeCannotConclude:
      Array.from(
        new Set(
          limitations
        )
      ).join(" "),

    evidenceCount:
      evidence.length,

    evidence,

    methodology: {
      attribution:
        "Only explicitly attributed project and exchange addresses are treated as known entities.",

      tokenIdentity:
        "Token identity should be established using exact chain-specific contract or mint evidence rather than ticker symbols alone.",

      causality:
        "Observed transactions and market movements are described as evidence and context, not proof of motive or causation.",
    },
  };
}

export async function POST(
  request:
    NextRequest
) {
  try {
    const body =
      (await request.json()) as PerspectiveRequest;

    const perspective =
      buildPerspective(
        body
      );

    return NextResponse.json(
      perspective
    );
  } catch (
    error
  ) {
    console.error(
      "PRISM perspective error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof
          Error
            ? error.message
            : "PRISM could not generate a perspective.",
      },

      {
        status:
          500,
      }
    );
  }
}
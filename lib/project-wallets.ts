export type SupportedChain =
  | "ethereum"
  | "arbitrum"
  | "optimism"
  | "polygon"
  | "solana";

/*
  Broader account classification.

  This lets PRISM describe addresses
  accurately instead of assuming every
  project-controlled address is a wallet.
*/
export type ProjectAccountType =
  | "treasury"
  | "governance"
  | "multisig"
  | "program"
  | "team"
  | "investor"
  | "project";

/*
  Kept temporarily so existing API/UI
  code does not break while we migrate
  from "wallets" to "project accounts".
*/
export type ProjectWalletType =
  | "project"
  | "treasury"
  | "team"
  | "investor";

export type ProjectWalletRecord = {
  address: string;

  project: string;

  symbol?: string;

  chain: SupportedChain;

  label: string;

  /*
    New accurate classification.
  */
  accountType: ProjectAccountType;

  /*
    Backwards-compatible classification.

    We'll remove this later after the
    frontend/API migration is complete.
  */
  walletType: ProjectWalletType;

  /*
    Helps PRISM distinguish a normal
    wallet/multisig from a smart contract
    or Solana program account.
  */
  isWallet: boolean;

  confidence:
    | "verified"
    | "high"
    | "medium";

  source: string;

  sourceUrl: string;

  explanation: string;
};

const PROJECT_WALLETS: ProjectWalletRecord[] = [
  /*
   * ──────────────────────────────
   * AAVE
   * Ethereum
   * ──────────────────────────────
   */

  {
    address:
      "0x464C71f6c2F760DdA6093dCB91C24c39e5d6e18c",

    project:
      "Aave DAO",

    symbol:
      "AAVE",

    chain:
      "ethereum",

    label:
      "Aave DAO Ethereum Treasury",

    accountType:
      "treasury",

    walletType:
      "treasury",

    isWallet:
      true,

    confidence:
      "verified",

    source:
      "Aave Governance",

    sourceUrl:
      "https://governance.aave.com/t/arfc-aave-funding-update/15194/10",

    explanation:
      "Aave governance documentation publicly identifies this exact address as the Aave DAO Ethereum Treasury.",
  },

  /*
   * ──────────────────────────────
   * ENS
   * Ethereum
   * ──────────────────────────────
   */

  {
    address:
      "0xFe89cc7aBB2C4183683ab71653C4cdc9B02D44b7",

    project:
      "ENS DAO",

    symbol:
      "ENS",

    chain:
      "ethereum",

    label:
      "ENS DAO Wallet",

    accountType:
      "treasury",

    walletType:
      "treasury",

    isWallet:
      true,

    confidence:
      "verified",

    source:
      "ENS DAO Documentation",

    sourceUrl:
      "https://docs.ens.domains/dao/proposals/6.37/",

    explanation:
      "ENS governance documentation identifies this exact address as wallet.ensdao.eth, the ENS DAO wallet and timelock.",
  },

  {
    address:
      "0x4F2083f5fBede34C2714aFfb3105539775f7FE64",

    project:
      "ENS DAO",

    symbol:
      "ENS",

    chain:
      "ethereum",

    label:
      "ENS Endowment Safe",

    accountType:
      "multisig",

    walletType:
      "treasury",

    isWallet:
      true,

    confidence:
      "verified",

    source:
      "ENS DAO Documentation",

    sourceUrl:
      "https://docs.ens.domains/dao/proposals/6.37/",

    explanation:
      "ENS governance documentation publicly identifies this exact address as the ENS Endowment Safe.",
  },

  {
    address:
      "0x91c32893216dE3eA0a55ABb9851f581d4503d39b",

    project:
      "ENS DAO",

    symbol:
      "ENS",

    chain:
      "ethereum",

    label:
      "ENS Meta-Governance Multisig",

    accountType:
      "multisig",

    walletType:
      "project",

    isWallet:
      true,

    confidence:
      "verified",

    source:
      "ENS DAO Documentation",

    sourceUrl:
      "https://docs.ens.domains/dao/proposals/5.24",

    explanation:
      "ENS governance documentation identifies this address as the Meta-Governance working-group multisig.",
  },

  {
    address:
      "0x2686A8919Df194aA7673244549E68D42C1685d03",

    project:
      "ENS DAO",

    symbol:
      "ENS",

    chain:
      "ethereum",

    label:
      "ENS Ecosystem Multisig",

    accountType:
      "multisig",

    walletType:
      "project",

    isWallet:
      true,

    confidence:
      "verified",

    source:
      "ENS DAO Documentation",

    sourceUrl:
      "https://docs.ens.domains/dao/proposals/5.24",

    explanation:
      "ENS governance documentation identifies this address as the ENS Ecosystem working-group multisig.",
  },

  {
    address:
      "0xcD42b4c4D102cc22864e3A1341Bb0529c17fD87d",

    project:
      "ENS DAO",

    symbol:
      "ENS",

    chain:
      "ethereum",

    label:
      "ENS Public Goods Multisig",

    accountType:
      "multisig",

    walletType:
      "project",

    isWallet:
      true,

    confidence:
      "verified",

    source:
      "ENS DAO Documentation",

    sourceUrl:
      "https://docs.ens.domains/dao/proposals/5.24",

    explanation:
      "ENS governance documentation identifies this address as the ENS Public Goods working-group multisig.",
  },

  /*
   * ──────────────────────────────
   * UNISWAP
   * Ethereum
   * ──────────────────────────────
   */

  {
    address:
      "0x1a9C8182C09F50C8318d769245beA52c32BE35BC",

    project:
      "Uniswap DAO",

    symbol:
      "UNI",

    chain:
      "ethereum",

    label:
      "Uniswap Governance Timelock",

    accountType:
      "governance",

    walletType:
      "treasury",

    isWallet:
      false,

    confidence:
      "verified",

    source:
      "Uniswap Governance",

    sourceUrl:
      "https://gov.uniswap.org/t/uniswap-accountability-committee-uac-season-2-report/24492/1",

    explanation:
      "Uniswap governance documentation identifies this Ethereum address as a governance timelock associated with the DAO treasury.",
  },

  /*
   * ──────────────────────────────
   * UNISWAP
   * Arbitrum
   * ──────────────────────────────
   */

  {
    address:
      "0x2BAD8182C09F50c8318d769245beA52C32Be46CD",

    project:
      "Uniswap DAO",

    symbol:
      "UNI",

    chain:
      "arbitrum",

    label:
      "Uniswap Arbitrum Governance",

    accountType:
      "governance",

    walletType:
      "project",

    isWallet:
      false,

    confidence:
      "verified",

    source:
      "Uniswap Governance",

    sourceUrl:
      "https://gov.uniswap.org/t/temperature-check-fix-the-cross-chain-messaging-bridge-on-arbitrum/18073",

    explanation:
      "Uniswap governance documentation identifies this address as an Arbitrum-side governance address associated with Uniswap's cross-chain governance system.",
  },

  /*
   * ──────────────────────────────
   * ARBITRUM
   * ──────────────────────────────
   */

  {
    address:
      "0xf3fc178157fb3c87548baa86f9d24ba38e649b58",

    project:
      "Arbitrum DAO",

    symbol:
      "ARB",

    chain:
      "arbitrum",

    label:
      "Arbitrum DAO Treasury",

    accountType:
      "treasury",

    walletType:
      "treasury",

    isWallet:
      true,

    confidence:
      "high",

    source:
      "Arbitrum Governance Forum",

    sourceUrl:
      "https://forum.arbitrum.foundation/t/interport-finance-draft-stip-round-2/18834",

    explanation:
      "Arbitrum governance material identifies this address as an Arbitrum DAO treasury destination.",
  },

  /*
   * ──────────────────────────────
   * SOLANA
   * ──────────────────────────────
   *
   * IMPORTANT:
   *
   * This is NOT labelled as a treasury
   * wallet.
   *
   * It is an official governance program
   * account and PRISM should present it
   * exactly that way.
   */

  {
    address:
      "govYkyQ3ePtGULAtY6V75qjWE8UH4vCUVQ1W4HdCAZU",

    project:
      "Solana",

    symbol:
      "SOL",

    chain:
      "solana",

    label:
      "Solana Governance Program",

    accountType:
      "program",

    /*
      Temporary compatibility value.
      The API/frontend will soon use
      accountType instead.
    */
    walletType:
      "project",

    isWallet:
      false,

    confidence:
      "verified",

    source:
      "Solana Governance Documentation",

    sourceUrl:
      "https://docs.governance.solana.com/",

    explanation:
      "Solana governance documentation identifies this address as an official governance program account. It is a program account, not a treasury wallet.",
  },
];

function normalizeValue(
  value?: string | null
) {
  return (
    value
      ?.trim()
      .toLowerCase() ??
    ""
  );
}

function normalizeAddress(
  address?: string | null
) {
  return normalizeValue(
    address
  );
}

/*
  Address attribution MUST remain
  chain-specific.

  Ethereum remains the default because
  the original PRISM EVM scanner was
  Ethereum-first.

  Arbitrum and Solana adapters should
  always pass their chain explicitly.
*/
export function getProjectWalletAttribution(
  address?: string | null,
  chain: SupportedChain = "ethereum"
): ProjectWalletRecord | null {
  const normalized =
    normalizeAddress(
      address
    );

  if (!normalized) {
    return null;
  }

  return (
    PROJECT_WALLETS.find(
      (record) =>
        record.chain ===
          chain &&
        normalizeAddress(
          record.address
        ) ===
          normalized
    ) ?? null
  );
}

export function getProjectWallets(
  query?: string,
  chain?: SupportedChain
) {
  if (
    !query &&
    !chain
  ) {
    return PROJECT_WALLETS;
  }

  const normalizedQuery =
    normalizeValue(
      query
    );

  return PROJECT_WALLETS.filter(
    (record) => {
      const matchesQuery =
        !normalizedQuery ||
        normalizeValue(
          record.project
        ).includes(
          normalizedQuery
        ) ||
        normalizeValue(
          record.symbol
        ) ===
          normalizedQuery ||
        normalizeValue(
          record.label
        ).includes(
          normalizedQuery
        );

      const matchesChain =
        !chain ||
        record.chain ===
          chain;

      return (
        matchesQuery &&
        matchesChain
      );
    }
  );
}

export function getProjectWalletsByChain(
  chain: SupportedChain
) {
  return PROJECT_WALLETS.filter(
    (record) =>
      record.chain ===
      chain
  );
}

/*
  New helper for the broader account
  model.
*/
export function getProjectAccountsByType(
  accountType: ProjectAccountType
) {
  return PROJECT_WALLETS.filter(
    (record) =>
      record.accountType ===
      accountType
  );
}

export function getSupportedProjectChains() {
  return Array.from(
    new Set(
      PROJECT_WALLETS.map(
        (record) =>
          record.chain
      )
    )
  );
}
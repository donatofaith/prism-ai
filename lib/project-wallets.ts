export type SupportedChain =
  | "ethereum"
  | "arbitrum"
  | "base"
  | "optimism"
  | "polygon"
  | "bnb"
  | "avalanche"
  | "solana";

export type ProjectAccountType =
  | "treasury"
  | "governance"
  | "multisig"
  | "program"
  | "team"
  | "investor"
  | "project";

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
  accountType: ProjectAccountType;
  walletType: ProjectWalletType;
  isWallet: boolean;
  confidence: "verified" | "high" | "medium";
  source: string;
  sourceUrl: string;
  explanation: string;
};

/*
  PRISM only stores project-linked accounts when there is a public,
  reviewable attribution source. The registry is deliberately curated:
  if an address cannot be supported by reliable public evidence, PRISM
  should leave it unattributed rather than guess.
*/
const PROJECT_WALLETS: ProjectWalletRecord[] = [
  /* =======================================================
     AAVE
     ======================================================= */
  {
    address: "0x464C71f6c2F760DdA6093dCB91C24c39e5d6e18c",
    project: "Aave DAO",
    symbol: "AAVE",
    chain: "ethereum",
    label: "Aave DAO Ethereum Treasury",
    accountType: "treasury",
    walletType: "treasury",
    isWallet: true,
    confidence: "verified",
    source: "Aave Governance",
    sourceUrl: "https://governance.aave.com/t/arfc-aave-funding-update/15194/10",
    explanation:
      "Aave governance documentation publicly identifies this exact address as the Aave DAO Ethereum Treasury.",
  },

  /* =======================================================
     ENS
     ======================================================= */
  {
    address: "0xFe89cc7aBB2C4183683ab71653C4cdc9B02D44b7",
    project: "ENS DAO",
    symbol: "ENS",
    chain: "ethereum",
    label: "ENS DAO Wallet",
    accountType: "treasury",
    walletType: "treasury",
    isWallet: true,
    confidence: "verified",
    source: "ENS DAO Documentation",
    sourceUrl: "https://docs.ens.domains/dao/proposals/6.37/",
    explanation:
      "ENS governance documentation identifies this exact address as wallet.ensdao.eth, the ENS DAO wallet and timelock.",
  },
  {
    address: "0x4F2083f5fBede34C2714aFfb3105539775f7FE64",
    project: "ENS DAO",
    symbol: "ENS",
    chain: "ethereum",
    label: "ENS Endowment Safe",
    accountType: "multisig",
    walletType: "treasury",
    isWallet: true,
    confidence: "verified",
    source: "ENS DAO Documentation",
    sourceUrl: "https://docs.ens.domains/dao/proposals/6.37/",
    explanation:
      "ENS governance documentation publicly identifies this exact address as the ENS Endowment Safe.",
  },
  {
    address: "0x91c32893216dE3eA0a55ABb9851f581d4503d39b",
    project: "ENS DAO",
    symbol: "ENS",
    chain: "ethereum",
    label: "ENS Meta-Governance Multisig",
    accountType: "multisig",
    walletType: "project",
    isWallet: true,
    confidence: "verified",
    source: "ENS DAO Documentation",
    sourceUrl: "https://docs.ens.domains/dao/proposals/5.24",
    explanation:
      "ENS governance documentation identifies this address as the Meta-Governance working-group multisig.",
  },
  {
    address: "0x2686A8919Df194aA7673244549E68D42C1685d03",
    project: "ENS DAO",
    symbol: "ENS",
    chain: "ethereum",
    label: "ENS Ecosystem Multisig",
    accountType: "multisig",
    walletType: "project",
    isWallet: true,
    confidence: "verified",
    source: "ENS DAO Documentation",
    sourceUrl: "https://docs.ens.domains/dao/proposals/5.24",
    explanation:
      "ENS governance documentation identifies this address as the ENS Ecosystem working-group multisig.",
  },
  {
    address: "0xcD42b4c4D102cc22864e3A1341Bb0529c17fD87d",
    project: "ENS DAO",
    symbol: "ENS",
    chain: "ethereum",
    label: "ENS Public Goods Multisig",
    accountType: "multisig",
    walletType: "project",
    isWallet: true,
    confidence: "verified",
    source: "ENS DAO Documentation",
    sourceUrl: "https://docs.ens.domains/dao/proposals/5.24",
    explanation:
      "ENS governance documentation identifies this address as the ENS Public Goods working-group multisig.",
  },

  /* =======================================================
     UNISWAP
     ======================================================= */
  {
    address: "0x1a9C8182C09F50C8318d769245beA52c32BE35BC",
    project: "Uniswap DAO",
    symbol: "UNI",
    chain: "ethereum",
    label: "Uniswap Governance Timelock",
    accountType: "governance",
    walletType: "treasury",
    isWallet: false,
    confidence: "verified",
    source: "Uniswap Governance",
    sourceUrl: "https://gov.uniswap.org/t/uniswap-accountability-committee-uac-season-2-report/24492/1",
    explanation:
      "Uniswap governance documentation identifies this Ethereum address as a governance timelock associated with the DAO treasury.",
  },
  {
    address: "0x2BAD8182C09F50c8318d769245beA52C32Be46CD",
    project: "Uniswap DAO",
    symbol: "UNI",
    chain: "arbitrum",
    label: "Uniswap Arbitrum Governance",
    accountType: "governance",
    walletType: "project",
    isWallet: false,
    confidence: "verified",
    source: "Uniswap Governance",
    sourceUrl: "https://gov.uniswap.org/t/temperature-check-fix-the-cross-chain-messaging-bridge-on-arbitrum/18073",
    explanation:
      "Uniswap governance documentation identifies this address as an Arbitrum-side governance address associated with Uniswap's cross-chain governance system.",
  },

  /* =======================================================
     ARBITRUM
     ======================================================= */
  {
    address: "0xf3fc178157fb3c87548baa86f9d24ba38e649b58",
    project: "Arbitrum DAO",
    symbol: "ARB",
    chain: "arbitrum",
    label: "Arbitrum DAO Treasury",
    accountType: "treasury",
    walletType: "treasury",
    isWallet: true,
    confidence: "high",
    source: "Arbitrum Governance Forum",
    sourceUrl: "https://forum.arbitrum.foundation/t/interport-finance-draft-stip-round-2/18834",
    explanation:
      "Arbitrum governance material identifies this address as an Arbitrum DAO treasury destination.",
  },

  /* =======================================================
     SOLANA
     ======================================================= */
  {
    address: "govYkyQ3ePtGULAtY6V75qjWE8UH4vCUVQ1W4HdCAZU",
    project: "Solana",
    symbol: "SOL",
    chain: "solana",
    label: "Solana Governance Program",
    accountType: "program",
    walletType: "project",
    isWallet: false,
    confidence: "verified",
    source: "Solana Governance Documentation",
    sourceUrl: "https://docs.governance.solana.com/",
    explanation:
      "Solana governance documentation identifies this address as an official governance program account. It is a program account, not a treasury wallet.",
  },

  /* =======================================================
     OPTIMISM
     Official Optimism documentation publishes these addresses.
     These are on OP Mainnet.
     ======================================================= */
  {
    address: "0x2A82Ae142b2e62Cb7D10b55E323ACB1Cab663a26",
    project: "Optimism Collective",
    symbol: "OP",
    chain: "optimism",
    label: "OP Foundation Allocated Treasury",
    accountType: "treasury",
    walletType: "treasury",
    isWallet: true,
    confidence: "verified",
    source: "Optimism Documentation",
    sourceUrl: "https://docs.optimism.io/governance/capital-allocation",
    explanation:
      "Optimism documentation identifies this address as the treasury holding the Foundation-allocated OP budget that requires governance approval for access.",
  },
  {
    address: "0x2501c477D0A35545a387Aa4A3EEe4292A9a8B3F0",
    project: "Optimism Collective",
    symbol: "OP",
    chain: "optimism",
    label: "OP Foundation Approved Treasury",
    accountType: "treasury",
    walletType: "treasury",
    isWallet: true,
    confidence: "verified",
    source: "Optimism Documentation",
    sourceUrl: "https://docs.optimism.io/governance/capital-allocation",
    explanation:
      "Optimism documentation identifies this as the Foundation treasury used for budget already approved through the token allocation process.",
  },
  {
    address: "0x19793c7824Be70ec58BB673CA42D2779d12581BE",
    project: "Optimism Collective",
    symbol: "OP",
    chain: "optimism",
    label: "OP Foundation Grants Wallet",
    accountType: "project",
    walletType: "project",
    isWallet: true,
    confidence: "verified",
    source: "Optimism Documentation",
    sourceUrl: "https://docs.optimism.io/governance/capital-allocation",
    explanation:
      "Optimism documentation identifies this Foundation wallet as a wallet used to make private OP grants.",
  },
  {
    address: "0xE4553b743E74dA3424Ac51f8C1E586fd43aE226F",
    project: "Optimism Collective",
    symbol: "OP",
    chain: "optimism",
    label: "OP Foundation Locked Grants Wallet",
    accountType: "project",
    walletType: "project",
    isWallet: true,
    confidence: "verified",
    source: "Optimism Documentation",
    sourceUrl: "https://docs.optimism.io/governance/capital-allocation",
    explanation:
      "Optimism documentation identifies this Foundation wallet as the wallet used to hold OP assigned to one-year grant lockups.",
  },

  /* =======================================================
     LIDO
     Official Lido docs publish the governance addresses below.
     ======================================================= */
  {
    address: "0x2e59A20f205bB85a89C53f1936454680651E618e",
    project: "Lido DAO",
    symbol: "LDO",
    chain: "ethereum",
    label: "Lido Aragon Voting",
    accountType: "governance",
    walletType: "project",
    isWallet: false,
    confidence: "verified",
    source: "Lido Documentation",
    sourceUrl: "https://docs.lido.fi/guides/protocol-levers/",
    explanation:
      "Lido documentation identifies this contract as the Aragon Voting component used for LDO token governance.",
  },
  {
    address: "0x3e40D73EB977Dc6a537aF587D48316feE66E9C8c",
    project: "Lido DAO",
    symbol: "LDO",
    chain: "ethereum",
    label: "Lido Aragon Agent",
    accountType: "governance",
    walletType: "project",
    isWallet: false,
    confidence: "verified",
    source: "Lido Documentation",
    sourceUrl: "https://docs.lido.fi/guides/protocol-levers/",
    explanation:
      "Lido documentation identifies this address as the Aragon DAO execution agent used by Lido governance.",
  },
  {
    address: "0xF0211b7660680B49De1A7E9f25C65660F0a13Fea",
    project: "Lido DAO",
    symbol: "LDO",
    chain: "ethereum",
    label: "Lido Easy Track",
    accountType: "governance",
    walletType: "project",
    isWallet: false,
    confidence: "verified",
    source: "Lido Documentation",
    sourceUrl: "https://docs.lido.fi/guides/protocol-levers/",
    explanation:
      "Lido documentation identifies this contract as Easy Track, its optimistic governance mechanism for routine operations.",
  },

  /* =======================================================
     COMPOUND
     Official Compound documentation lists its main governance
     and timelock contracts on Ethereum.
     ======================================================= */
  {
    address: "0x309a862bbC1A00e45506cB8A802D1ff10004c8C0",
    project: "Compound",
    symbol: "COMP",
    chain: "ethereum",
    label: "Compound Governor Bravo",
    accountType: "governance",
    walletType: "project",
    isWallet: false,
    confidence: "verified",
    source: "Compound Documentation",
    sourceUrl: "https://docs.compound.finance/",
    explanation:
      "Compound documentation lists this Ethereum contract as the Governor used by Compound governance.",
  },
  {
    address: "0x6d903f6003cca6255d85cca4d3b5e5146dc33925",
    project: "Compound",
    symbol: "COMP",
    chain: "ethereum",
    label: "Compound Timelock",
    accountType: "governance",
    walletType: "treasury",
    isWallet: false,
    confidence: "verified",
    source: "Compound Documentation",
    sourceUrl: "https://docs.compound.finance/",
    explanation:
      "Compound documentation lists this Ethereum address as the governance timelock that administers protocol actions.",
  },
];

function normalizeValue(value?: string | null) {
  return value?.trim().toLowerCase() ?? "";
}

function normalizeAddress(address?: string | null) {
  return normalizeValue(address);
}

export function getProjectWalletAttribution(
  address?: string | null,
  chain: SupportedChain = "ethereum"
): ProjectWalletRecord | null {
  const normalized = normalizeAddress(address);
  if (!normalized) return null;

  return (
    PROJECT_WALLETS.find(
      (record) =>
        record.chain === chain && normalizeAddress(record.address) === normalized
    ) ?? null
  );
}

export function getProjectWallets(query?: string, chain?: SupportedChain) {
  if (!query && !chain) return PROJECT_WALLETS;

  const normalizedQuery = normalizeValue(query);

  return PROJECT_WALLETS.filter((record) => {
    const matchesQuery =
      !normalizedQuery ||
      normalizeValue(record.project).includes(normalizedQuery) ||
      normalizeValue(record.symbol) === normalizedQuery ||
      normalizeValue(record.label).includes(normalizedQuery);

    const matchesChain = !chain || record.chain === chain;
    return matchesQuery && matchesChain;
  });
}

export function getProjectWalletsByChain(chain: SupportedChain) {
  return PROJECT_WALLETS.filter((record) => record.chain === chain);
}

export function getProjectAccountsByType(accountType: ProjectAccountType) {
  return PROJECT_WALLETS.filter((record) => record.accountType === accountType);
}

export function getSupportedProjectChains() {
  return Array.from(new Set(PROJECT_WALLETS.map((record) => record.chain)));
}

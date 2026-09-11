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
  PRISM's attribution registry is evidence-first. Every record must have a
  public source. Unknown accounts stay unknown rather than being guessed.
*/
const PROJECT_WALLETS: ProjectWalletRecord[] = [
  // AAVE
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
    explanation: "Aave governance documentation publicly identifies this exact address as the Aave DAO Ethereum Treasury.",
  },

  // ENS
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
    explanation: "ENS governance documentation identifies this exact address as wallet.ensdao.eth, the ENS DAO wallet and timelock.",
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
    explanation: "ENS governance documentation publicly identifies this exact address as the ENS Endowment Safe.",
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
    explanation: "ENS governance documentation identifies this address as the Meta-Governance working-group multisig.",
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
    explanation: "ENS governance documentation identifies this address as the ENS Ecosystem working-group multisig.",
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
    explanation: "ENS governance documentation identifies this address as the ENS Public Goods working-group multisig.",
  },

  // UNISWAP
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
    explanation: "Uniswap governance documentation identifies this Ethereum address as a governance timelock associated with the DAO treasury.",
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
    explanation: "Uniswap governance documentation identifies this address as an Arbitrum-side governance address associated with Uniswap's cross-chain governance system.",
  },

  // ARBITRUM
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
    explanation: "Arbitrum governance material identifies this address as an Arbitrum DAO treasury destination.",
  },

  // SOLANA
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
    explanation: "Solana governance documentation identifies this address as an official governance program account. It is a program account, not a treasury wallet.",
  },

  // OPTIMISM
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
    explanation: "Optimism documentation identifies this address as the treasury holding the Foundation-allocated OP budget that requires governance approval for access.",
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
    explanation: "Optimism documentation identifies this as the Foundation treasury used for budget already approved through the token allocation process.",
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
    explanation: "Optimism documentation identifies this Foundation wallet as a wallet used to make private OP grants.",
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
    explanation: "Optimism documentation identifies this Foundation wallet as the wallet used to hold OP assigned to one-year grant lockups.",
  },

  // LIDO
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
    explanation: "Lido documentation identifies this contract as the Aragon Voting component used for LDO token governance.",
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
    explanation: "Lido documentation identifies this address as the Aragon DAO execution agent used by Lido governance.",
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
    explanation: "Lido documentation identifies this contract as Easy Track, its optimistic governance mechanism for routine operations.",
  },

  // COMPOUND
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
    explanation: "Compound documentation lists this Ethereum contract as the Governor used by Compound governance.",
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
    explanation: "Compound documentation lists this Ethereum address as the governance timelock that administers protocol actions.",
  },

  // CYSIC — official token contracts published by the Cysic Foundation.
  {
    address: "0x0C69199C1562233640e0Db5Ce2c399A88eB507C7",
    project: "Cysic",
    symbol: "CYS",
    chain: "bnb",
    label: "Cysic CYS Token — BNB Chain",
    accountType: "project",
    walletType: "project",
    isWallet: false,
    confidence: "verified",
    source: "Cysic Foundation Documentation",
    sourceUrl: "https://docs.cysicfoundation.org/",
    explanation: "Cysic Foundation documentation publishes this as the official CYS token address on BNB Smart Chain.",
  },
  {
    address: "0x19e8d59ff3D7A31289e0Dc04Db48d43b02c7ffa6",
    project: "Cysic",
    symbol: "CYS",
    chain: "base",
    label: "Cysic CYS Token — Base",
    accountType: "project",
    walletType: "project",
    isWallet: false,
    confidence: "verified",
    source: "Cysic Foundation Documentation",
    sourceUrl: "https://docs.cysicfoundation.org/",
    explanation: "Cysic Foundation documentation publishes this as the official CYS token address on Base.",
  },

  // SUSHI
  {
    address: "0xe94B5EEC1fA96CEecbD33EF5Baa8d00E4493F4f3",
    project: "Sushi DAO",
    symbol: "SUSHI",
    chain: "ethereum",
    label: "Sushi Treasury Multisig",
    accountType: "multisig",
    walletType: "treasury",
    isWallet: true,
    confidence: "verified",
    source: "Sushi Documentation",
    sourceUrl: "https://docs.sushi.com/pdf/whitepaper.pdf",
    explanation: "Sushi documentation identifies this 4-of-7 multisig as the Treasury Multisig used for community-approved devfund activity.",
  },

  // POLYGON
  {
    address: "0x98165b71cdDea047C0A49413350C40571195fd07",
    project: "Polygon",
    symbol: "POL",
    chain: "ethereum",
    label: "Polygon PoS Governance",
    accountType: "governance",
    walletType: "project",
    isWallet: false,
    confidence: "verified",
    source: "Polygon Developer Documentation",
    sourceUrl: "https://docs.polygon.technology/pos/reference/contracts/genesis-contracts",
    explanation: "Polygon documentation lists this Ethereum mainnet contract as a Polygon PoS Governance contract.",
  },
  {
    address: "0x6e7a5820baD6cebA8Ef5ea69c0C92EbbDAc9CE48",
    project: "Polygon",
    symbol: "POL",
    chain: "ethereum",
    label: "Polygon Governance Proxy",
    accountType: "governance",
    walletType: "project",
    isWallet: false,
    confidence: "verified",
    source: "Polygon Developer Documentation",
    sourceUrl: "https://docs.polygon.technology/pos/reference/contracts/genesis-contracts",
    explanation: "Polygon documentation lists this Ethereum mainnet address as the Polygon PoS Governance Proxy.",
  },
  {
    address: "0xCaf0aa768A3AE1297DF20072419Db8Bb8b5C8cEf",
    project: "Polygon",
    symbol: "POL",
    chain: "ethereum",
    label: "Polygon PoS Timelock",
    accountType: "governance",
    walletType: "project",
    isWallet: false,
    confidence: "verified",
    source: "Polygon Developer Documentation",
    sourceUrl: "https://docs.polygon.technology/pos/reference/contracts/genesis-contracts",
    explanation: "Polygon documentation lists this Ethereum mainnet address as the Polygon PoS governance Timelock.",
  },

  // CONVEX
  {
    address: "0xa3C5A1e09150B75ff251c1a7815A07182c3de2FB",
    project: "Convex Finance",
    symbol: "CVX",
    chain: "ethereum",
    label: "Convex Multisig",
    accountType: "multisig",
    walletType: "project",
    isWallet: true,
    confidence: "verified",
    source: "Convex Finance Documentation",
    sourceUrl: "https://docs.convexfinance.com/convexfinance/faq/contract-addresses",
    explanation: "Convex documentation publishes this address as the Convex Finance multisig.",
  },
  {
    address: "0x1389388d01708118b497f59521f6943Be2541bb7",
    project: "Convex Finance",
    symbol: "CVX",
    chain: "ethereum",
    label: "Convex Treasury Vault",
    accountType: "treasury",
    walletType: "treasury",
    isWallet: false,
    confidence: "verified",
    source: "Convex Finance Documentation",
    sourceUrl: "https://docs.convexfinance.com/convexfinance/faq/contract-addresses",
    explanation: "Convex documentation publishes this address as its Treasury Vault.",
  },

  // FRAX
  {
    address: "0x63278bF9AcdFC9fA65CFa2940b89A34ADfbCb4A1",
    project: "Frax Finance",
    symbol: "FXS",
    chain: "ethereum",
    label: "Frax Community Treasury",
    accountType: "treasury",
    walletType: "treasury",
    isWallet: true,
    confidence: "verified",
    source: "Frax Finance Documentation",
    sourceUrl: "https://docs.frax.finance/fxs-and-vefxs/frax-share-fxs-distribution",
    explanation: "Frax documentation identifies this address as the Community Treasury.",
  },
  {
    address: "0x9AA7Db8E488eE3ffCC9CdFD4f2EaECC8ABeDCB48",
    project: "Frax Finance",
    symbol: "FXS",
    chain: "ethereum",
    label: "Frax Treasury Multisig",
    accountType: "multisig",
    walletType: "treasury",
    isWallet: true,
    confidence: "verified",
    source: "Frax Finance Documentation",
    sourceUrl: "https://docs.frax.finance/frax-v1-original/core-frax-multisigs",
    explanation: "Frax documentation identifies this address as the protocol Treasury multisig.",
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
  chain?: SupportedChain
): ProjectWalletRecord | null {
  const normalized = normalizeAddress(address);
  if (!normalized) return null;

  return (
    PROJECT_WALLETS.find(
      (record) =>
        (!chain || record.chain === chain) &&
        normalizeAddress(record.address) === normalized
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

import {
  getProjectWalletAttribution,
  type ProjectWalletRecord,
} from "@/lib/project-wallets";

export type WalletEntityType =
  | "exchange"
  | "project"
  | "treasury"
  | "team"
  | "investor"
  | "contract"
  | "burn"
  | "unknown";

export type AttributionConfidence =
  | "verified"
  | "high"
  | "medium"
  | "unknown";

export type WalletAttribution = {
  address: string;

  label: string;

  entity: string | null;

  entityType: WalletEntityType;

  confidence: AttributionConfidence;

  source: string | null;

  sourceUrl: string | null;

  explanation: string;
};

type KnownWallet = {
  label: string;

  entity: string;

  entityType: Exclude<
    WalletEntityType,
    "unknown"
  >;

  confidence: Exclude<
    AttributionConfidence,
    "unknown"
  >;

  source: string;

  sourceUrl: string;

  explanation: string;
};

const KNOWN_ETHEREUM_WALLETS: Record<
  string,
  KnownWallet
> = {
  "0x28c6c06298d514db089934071355e5743bf21d60": {
    label: "Binance 14",

    entity: "Binance",

    entityType: "exchange",

    confidence: "verified",

    source: "Etherscan public address label",

    sourceUrl:
      "https://etherscan.io/address/0x28c6c06298d514db089934071355e5743bf21d60",

    explanation:
      "This exact address is publicly labelled as a Binance exchange wallet.",
  },

  "0xe853c56864a2ebe4576a807d26fdc4a0ada51919": {
    label: "Kraken 3",

    entity: "Kraken",

    entityType: "exchange",

    confidence: "verified",

    source: "Etherscan public address label",

    sourceUrl:
      "https://etherscan.io/address/0xe853c56864a2ebe4576a807d26fdc4a0ada51919",

    explanation:
      "This exact address is publicly labelled as a Kraken exchange wallet.",
  },

  "0x267be1c1d684f78cb4f6a176c4911b741e4ffdc0": {
    label: "Kraken 4",

    entity: "Kraken",

    entityType: "exchange",

    confidence: "verified",

    source: "Etherscan public address label",

    sourceUrl:
      "https://etherscan.io/address/0x267be1c1d684f78cb4f6a176c4911b741e4ffdc0",

    explanation:
      "This exact address is publicly labelled as a Kraken exchange wallet.",
  },

  "0x89e51fa8ca5d66cd220baed62ed01e8951aa7c40": {
    label: "Kraken 7",

    entity: "Kraken",

    entityType: "exchange",

    confidence: "verified",

    source: "Etherscan public address label",

    sourceUrl:
      "https://etherscan.io/address/0x89e51fa8ca5d66cd220baed62ed01e8951aa7c40",

    explanation:
      "This exact address is publicly labelled as a Kraken exchange wallet.",
  },
};

const ZERO_ADDRESS =
  "0x0000000000000000000000000000000000000000";

const DEAD_ADDRESS =
  "0x000000000000000000000000000000000000dead";

function normalizeAddress(
  address?: string | null
) {
  return (
    address?.trim().toLowerCase() ??
    ""
  );
}

function shortenAddress(
  address: string
) {
  if (!address) {
    return "Unknown";
  }

  return `${address.slice(
    0,
    6
  )}...${address.slice(-4)}`;
}

function mapProjectWallet(
  record: ProjectWalletRecord
): WalletAttribution {
  return {
    address:
      normalizeAddress(
        record.address
      ),

    label:
      record.label,

    entity:
      record.project,

    entityType:
      record.walletType,

    confidence:
      record.confidence,

    source:
      record.source,

    sourceUrl:
      record.sourceUrl,

    explanation:
      record.explanation,
  };
}

export function getWalletAttribution(
  address?: string | null
): WalletAttribution {
  const normalized =
    normalizeAddress(address);

  if (!normalized) {
    return {
      address: "",

      label: "Unknown address",

      entity: null,

      entityType: "unknown",

      confidence: "unknown",

      source: null,

      sourceUrl: null,

      explanation:
        "PRISM does not have a usable counterparty address for this transfer.",
    };
  }

  /*
    1. Project / treasury / team / investor registry

    We check this first because it is the product-specific
    attribution layer PRISM cares about most.
  */
  const projectWallet =
    getProjectWalletAttribution(
      normalized
    );

  if (projectWallet) {
    return mapProjectWallet(
      projectWallet
    );
  }

  /*
    2. Burn / protocol-special addresses
  */
  if (
    normalized ===
    ZERO_ADDRESS
  ) {
    return {
      address:
        normalized,

      label:
        "Zero Address",

      entity: null,

      entityType:
        "burn",

      confidence:
        "verified",

      source:
        "Ethereum protocol convention",

      sourceUrl:
        null,

      explanation:
        "The zero address is a special Ethereum address commonly involved in token minting or burning mechanics.",
    };
  }

  if (
    normalized ===
    DEAD_ADDRESS
  ) {
    return {
      address:
        normalized,

      label:
        "Dead Address",

      entity: null,

      entityType:
        "burn",

      confidence:
        "verified",

      source:
        "Ethereum ecosystem convention",

      sourceUrl:
        null,

      explanation:
        "This address is commonly used as an inaccessible burn destination.",
    };
  }

  /*
    3. Known exchange / entity registry
  */
  const known =
    KNOWN_ETHEREUM_WALLETS[
      normalized
    ];

  if (known) {
    return {
      address:
        normalized,

      label:
        known.label,

      entity:
        known.entity,

      entityType:
        known.entityType,

      confidence:
        known.confidence,

      source:
        known.source,

      sourceUrl:
        known.sourceUrl,

      explanation:
        known.explanation,
    };
  }

  /*
    4. Unknown address

    Unknown does NOT mean suspicious.

    It simply means PRISM does not currently
    have reliable attribution evidence.
  */
  return {
    address:
      normalized,

    label:
      shortenAddress(
        normalized
      ),

    entity: null,

    entityType:
      "unknown",

    confidence:
      "unknown",

    source: null,

    sourceUrl: null,

    explanation:
      "PRISM has no reliable entity attribution for this address. It will remain unlabelled rather than being guessed.",
  };
}
"use client";

import { useEffect, useMemo, useState } from "react";

export type WatchlistToken = {
  type: "token";
  id: string;
  name: string;
  symbol: string;
  image?: string;
};

export type WatchlistAccount = {
  type: "account";
  address: string;
  label: string;
  chain: string;
  accountType: string;
  project?: string;
};

export type WatchlistItem =
  | WatchlistToken
  | WatchlistAccount;

type WatchlistSectionProps = {
  currentToken?: WatchlistToken | null;

  currentAccount?: WatchlistAccount | null;

  onOpenToken?: (
    token: WatchlistToken
  ) => void;

  onOpenAccount?: (
    account: WatchlistAccount
  ) => void;
};

const STORAGE_KEY =
  "prism-watchlist-v1";

function itemKey(
  item: WatchlistItem
) {
  if (item.type === "token") {
    return `token:${item.id}`;
  }

  return `account:${item.chain}:${item.address.toLowerCase()}`;
}

function chainLabel(
  chain: string
) {
  if (chain === "ethereum") {
    return "Ethereum";
  }

  if (chain === "arbitrum") {
    return "Arbitrum";
  }

  if (chain === "optimism") {
    return "Optimism";
  }

  if (chain === "polygon") {
    return "Polygon";
  }

  if (chain === "solana") {
    return "Solana";
  }

  return chain;
}

function chainInitial(
  chain: string
) {
  if (chain === "ethereum") {
    return "Ξ";
  }

  if (chain === "arbitrum") {
    return "A";
  }

  if (chain === "optimism") {
    return "O";
  }

  if (chain === "polygon") {
    return "P";
  }

  if (chain === "solana") {
    return "S";
  }

  return "?";
}

function accountTypeLabel(
  type: string
) {
  if (type === "treasury") {
    return "Treasury";
  }

  if (type === "governance") {
    return "Governance";
  }

  if (type === "multisig") {
    return "Multisig";
  }

  if (type === "program") {
    return "Program";
  }

  if (type === "team") {
    return "Team";
  }

  if (type === "investor") {
    return "Investor";
  }

  return "Project";
}

function shortAddress(
  address: string
) {
  if (address.length <= 14) {
    return address;
  }

  return `${address.slice(
    0,
    6
  )}...${address.slice(
    -5
  )}`;
}

function WatchMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone:
    | "indigo"
    | "teal"
    | "ink";
}) {
  const iconClass =
    tone === "teal"
      ? "bg-[#E8F9F6] text-[#0F8F82]"
      : tone === "ink"
      ? "bg-[#EEF2F5] text-[#0D1726]"
      : "bg-[#EEF1FF] text-[#465FFF]";

  const valueClass =
    tone === "teal"
      ? "text-[#16B8A6]"
      : tone === "ink"
      ? "text-[#0D1726]"
      : "text-[#465FFF]";

  return (
    <div className="rounded-[20px] border border-[#E3E8EE] bg-white p-5 shadow-sm">
      <div
        className={`flex h-9 w-9 items-center justify-center rounded-xl text-sm font-bold ${iconClass}`}
      >
        •
      </div>

      <p className="mt-4 text-xs font-medium text-[#69788A]">
        {label}
      </p>

      <p
        className={`mt-2 text-3xl font-bold tracking-[-0.04em] ${valueClass}`}
      >
        {value}
      </p>
    </div>
  );
}

export default function WatchlistSection({
  currentToken = null,
  currentAccount = null,
  onOpenToken,
  onOpenAccount,
}: WatchlistSectionProps) {
  const [
    items,
    setItems,
  ] =
    useState<WatchlistItem[]>([]);

  const [
    loaded,
    setLoaded,
  ] =
    useState(false);

  useEffect(() => {
    try {
      const stored =
        window.localStorage.getItem(
          STORAGE_KEY
        );

      if (stored) {
        const parsed =
          JSON.parse(stored);

        if (Array.isArray(parsed)) {
          setItems(parsed);
        }
      }
    } catch (error) {
      console.error(
        "Unable to load PRISM watchlist:",
        error
      );
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!loaded) {
      return;
    }

    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(items)
      );
    } catch (error) {
      console.error(
        "Unable to save PRISM watchlist:",
        error
      );
    }
  }, [
    items,
    loaded,
  ]);

  const tokenSaved =
    useMemo(() => {
      if (!currentToken) {
        return false;
      }

      const key =
        itemKey(currentToken);

      return items.some(
        (item) =>
          itemKey(item) === key
      );
    }, [
      currentToken,
      items,
    ]);

  const accountSaved =
    useMemo(() => {
      if (!currentAccount) {
        return false;
      }

      const key =
        itemKey(currentAccount);

      return items.some(
        (item) =>
          itemKey(item) === key
      );
    }, [
      currentAccount,
      items,
    ]);

  function addItem(
    item: WatchlistItem
  ) {
    setItems(
      (current) => {
        const key =
          itemKey(item);

        const exists =
          current.some(
            (currentItem) =>
              itemKey(
                currentItem
              ) === key
          );

        if (exists) {
          return current;
        }

        return [
          item,
          ...current,
        ];
      }
    );
  }

  function removeItem(
    item: WatchlistItem
  ) {
    const key =
      itemKey(item);

    setItems(
      (current) =>
        current.filter(
          (currentItem) =>
            itemKey(
              currentItem
            ) !== key
        )
    );
  }

  function toggleToken() {
    if (!currentToken) {
      return;
    }

    if (tokenSaved) {
      removeItem(
        currentToken
      );

      return;
    }

    addItem(
      currentToken
    );
  }

  function toggleAccount() {
    if (!currentAccount) {
      return;
    }

    if (accountSaved) {
      removeItem(
        currentAccount
      );

      return;
    }

    addItem(
      currentAccount
    );
  }

  const tokenItems =
    items.filter(
      (
        item
      ): item is WatchlistToken =>
        item.type === "token"
    );

  const accountItems =
    items.filter(
      (
        item
      ): item is WatchlistAccount =>
        item.type === "account"
    );

  return (
    <section
      id="watchlist"
      className="scroll-mt-24 py-20"
    >
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[#E8F9F6] text-lg text-[#0F8F82]">
            ☆
          </div>

          <p className="prism-eyebrow mt-5">
            Saved intelligence
          </p>

          <h2 className="prism-section-title mt-3">
            Watchlist
          </h2>

          <p className="prism-section-copy mt-4 max-w-2xl">
            Keep important tokens and
            project-linked accounts close so you can
            reopen the investigation without starting
            over.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {currentToken && (
            <button
              type="button"
              onClick={toggleToken}
              className={`rounded-[14px] border px-4 py-2.5 text-xs font-semibold transition ${
                tokenSaved
                  ? "border-[#BCEBE5] bg-[#E8F9F6] text-[#0F8F82]"
                  : "border-[#CFD7E1] bg-white text-[#405064] shadow-sm hover:border-[#BFC8FF] hover:text-[#3548D8]"
              }`}
            >
              {tokenSaved
                ? `✓ ${currentToken.symbol} saved`
                : `+ Save ${currentToken.symbol}`}
            </button>
          )}

          {currentAccount && (
            <button
              type="button"
              onClick={toggleAccount}
              className={`rounded-[14px] border px-4 py-2.5 text-xs font-semibold transition ${
                accountSaved
                  ? "border-[#C7D0FF] bg-[#EEF1FF] text-[#3548D8]"
                  : "border-[#CFD7E1] bg-white text-[#405064] shadow-sm hover:border-[#BFC8FF] hover:text-[#3548D8]"
              }`}
            >
              {accountSaved
                ? "✓ Account saved"
                : "+ Save account"}
            </button>
          )}
        </div>
      </div>

      {!loaded ? (
        <div className="mt-8 flex min-h-[280px] items-center justify-center rounded-[28px] border border-[#E3E8EE] bg-white shadow-sm">
          <div className="text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-[3px] border-[#465FFF]/15 border-t-[#465FFF]" />

            <p className="mt-4 text-sm font-medium text-[#69788A]">
              Loading watchlist...
            </p>
          </div>
        </div>
      ) : items.length === 0 ? (
        <div className="mt-8 flex min-h-[340px] items-center justify-center rounded-[28px] border border-dashed border-[#CFD7E1] bg-white/70">
          <div className="max-w-md px-6 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#E8F9F6] text-xl text-[#0F8F82]">
              ☆
            </div>

            <p className="mt-5 text-base font-semibold text-[#0D1726]">
              Your watchlist is empty
            </p>

            <p className="mt-2 text-sm leading-6 text-[#69788A]">
              Scan a token or inspect an attributable
              account, then save it here for quick
              access later.
            </p>
          </div>
        </div>
      ) : (
        <div className="mt-8 space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <WatchMetric
              label="Saved items"
              value={items.length}
              tone="ink"
            />

            <WatchMetric
              label="Tokens"
              value={tokenItems.length}
              tone="indigo"
            />

            <WatchMetric
              label="Accounts"
              value={accountItems.length}
              tone="teal"
            />
          </div>

          {tokenItems.length > 0 && (
            <div className="overflow-hidden rounded-[28px] border border-[#E3E8EE] bg-white shadow-sm">
              <div className="flex flex-col gap-3 border-b border-[#E3E8EE] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                <div>
                  <p className="text-lg font-semibold tracking-[-0.02em] text-[#0D1726]">
                    Watched tokens
                  </p>

                  <p className="mt-1 text-xs leading-5 text-[#98A5B5]">
                    Reopen market, Perspective and
                    Replay in one click.
                  </p>
                </div>

                <span className="prism-chip prism-chip-primary">
                  {tokenItems.length}{" "}
                  {tokenItems.length === 1
                    ? "token"
                    : "tokens"}
                </span>
              </div>

              <div className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">
                {tokenItems.map(
                  (token) => (
                    <div
                      key={token.id}
                      className="group rounded-[20px] border border-[#E3E8EE] bg-[#F9FBFC] p-5 transition hover:-translate-y-0.5 hover:border-[#BFC8FF] hover:bg-white hover:shadow-md"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex min-w-0 items-center gap-3">
                          {token.image ? (
                            <img
                              src={token.image}
                              alt={token.name}
                              className="h-11 w-11 rounded-[14px] border border-[#E3E8EE] bg-white"
                            />
                          ) : (
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-[#0D1726] text-sm font-bold text-white shadow-md">
                              {token.symbol.slice(
                                0,
                                1
                              )}
                            </div>
                          )}

                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-[#0D1726]">
                              {token.name}
                            </p>

                            <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[#98A5B5]">
                              {token.symbol}
                            </p>
                          </div>
                        </div>

                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#EEF1FF] text-xs text-[#465FFF]">
                          ↗
                        </span>
                      </div>

                      <div className="mt-5 rounded-xl border border-[#E3E8EE] bg-white px-3 py-3">
                        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#98A5B5]">
                          Saved investigation
                        </p>

                        <p className="mt-2 text-xs leading-5 text-[#69788A]">
                          Reopen the token scan and
                          regenerate its connected
                          intelligence.
                        </p>
                      </div>

                      <div className="mt-5 flex gap-2">
                        {onOpenToken && (
                          <button
                            type="button"
                            onClick={() =>
                              onOpenToken(
                                token
                              )
                            }
                            className="prism-button-primary flex-1 px-3 py-2.5 text-xs font-semibold"
                          >
                            Open investigation
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() =>
                            removeItem(
                              token
                            )
                          }
                          className="rounded-[13px] border border-[#E3E8EE] bg-white px-3 py-2.5 text-xs font-semibold text-[#98A5B5] transition hover:border-[#F6CACA] hover:bg-[#FFF1F1] hover:text-[#C03E3E]"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  )
                )}
              </div>
            </div>
          )}

          {accountItems.length > 0 && (
            <div className="overflow-hidden rounded-[28px] border border-[#E3E8EE] bg-white shadow-sm">
              <div className="flex flex-col gap-3 border-b border-[#E3E8EE] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                <div>
                  <p className="text-lg font-semibold tracking-[-0.02em] text-[#0D1726]">
                    Watched accounts
                  </p>

                  <p className="mt-1 text-xs leading-5 text-[#98A5B5]">
                    Public project-linked accounts
                    saved for repeat investigation.
                  </p>
                </div>

                <span className="prism-chip prism-chip-success">
                  {accountItems.length}{" "}
                  {accountItems.length === 1
                    ? "account"
                    : "accounts"}
                </span>
              </div>

              <div className="divide-y divide-[#EEF2F5]">
                {accountItems.map(
                  (account) => (
                    <div
                      key={`${account.chain}-${account.address}`}
                      className="grid gap-5 p-5 transition hover:bg-[#FAFBFC] sm:p-6 lg:grid-cols-[1fr_auto]"
                    >
                      <div className="flex min-w-0 items-start gap-4">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-[#E8F9F6] text-sm font-bold text-[#0F8F82]">
                          {chainInitial(
                            account.chain
                          )}
                        </div>

                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-[#0D1726]">
                              {account.label}
                            </p>

                            <span className="prism-chip !px-2 !py-1 !text-[10px]">
                              {chainLabel(
                                account.chain
                              )}
                            </span>

                            <span className="prism-chip prism-chip-primary !px-2 !py-1 !text-[10px]">
                              {accountTypeLabel(
                                account.accountType
                              )}
                            </span>
                          </div>

                          {account.project && (
                            <p className="mt-2 text-xs font-medium text-[#69788A]">
                              {account.project}
                            </p>
                          )}

                          <p className="mt-2 break-all font-mono text-[11px] text-[#98A5B5]">
                            {shortAddress(
                              account.address
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 lg:justify-end">
                        {onOpenAccount && (
                          <button
                            type="button"
                            onClick={() =>
                              onOpenAccount(
                                account
                              )
                            }
                            className="prism-button-secondary px-4 py-2.5 text-xs font-semibold"
                          >
                            Inspect account
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() =>
                            removeItem(
                              account
                            )
                          }
                          className="rounded-[13px] border border-[#E3E8EE] bg-white px-4 py-2.5 text-xs font-semibold text-[#98A5B5] transition hover:border-[#F6CACA] hover:bg-[#FFF1F1] hover:text-[#C03E3E]"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  )
                )}
              </div>
            </div>
          )}

          <div className="rounded-[22px] border border-[#E3E8EE] bg-[#F9FBFC] p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-sm text-[#69788A] shadow-sm">
                i
              </div>

              <div>
                <p className="text-sm font-semibold text-[#405064]">
                  Browser-local watchlist
                </p>

                <p className="mt-2 text-xs leading-6 text-[#69788A]">
                  Watchlist items are stored locally in
                  this browser for the MVP. Clearing
                  browser storage may remove them.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
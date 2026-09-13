"use client";

import { useEffect } from "react";

function setNativeInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value"
  )?.set;

  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function getMoverSymbol(button: HTMLButtonElement) {
  const article = button.closest("article");
  if (!article) return "";

  const pairText = Array.from(article.querySelectorAll("span"))
    .map((node) => node.textContent?.trim() ?? "")
    .find((text) => /^[A-Z0-9._-]+\/(USDT|USDC|USD|FDUSD)$/i.test(text));

  if (pairText) return pairText.split("/")[0]?.trim().toUpperCase() ?? "";

  const candidate = Array.from(article.querySelectorAll("span"))
    .map((node) => node.textContent?.trim() ?? "")
    .find((text) => /^[A-Z0-9._-]{2,20}$/i.test(text));

  return candidate?.toUpperCase() ?? "";
}

export default function MarketMoverInvestigationBridge() {
  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const button = target.closest<HTMLButtonElement>("button");
      if (!button) return;

      const text = button.textContent?.replace(/\s+/g, " ").trim().toLowerCase() ?? "";
      if (text !== "investigate") return;

      const host = button.closest("[data-prism-market-movers='true']");
      if (!host) return;

      const symbol = getMoverSymbol(button);
      if (!symbol) return;

      const input = document.querySelector<HTMLInputElement>(
        'input[aria-label="Search by token name, symbol, or contract address"]'
      );
      if (!input) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      const scan = document.getElementById("scan");
      scan?.scrollIntoView({ behavior: "auto", block: "start" });

      // Avoid keeping the search field focused while the investigation results are
      // being rebuilt. This prevents the browser from repeatedly restoring the
      // field into view and fighting normal page scrolling.
      setNativeInputValue(input, symbol);
      input.blur();

      window.setTimeout(() => {
        const scanButtons = Array.from(
          document.querySelectorAll<HTMLButtonElement>("#scan button")
        );
        const runButton = scanButtons.find((candidate) => {
          const label = candidate.textContent?.toLowerCase() ?? "";
          return label.includes("run prism scan") || label.includes("run scan");
        });

        runButton?.click();

        // PRISM does not use a modal for this handoff, so the document must remain
        // scrollable after an investigation is started from Market Movers.
        document.documentElement.style.removeProperty("overflow");
        document.documentElement.style.removeProperty("overflow-y");
        document.body.style.removeProperty("overflow");
        document.body.style.removeProperty("overflow-y");
      }, 80);
    };

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, []);

  return null;
}

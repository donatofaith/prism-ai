"use client";

import { useEffect } from "react";

function replaceButtonLabel(button: HTMLButtonElement, label: string) {
  const textNodes = Array.from(button.childNodes).filter(
    (node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim()
  );

  if (textNodes.length > 0) {
    textNodes[0].textContent = ` ${label} `;
    return;
  }

  const spans = Array.from(button.querySelectorAll("span"));
  const candidate = spans.find((span) => {
    const text = span.textContent?.trim().toLowerCase() ?? "";
    return (
      text === "perspective" ||
      text === "view" ||
      text === "unlocks" ||
      text === "scan" ||
      text === "investigate" ||
      text.includes("saved investigations")
    );
  });

  if (candidate) candidate.textContent = label;
}

function ensureUnlockHost() {
  const section = document.getElementById("perspective");
  const watchlist = document.getElementById("watchlist");

  if (!(section instanceof HTMLElement)) return;

  section.style.display = "";
  section.removeAttribute("aria-hidden");
  section.dataset.prismUnlockSection = "true";

  if (watchlist instanceof HTMLElement) {
    const watchlistParent = watchlist.parentElement;
    if (
      watchlistParent &&
      (section.parentElement !== watchlistParent || section.nextElementSibling !== watchlist)
    ) {
      watchlistParent.insertBefore(section, watchlist);
    }
  }

  Array.from(section.children).forEach((child) => {
    if (!(child instanceof HTMLElement)) return;
    if (child.dataset.prismUnlockHost === "true") return;
    child.style.display = "none";
    child.setAttribute("aria-hidden", "true");
  });

  let host = section.querySelector<HTMLElement>("[data-prism-unlock-host='true']");

  if (!host) {
    host = document.createElement("div");
    host.dataset.prismUnlockHost = "true";
    host.className = "prism-container py-8 sm:py-10 lg:py-12";
    section.appendChild(host);
  }
}

function ensureDiscoveryButton(container: Element | null) {
  if (!container) return;
  if (container.querySelector("[data-prism-discover-nav='true']")) return;

  const first = container.querySelector<HTMLButtonElement>("button");
  if (!first?.parentElement) return;

  const button = document.createElement("button");
  button.type = "button";
  button.dataset.prismDiscoverNav = "true";
  button.className = first.className;
  button.setAttribute("aria-label", "Discover market movers");

  const badge = document.createElement("span");
  const firstBadge = first.querySelector("span");
  badge.className = firstBadge?.className ?? "";
  badge.textContent = "01";

  const label = document.createTextNode(" Discover ");
  button.appendChild(badge);
  button.appendChild(label);

  button.addEventListener("click", () => {
    document.getElementById("discover")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  first.parentElement.insertBefore(button, first);
}

function reorderNav(container: Element | null) {
  if (!container) return;

  ensureDiscoveryButton(container);

  const buttons = Array.from(container.querySelectorAll<HTMLButtonElement>("button"));

  const scanButton = buttons.find((button) => {
    if (button.dataset.prismDiscoverNav === "true") return false;
    const text = button.textContent?.replace(/\s+/g, " ").trim().toLowerCase() ?? "";
    return text.includes("scan") || text.endsWith(" investigate");
  });

  if (scanButton) replaceButtonLabel(scanButton, "Investigate");

  const unlockButton = buttons.find((button) => {
    const text = button.textContent?.replace(/\s+/g, " ").trim().toLowerCase() ?? "";
    return text.includes("perspective") || text.includes("unlocks") || text.includes(" view");
  });

  const watchlistButton = buttons.find((button) =>
    (button.textContent?.toLowerCase() ?? "").includes("watchlist")
  );

  if (unlockButton) {
    replaceButtonLabel(unlockButton, "Unlocks");
    unlockButton.style.display = "";
    unlockButton.removeAttribute("aria-hidden");
  }

  if (unlockButton && watchlistButton) {
    const navParent = watchlistButton.parentElement;
    if (
      navParent &&
      unlockButton.parentElement === navParent &&
      unlockButton.nextElementSibling !== watchlistButton
    ) {
      navParent.insertBefore(unlockButton, watchlistButton);
    }
  }

  const visibleButtons = Array.from(
    container.querySelectorAll<HTMLButtonElement>("button")
  ).filter((button) => button.style.display !== "none");

  visibleButtons.forEach((button, index) => {
    const badge = button.querySelector("span");
    if (badge) badge.textContent = String(index + 1).padStart(2, "0");
  });
}

function cleanPerspectiveUI() {
  ensureUnlockHost();

  document.querySelectorAll<HTMLButtonElement>("button").forEach((button) => {
    const text = button.textContent?.replace(/\s+/g, " ").trim().toLowerCase() ?? "";

    if (text.includes("continue to prism perspective")) {
      replaceButtonLabel(button, "Continue to Unlock Intelligence");
      button.dataset.prismUnlockContinue = "true";
      return;
    }

    if (text.includes("review your saved investigations")) {
      replaceButtonLabel(button, "Continue to Unlock Intelligence");
      button.dataset.prismUnlockContinue = "true";
      return;
    }

    if (text.includes("perspective") || text.includes(" view")) {
      replaceButtonLabel(button, "Unlocks");
    }
  });

  reorderNav(document.querySelector("header nav"));
  reorderNav(document.querySelector("header .overflow-x-auto"));
}

export default function RemovePerspectiveUI() {
  useEffect(() => {
    let frame = 0;

    const run = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(cleanPerspectiveUI);
    };

    const handleClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const button = target.closest<HTMLButtonElement>("button");
      if (!button) return;

      const text = button.textContent?.replace(/\s+/g, " ").trim().toLowerCase() ?? "";

      if (
        button.dataset.prismUnlockContinue === "true" ||
        text.includes("continue to unlock intelligence")
      ) {
        const section = document.getElementById("perspective");
        if (!section) return;
        event.preventDefault();
        event.stopPropagation();
        section.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    };

    run();

    const observer = new MutationObserver(run);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    document.addEventListener("click", handleClick, true);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener("click", handleClick, true);
    };
  }, []);

  return null;
}

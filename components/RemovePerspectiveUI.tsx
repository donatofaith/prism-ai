"use client";

import { useEffect } from "react";

function hideElement(element: Element | null) {
  if (!(element instanceof HTMLElement)) return;
  element.style.display = "none";
  element.setAttribute("aria-hidden", "true");
}

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
    return text === "perspective" || text === "view";
  });
  if (candidate) candidate.textContent = label;
}

function ensureUnlockHost() {
  const section = document.getElementById("perspective");
  if (!section) return;

  section.style.display = "";
  section.removeAttribute("aria-hidden");
  section.dataset.prismUnlockSection = "true";

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
    host.className = "prism-container py-14 sm:py-20";
    section.appendChild(host);
  }
}

function cleanPerspectiveUI() {
  ensureUnlockHost();

  // The old Investigation Pipeline card is tied to the removed Perspective API,
  // so keep it out of the pipeline rather than showing a misleading status.
  document
    .querySelectorAll<HTMLElement>('a[href="#perspective"]')
    .forEach(hideElement);

  document.querySelectorAll<HTMLButtonElement>("button").forEach((button) => {
    const text = button.textContent?.replace(/\s+/g, " ").trim().toLowerCase() ?? "";

    if (text.includes("continue to prism perspective")) {
      replaceButtonLabel(button, "Continue to Unlock Intelligence");
      button.style.display = "";
      button.removeAttribute("aria-hidden");
      return;
    }

    if (text.includes("perspective")) {
      replaceButtonLabel(button, "Unlocks");
      button.style.display = "";
      button.removeAttribute("aria-hidden");
      return;
    }

    if (text === "03 view" || text === "view") {
      replaceButtonLabel(button, "Unlocks");
      button.style.display = "";
      button.removeAttribute("aria-hidden");
    }
  });

  const desktopNav = document.querySelector("header nav");
  if (desktopNav) {
    const buttons = Array.from(desktopNav.querySelectorAll<HTMLButtonElement>("button")).filter(
      (button) => button.style.display !== "none"
    );
    buttons.forEach((button, index) => {
      const badge = button.querySelector("span");
      if (badge) badge.textContent = String(index + 1).padStart(2, "0");
    });
  }

  const mobileNav = document.querySelector("header .overflow-x-auto");
  if (mobileNav) {
    const buttons = Array.from(mobileNav.querySelectorAll<HTMLButtonElement>("button")).filter(
      (button) => button.style.display !== "none"
    );
    buttons.forEach((button, index) => {
      const badge = button.querySelector("span");
      if (badge) badge.textContent = String(index + 1).padStart(2, "0");
    });
  }
}

export default function RemovePerspectiveUI() {
  useEffect(() => {
    let frame = 0;

    const run = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(cleanPerspectiveUI);
    };

    run();

    const observer = new MutationObserver(run);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  return null;
}

"use client";

import { useEffect } from "react";

function hideElement(element: Element | null) {
  if (!(element instanceof HTMLElement)) return;
  element.style.display = "none";
  element.setAttribute("aria-hidden", "true");
  element.dataset.prismPerspectiveHidden = "true";
}

function cleanPerspectiveUI() {
  hideElement(document.getElementById("perspective"));

  document
    .querySelectorAll<HTMLElement>('a[href="#perspective"]')
    .forEach(hideElement);

  document.querySelectorAll<HTMLButtonElement>("button").forEach((button) => {
    const text = button.textContent?.replace(/\s+/g, " ").trim().toLowerCase() ?? "";

    if (
      text.includes("perspective") ||
      text === "03 view" ||
      text === "view"
    ) {
      const continueWrapper = button.closest("div.flex.justify-center");
      hideElement(continueWrapper ?? button);
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

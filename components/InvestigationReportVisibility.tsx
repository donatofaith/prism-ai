"use client";

import { useEffect } from "react";

export default function InvestigationReportVisibility() {
  useEffect(() => {
    let frame = 0;

    const hideIfIdle = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const section = document.getElementById("investigation-report");
        if (!(section instanceof HTMLElement)) return;

        const hasContent = Boolean(
          section.querySelector("[data-prism-investigation-story='true']")?.textContent?.includes("Investigation") &&
          !section.textContent?.includes("Run a PRISM scan to build one complete investigation report.")
        );

        if (!hasContent && section.dataset.prismReportOpened !== "true") {
          section.style.display = "none";
        }
      });
    };

    const reveal = () => {
      const section = document.getElementById("investigation-report");
      if (!(section instanceof HTMLElement)) return;
      section.dataset.prismReportOpened = "true";
      section.style.display = "";
    };

    const handleClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const button = target.closest<HTMLButtonElement>("button");
      if (!button) return;

      const text = button.textContent?.replace(/\s+/g, " ").trim().toLowerCase() ?? "";
      const isScan = text.includes("run prism scan") || text === "run scan";
      const isMoverInvestigation =
        text === "investigate" && Boolean(button.closest("[data-prism-market-movers='true']"));

      if (!isScan && !isMoverInvestigation) return;
      window.setTimeout(reveal, isMoverInvestigation ? 120 : 20);
    };

    hideIfIdle();
    const observer = new MutationObserver(hideIfIdle);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    document.addEventListener("click", handleClick, true);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener("click", handleClick, true);
    };
  }, []);

  return null;
}

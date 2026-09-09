"use client";

type ScanStage =
  | "idle"
  | "resolving"
  | "market"
  | "accounts"
  | "history"
  | "perspective"
  | "complete";

type ScanProgressProps = {
  stage: ScanStage;
};

const stages = [
  {
    key: "resolving",
    label: "Resolving token",
    description:
      "Finding the correct asset and market identity.",
  },
  {
    key: "market",
    label: "Loading market",
    description:
      "Reading price, volume and market-cap activity.",
  },
  {
    key: "accounts",
    label: "Checking attribution",
    description:
      "Looking for evidence-backed project accounts.",
  },
  {
    key: "history",
    label: "Searching history",
    description:
      "Comparing the current move with previous periods.",
  },
  {
    key: "perspective",
    label: "Building Perspective",
    description:
      "Connecting the strongest evidence into context.",
  },
] as const;

const order: ScanStage[] = [
  "idle",
  "resolving",
  "market",
  "accounts",
  "history",
  "perspective",
  "complete",
];

function stageIndex(stage: ScanStage) {
  return order.indexOf(stage);
}

export default function ScanProgress({
  stage,
}: ScanProgressProps) {
  if (stage === "idle") {
    return null;
  }

  const currentIndex =
    stageIndex(stage);

  const complete =
    stage === "complete";

  const progress =
    complete
      ? 100
      : Math.max(
          8,
          Math.min(
            92,
            ((currentIndex - 1) /
              stages.length) *
              100
          )
        );

  return (
    <div className="mt-4 overflow-hidden rounded-[20px] border border-[#DCE3E9] bg-white/95 shadow-[0_14px_38px_rgba(13,23,38,0.08)] backdrop-blur-xl">
      <div className="border-b border-[#E7EBF0] px-4 py-4 sm:px-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-[#98A5B5]">
              PRISM investigation
            </p>

            <p className="mt-1 text-sm font-semibold text-[#0D1726]">
              {complete
                ? "Investigation complete"
                : "Building your intelligence view"}
            </p>
          </div>

          <div
            className={`flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5 text-[10px] font-bold ${
              complete
                ? "bg-[#E8F9F6] text-[#0F8F82]"
                : "bg-[#EEF1FF] text-[#3548D8]"
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                complete
                  ? "bg-[#16B8A6]"
                  : "animate-pulse bg-[#465FFF]"
              }`}
            />

            {complete
              ? "Complete"
              : "Live"}
          </div>
        </div>

        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[#EEF2F5]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#465FFF] via-[#3F70DF] to-[#16B8A6] transition-[width] duration-700 ease-out"
            style={{
              width: `${progress}%`,
            }}
          />
        </div>
      </div>

      <div className="p-3 sm:p-4">
        <div className="space-y-1.5">
          {stages.map(
            (item) => {
              const itemIndex =
                stageIndex(
                  item.key
                );

              const done =
                complete ||
                currentIndex >
                  itemIndex;

              const active =
                !complete &&
                stage ===
                  item.key;

              return (
                <div
                  key={
                    item.key
                  }
                  className={`flex items-start gap-3 rounded-[15px] px-3 py-3 transition-all duration-300 ${
                    active
                      ? "bg-[#F3F5FF]"
                      : ""
                  }`}
                >
                  <div
                    className={`relative mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold transition-all duration-300 ${
                      done
                        ? "bg-[#E8F9F6] text-[#0F8F82]"
                        : active
                        ? "bg-[#465FFF] text-white shadow-[0_5px_14px_rgba(70,95,255,0.25)]"
                        : "bg-[#EEF2F5] text-[#98A5B5]"
                    }`}
                  >
                    {done ? (
                      "✓"
                    ) : active ? (
                      <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
                    ) : (
                      "•"
                    )}
                  </div>

                  <div className="min-w-0">
                    <p
                      className={`text-xs font-semibold transition ${
                        active ||
                        done
                          ? "text-[#0D1726]"
                          : "text-[#98A5B5]"
                      }`}
                    >
                      {
                        item.label
                      }
                    </p>

                    <p
                      className={`mt-1 text-[11px] leading-5 transition ${
                        active
                          ? "text-[#69788A]"
                          : "text-[#B1BBC7]"
                      }`}
                    >
                      {
                        item.description
                      }
                    </p>
                  </div>
                </div>
              );
            }
          )}
        </div>
      </div>
    </div>
  );
}

export type {
  ScanStage,
};
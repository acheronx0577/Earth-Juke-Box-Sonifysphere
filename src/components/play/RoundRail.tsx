import type { GuessHistoryEntry } from "@/lib/guessSession";

export function RoundRail({
  count,
  index,
  done,
  history,
}: {
  readonly count: number;
  readonly index: number;
  readonly done: boolean;
  readonly history: readonly Pick<GuessHistoryEntry, "correct">[];
}) {
  return (
    <ol className="sonify-rail" aria-label="Rounds">
      {Array.from({ length: count }, (_, item) => {
        const past = history[item];
        let state: "upcoming" | "current" | "named" | "missed" = "upcoming";
        if (past) state = past.correct ? "named" : "missed";
        else if (!done && item === index) state = "current";
        const cue = state === "named" ? "✓" : state === "missed" ? "✕" : state === "current" ? "NOW" : "";
        const spoken = state === "named" ? ", named" : state === "missed" ? ", missed" : state === "current" ? ", current" : "";
        return (
          <li
            key={item}
            data-state={state}
            aria-current={state === "current" ? "step" : undefined}
            aria-label={`Round ${item + 1}${spoken}`}
          >
            <span>{item + 1}</span>
            <span className="sonify-rail-lab">{cue}</span>
          </li>
        );
      })}
    </ol>
  );
}

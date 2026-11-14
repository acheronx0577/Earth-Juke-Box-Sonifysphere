const STEPS = ["Fill the slots", "Set the tempo", "Compile & play", "Keep it"] as const;

export function ComposeStepper({ step }: { readonly step: 1 | 2 | 3 | 4 }) {
  return (
    <ol className="sonify-stepper" aria-label="Steps">
      {STEPS.map((label, index) => {
        const number = index + 1;
        const state = number < step ? "done" : number === step ? "now" : "upcoming";
        return (
          <li key={label} data-state={state} aria-current={state === "now" ? "step" : undefined}>
            <span className="sonify-sq" aria-hidden="true">
              {state === "done" ? "✓" : number}
            </span>
            <span className="sonify-step-lab">{label}</span>
          </li>
        );
      })}
    </ol>
  );
}

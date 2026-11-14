"use client";

function focusMain(event: { preventDefault: () => void }) {
  event.preventDefault();
  const started = performance.now();
  const attempt = () => {
    const ready = document.documentElement.dataset.sonifyReady === "1";
    const target = document.getElementById("main-content");
    if (target && target.tabIndex < 0) target.tabIndex = -1;
    if (ready && target) {
      target.focus({ preventScroll: false });
      if (document.activeElement === target) return;
    }
    if (performance.now() - started < 2000) requestAnimationFrame(attempt);
  };
  attempt();
}

export function SkipLink() {
  return (
    <a
      className="sonify-skip"
      href="#main-content"
      onClick={focusMain}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") focusMain(event);
      }}
    >
      Skip to content
    </a>
  );
}

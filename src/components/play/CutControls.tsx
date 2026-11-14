import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { chamferClip } from "@/components/listen/chamfer";

const CLIP = chamferClip(8);
const CHOICE_CLIP = chamferClip(10);

export const CutButton = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & {
    readonly solid?: boolean;
    readonly variant?: "default" | "choice";
    readonly children: ReactNode;
  }
>(function CutButton({ children, solid = false, variant = "default", className = "", ...props }, ref) {
  const clip = variant === "choice" ? CHOICE_CLIP : CLIP;
  return (
    <button
      {...props}
      ref={ref}
      type="button"
      className={`sonify-cut-shell ${solid ? "is-solid" : ""} ${variant === "choice" ? "is-choice" : ""} ${className}`}
      style={{ clipPath: clip }}
    >
      <span className="sonify-cut-face" style={{ clipPath: clip }}>
        {children}
      </span>
    </button>
  );
});


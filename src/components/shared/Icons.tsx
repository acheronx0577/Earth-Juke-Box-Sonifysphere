interface IconProps {
  readonly className?: string;
}

export function IconPlay({ className }: IconProps) {
  return (
    <svg className={className} width="10" height="12" viewBox="0 0 10 12" aria-hidden="true">
      <path d="M0 0L10 6L0 12V0Z" fill="currentColor" />
    </svg>
  );
}

export function IconPause({ className }: IconProps) {
  return (
    <svg className={className} width="10" height="12" viewBox="0 0 10 12" aria-hidden="true">
      <path d="M0 0h3v12H0zM7 0h3v12H7z" fill="currentColor" />
    </svg>
  );
}

export function IconStop({ className }: IconProps) {
  return (
    <svg className={className} width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
      <rect width="10" height="10" fill="currentColor" />
    </svg>
  );
}

export function IconReplay({ className }: IconProps) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M2 7a5 5 0 1 0 1.2-3.2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M2 2.2V5h2.8" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function IconDownload({ className }: IconProps) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M7 1.5v7" stroke="currentColor" strokeWidth="1.5" />
      <path d="M4 6.5 7 9.5 10 6.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M2.5 12h9" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function IconShare({ className }: IconProps) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <circle cx="3" cy="7" r="1.4" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="11" cy="3.2" r="1.4" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="11" cy="10.8" r="1.4" stroke="currentColor" strokeWidth="1.5" />
      <path d="M4.4 6.3 9.5 3.8M4.4 7.7l5.1 2.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function IconChevron({ className, direction }: IconProps & { readonly direction: "left" | "right" | "down" }) {
  const rotation = direction === "left" ? 180 : direction === "down" ? 90 : 0;
  return (
    <svg className={className} width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true" style={{ transform: `rotate(${rotation}deg)` }}>
      <path d="M3 1.5 7 5 3 8.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function IconExpand({ className }: IconProps) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M3 11 11 3" stroke="currentColor" strokeWidth="1.5" />
      <path d="M6 3h5v5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function SignalMeter({ live }: { readonly live: boolean }) {
  return (
    <span className="sonify-meter" data-live={live ? "true" : "false"} aria-hidden="true">
      <span />
      <span />
      <span />
      <span />
      <span />
    </span>
  );
}

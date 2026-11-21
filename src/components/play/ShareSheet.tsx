"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import frame from "./guessShare.module.css";
import styles from "./shareSheet.module.css";

export type ShareSheetProps = {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly title: string;
  readonly detail?: string;
  readonly url: string;
  readonly shareText?: string;
  readonly onSaveImage: () => Promise<void> | void;
};

function CopyIcon() {
  return (
    <svg className={frame.copyGlyph} viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path d="M9 8.75h10.25V19H9V8.75Z" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M4.75 15.25V4.75H15.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function focusableIn(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>("button, a[href], input, select, textarea")].filter((element) => {
    if (element.hasAttribute("disabled")) return false;
    if (element.getAttribute("aria-hidden") === "true") return false;
    if (element.tabIndex === -1) return false;
    return element.getClientRects().length > 0;
  });
}

async function writeClipboard(value: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const input = document.createElement("textarea");
  input.value = value;
  input.setAttribute("readonly", "");
  input.style.position = "fixed";
  input.style.opacity = "0";
  document.body.appendChild(input);
  input.select();
  const copied = document.execCommand("copy");
  input.remove();
  if (!copied) throw new Error("copy failed");
}

export function ShareSheet({ open, onClose, title, detail, url, shareText, onSaveImage }: ShareSheetProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      setCopied(false);
      setStatus("");
      return;
    }
    const root = dialogRef.current;
    if (!root) return;
    const previously = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const main = document.getElementById("main-content");
    if (main instanceof HTMLElement) main.inert = true;
    const initial = window.setTimeout(() => focusableIn(root)[0]?.focus(), 0);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const nextItems = focusableIn(root);
      if (!nextItems.length) {
        event.preventDefault();
        return;
      }
      const first = nextItems[0];
      const last = nextItems[nextItems.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !root.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !root.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(initial);
      document.removeEventListener("keydown", onKey);
      if (main instanceof HTMLElement) main.inert = false;
      previously?.focus();
    };
  }, [open]);

  if (!open || !mounted) return null;

  const message = shareText?.trim() || title;
  const xHref = `https://x.com/intent/post?text=${encodeURIComponent(`${message} ${url}`)}`;

  const copy = async () => {
    try {
      await writeClipboard(url);
      setCopied(true);
      setStatus("Copied");
    } catch {
      setCopied(false);
      setStatus("Select the link and copy it.");
    }
  };

  const save = async () => {
    try {
      await onSaveImage();
      setStatus("Image downloaded.");
    } catch {
      setStatus("The image could not be saved.");
    }
  };

  return createPortal(
    <div
      className={frame.backdrop}
      data-hide-target-cursor="true"
      data-testid="share-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className={`${frame.dialog} ${frame.cutShell}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-testid="share-dialog"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className={frame.cutFace}>
          <div className={frame.head}>
            <h2 id={titleId}>{title}</h2>
            <span className={frame.focusRing}>
              <button type="button" className={`${frame.close} ${frame.cutShell}`} aria-label="Close share" data-testid="share-close" onClick={onClose}>
                <span className={frame.cutFace} aria-hidden="true">
                  ×
                </span>
              </button>
            </span>
          </div>
          {detail ? <p className={styles.detail}>{detail}</p> : null}
          <div className={`${frame.urlShell} ${frame.cutShell}`}>
            <div className={`${frame.urlFace} ${frame.cutFace}`}>
              <p className={frame.urlNarrow} data-testid="share-url">
                {url}
              </p>
              <button
                type="button"
                className={`${frame.copyButton} ${frame.cutShell}`}
                data-testid="share-copy"
                data-done={copied ? "true" : "false"}
                aria-label="Copy link"
                onClick={() => void copy()}
              >
                <span className={frame.cutFace}>{copied ? "Copied" : <CopyIcon />}</span>
              </button>
            </div>
          </div>
          <div className={frame.actions}>
            <span className={frame.focusRing}>
              <button type="button" className={`${frame.action} ${frame.cutShell}`} data-testid="share-image" onClick={() => void save()}>
                <span className={frame.cutFace}>Save image</span>
              </button>
            </span>
            <span className={frame.focusRing}>
              <a className={`${frame.action} ${frame.cutShell}`} data-testid="share-x" href={xHref} target="_blank" rel="noopener noreferrer">
                <span className={frame.cutFace}>Share to X</span>
              </a>
            </span>
          </div>
          <p className={frame.live} role="status">
            {status}
          </p>
        </div>
      </div>
    </div>,
    document.body,
  );
}

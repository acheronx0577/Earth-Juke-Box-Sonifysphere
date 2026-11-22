"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import styles from "./guessShare.module.css";

/**
 * Share dialog for the guess results screen only.
 * Props stay narrow so a shared compose popup can replace this module later
 * without changing the results screen's call site.
 */
export interface GuessShareRequest {
  readonly title: string;
  readonly text: string;
  readonly path: string;
  readonly marks?: readonly ("yes" | "no")[];
}

const FOCUSABLE = 'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

function absoluteUrl(path: string): string {
  return new URL(path, window.location.origin).toString();
}

function xHref(url: string, title: string, text: string): string {
  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(`${title}. ${text} ${url}`)}`;
}

function CopyIcon() {
  return (
    <svg className={styles.copyGlyph} viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path d="M9 8.75h10.25V19H9V8.75Z" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M4.75 15.25V4.75H15.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
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
  if (!copied) throw new Error("Clipboard access was blocked.");
}

export function GuessSharePopup({
  open,
  request,
  onClose,
  onSaveImage,
}: {
  readonly open: boolean;
  readonly request: GuessShareRequest;
  readonly onClose: () => void;
  readonly onSaveImage: () => void | Promise<void>;
}) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const restoreRef = useRef<HTMLElement | null>(null);
  const [copied, setCopied] = useState(false);
  const [url, setUrl] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!open) return;
    restoreRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setCopied(false);
    setNotice("");
    setUrl(absoluteUrl(request.path));
  }, [open, request.path]);

  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const focusables = () =>
      Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (node) => !node.hasAttribute("disabled") && node.tabIndex !== -1 && node.getClientRects().length > 0,
      );
    const initial = window.setTimeout(() => focusables()[0]?.focus(), 0);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) {
        event.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !dialog.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !dialog.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => {
      window.clearTimeout(initial);
      document.removeEventListener("keydown", onKey, true);
      restoreRef.current?.focus();
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  const copy = async () => {
    try {
      await writeClipboard(url || absoluteUrl(request.path));
      setCopied(true);
      setNotice("Copied");
    } catch (error) {
      setCopied(false);
      setNotice(error instanceof Error ? error.message : "The link could not be copied.");
    }
  };

  return createPortal(
    <div className={styles.backdrop} data-testid="guess-share-backdrop" data-hide-target-cursor="true" onMouseDown={onClose}>
      <div
        ref={dialogRef}
        className={`${styles.dialog} ${styles.cutShell}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-testid="guess-share-popup"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className={styles.cutFace}>
        <div className={styles.head}>
          <h2 id={titleId}>Share this result</h2>
          <span className={styles.focusRing}>
            <button type="button" className={`${styles.close} ${styles.cutShell}`} aria-label="Close share" onClick={onClose}>
              <span className={styles.cutFace} aria-hidden="true">×</span>
            </button>
          </span>
        </div>
        <div className={styles.preview} data-testid="guess-share-preview">
          <p>{request.title}</p>
          <p>{request.text}</p>
          {request.marks?.length ? (
            <ol>
              {request.marks.map((mark, index) => (
                <li key={`${mark}-${index}`} data-correct={mark === "yes" ? "true" : "false"}>
                  <span>
                    {String(index + 1).padStart(2, "0")} {mark === "yes" ? "✓" : "✗"}
                  </span>
                </li>
              ))}
            </ol>
          ) : null}
        </div>
        <div className={`${styles.urlShell} ${styles.cutShell}`}>
          <div className={`${styles.urlFace} ${styles.cutFace}`}>
            <p className={styles.urlNarrow} data-testid="guess-share-url">
              {url}
            </p>
            <button
              type="button"
              className={`${styles.copyButton} ${styles.cutShell}`}
              data-testid="guess-share-copy"
              data-done={copied ? "true" : "false"}
              aria-label="Copy link"
              onClick={() => void copy()}
            >
              <span className={styles.cutFace}>{copied ? "Copied" : <CopyIcon />}</span>
            </button>
          </div>
        </div>
        <div className={styles.actions}>
          <span className={styles.focusRing}>
            <button type="button" className={`${styles.action} ${styles.cutShell}`} onClick={() => void onSaveImage()}>
              <span className={styles.cutFace}>Save image</span>
            </button>
          </span>
          <span className={styles.focusRing}>
            <a className={`${styles.action} ${styles.cutShell}`} href={xHref(url || absoluteUrl(request.path), request.title, request.text)} target="_blank" rel="noopener noreferrer">
              <span className={styles.cutFace}>Share to X</span>
            </a>
          </span>
        </div>
        <p className={styles.live} role="status">
          {notice}
        </p>
        </div>
      </div>
    </div>,
    document.body,
  );
}

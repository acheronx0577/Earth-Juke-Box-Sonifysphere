"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChamferMark } from "@/components/listen/ChamferMark";
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
}

const FOCUSABLE = 'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

function absoluteUrl(path: string): string {
  return new URL(path, window.location.origin).toString();
}

function xHref(url: string, title: string, text: string): string {
  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(`${title}. ${text} ${url}`)}`;
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
  const [nativeShare, setNativeShare] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!open) return;
    restoreRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setCopied(false);
    setNotice("");
    setUrl(absoluteUrl(request.path));
    setNativeShare(typeof navigator.share === "function");
  }, [open, request.path]);

  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const focusables = () =>
      Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((node) => !node.hasAttribute("disabled") && node.tabIndex !== -1);
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

  const native = async () => {
    if (typeof navigator.share !== "function") return;
    try {
      await navigator.share({ title: request.title, text: `${request.title}. ${request.text}`, url: url || absoluteUrl(request.path) });
      setNotice("Share sheet opened.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setNotice(error instanceof Error ? error.message : "Sharing was blocked.");
    }
  };

  return createPortal(
    <div className={styles.backdrop} data-testid="guess-share-backdrop" data-hide-target-cursor="true" onMouseDown={onClose}>
      <div
        ref={dialogRef}
        className={`${styles.dialog} ${styles.frame}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-testid="guess-share-popup"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <ChamferMark />
        <div className={styles.head}>
          <h2 id={titleId}>Share this result</h2>
          <button type="button" className={`${styles.close} ${styles.frame}`} aria-label="Close share" onClick={onClose}>
            <ChamferMark />
            <span aria-hidden="true">×</span>
          </button>
        </div>
        <p className={styles.summary}>
          <span>{request.title}</span>
          <span>{request.text}</span>
        </p>
        <p className={styles.url} data-testid="guess-share-url">
          {url}
        </p>
        <div className={styles.actions}>
          <button type="button" className={`${styles.action} ${styles.frame}`} data-done={copied ? "true" : "false"} onClick={() => void copy()}>
            <ChamferMark />
            {copied ? "Copied" : "Copy link"}
          </button>
          {nativeShare ? (
            <button type="button" className={`${styles.action} ${styles.frame}`} data-testid="guess-share-native" onClick={() => void native()}>
              <ChamferMark />
              Share
            </button>
          ) : null}
          <button type="button" className={`${styles.action} ${styles.frame}`} onClick={() => void onSaveImage()}>
            <ChamferMark />
            Save image
          </button>
          <a className={`${styles.action} ${styles.frame}`} href={xHref(url || absoluteUrl(request.path), request.title, request.text)} target="_blank" rel="noopener noreferrer">
            <ChamferMark />
            Share to X
          </a>
        </div>
        <p className={styles.live} role="status">
          {notice}
        </p>
      </div>
    </div>,
    document.body,
  );
}

"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChamferMark } from "@/components/listen/ChamferMark";
import { chamferClip } from "@/components/listen/chamfer";
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

function focusableIn(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>("button, a[href], input, select, textarea")].filter((element) => {
    if (element.hasAttribute("disabled")) return false;
    if (element.getAttribute("aria-hidden") === "true") return false;
    return element.tabIndex !== -1;
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
  const [canNative, setCanNative] = useState(false);
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
    setCanNative(typeof navigator.share === "function");
    const root = dialogRef.current;
    if (!root) return;
    const previously = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const main = document.getElementById("main-content");
    if (main instanceof HTMLElement) main.inert = true;
    const copyButton = root.querySelector<HTMLElement>("[data-testid='share-copy']");
    (copyButton ?? focusableIn(root)[0])?.focus();
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

  const native = async () => {
    if (typeof navigator.share !== "function") return;
    try {
      await navigator.share({ title, text: message, url });
      setStatus("Shared.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setStatus("Sharing was not available.");
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
      className={styles.backdrop}
      data-hide-target-cursor="true"
      data-testid="share-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className={styles.panel}
        style={{ ["--cut" as string]: "14px", clipPath: chamferClip(14) }}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-testid="share-dialog"
      >
        <ChamferMark />
        <p className={styles.kicker}>SonifySphere</p>
        <h2 id={titleId}>{title}</h2>
        {detail ? <p className={styles.detail}>{detail}</p> : null}
        <label className={styles.linkFrame} style={{ ["--cut" as string]: "8px", clipPath: chamferClip(8) }}>
          <ChamferMark />
          <span className={styles.linkLabel}>Link</span>
          <input data-testid="share-url" readOnly value={url} onFocus={(event) => event.currentTarget.select()} />
        </label>
        <div className={styles.actions}>
          <button type="button" className={styles.cream} style={{ ["--cut" as string]: "8px", clipPath: chamferClip(8) }} data-testid="share-copy" onClick={() => void copy()}>
            <ChamferMark />
            {copied ? "Copied" : "Copy link"}
          </button>
          {canNative ? (
            <button type="button" className={styles.action} style={{ ["--cut" as string]: "8px", clipPath: chamferClip(8) }} data-testid="share-native" onClick={() => void native()}>
              <ChamferMark />
              Share
            </button>
          ) : null}
          <button type="button" className={styles.action} style={{ ["--cut" as string]: "8px", clipPath: chamferClip(8) }} data-testid="share-image" onClick={() => void save()}>
            <ChamferMark />
            Save image
          </button>
          <a className={styles.action} style={{ ["--cut" as string]: "8px", clipPath: chamferClip(8) }} data-testid="share-x" href={xHref} target="_blank" rel="noopener noreferrer">
            <ChamferMark />
            Share to X
          </a>
          <button type="button" className={styles.action} style={{ ["--cut" as string]: "8px", clipPath: chamferClip(8) }} data-testid="share-close" onClick={onClose}>
            <ChamferMark />
            Close
          </button>
        </div>
        <p className={styles.status} role="status" aria-live="polite">
          {status}
        </p>
      </div>
    </div>,
    document.body,
  );
}

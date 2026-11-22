"use client";

import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { ChamferMark } from "@/components/listen/ChamferMark";
import {
  CHALLENGE_EYEBROW,
  PATTERNS,
  saidParts,
  tryLabel,
  type RibbonPattern,
  type RoundRecord,
  type SharedRibbonsResult,
} from "@/lib/ribbonsResult";
import styles from "./ribbons.module.css";

function cutStyle(cut: number): CSSProperties {
  return { ["--cut" as string]: `${cut}px` };
}

function CopyIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path d="M9 8.75h10.25V19H9V8.75Z" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M4.75 15.25V4.75H15.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path d="M5 12.5 9.2 17 19 7" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function SaveIcon() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
      <path d="M10 3v9m-4-4 4 4 4-4M4 15h12" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path fill="currentColor" d="M14.7 10.3 22.4 1.5h-1.8l-6.7 7.6L8.4 1.5H1.6l8.1 11.5L1.6 22.5h1.8l7.1-8.1 5.7 8.1h6.8l-8.3-12.2Zm-2.5 2.8-.8-1.2L4.2 3h2.8l5.3 7.4.8 1.2 6.9 9.6h-2.8l-5.9-8.1Z" />
    </svg>
  );
}

function PlayGlyph({ paused }: { paused: boolean }) {
  return paused ? (
    <svg width="13" height="13" viewBox="0 0 12 12" aria-hidden="true">
      <path d="M2.2 1.5 H4.4 V10.5 H2.2 Z M7.6 1.5 H9.8 V10.5 H7.6 Z" fill="currentColor" />
    </svg>
  ) : (
    <svg width="13" height="13" viewBox="0 0 12 12" aria-hidden="true">
      <path d="M3 1.5 L10 6 L3 10.5 Z" fill="currentColor" />
    </svg>
  );
}

async function writeClipboard(value: string) {
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

function xHref(url: string, found: number, total: number): string {
  const title = `${found}/3 turns`;
  const text = `${total} pts on ${CHALLENGE_EYEBROW}`;
  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(`${title}. ${text} ${url}`)}`;
}

function MiniCurve({
  pattern,
  line,
  mapped,
  playing,
  head,
  viewWidth,
  viewHeight,
}: {
  pattern: RibbonPattern;
  line: string;
  mapped: readonly [number, number][];
  playing: boolean;
  head: readonly [number, number] | null;
  viewWidth: number;
  viewHeight: number;
}) {
  const turn = mapped[pattern.turnIndex] ?? mapped[0];
  const marker = playing && head ? head : turn;
  const label = playing && head ? pattern.months[nearest(mapped, head[0])] ?? pattern.months[pattern.turnIndex] : pattern.months[pattern.turnIndex];
  const left = `${(marker[0] / viewWidth) * 100}%`;
  const top = `${(marker[1] / viewHeight) * 100}%`;
  const below = marker[1] < viewHeight * 0.28;
  return (
    <div className={styles.miniPlot}>
      <div className={styles.miniStage} role="img" aria-label={`${pattern.shortTitle} curve, turns in ${pattern.months[pattern.turnIndex]}`}>
        <svg className={styles.miniSvg} viewBox={`0 0 ${viewWidth} ${viewHeight}`} preserveAspectRatio="none" aria-hidden="true">
          <path d={line} fill="none" stroke="#f2f2f0" strokeWidth="2.25" vectorEffect="non-scaling-stroke" />
        </svg>
        <span className={styles.turnDot} style={{ left, top }} />
        <span className={`${styles.frame} ${styles.turnMark} ${below ? styles.turnMarkBelow : ""} lv-cut`} style={{ ...cutStyle(4), left, top }}>
          <ChamferMark />
          <span className={styles.turnMarkFace}>{label.toUpperCase()}</span>
        </span>
      </div>
      <div className={styles.axis} aria-hidden="true">
        <span>{pattern.months[0]}</span>
        <span>{pattern.months[pattern.months.length - 1]}</span>
      </div>
    </div>
  );
}

function nearest(mapped: readonly [number, number][], x: number): number {
  let closest = 0;
  let best = Number.POSITIVE_INFINITY;
  mapped.forEach((point, index) => {
    const distance = Math.abs(point[0] - x);
    if (distance < best) {
      best = distance;
      closest = index;
    }
  });
  return closest;
}

export function RibbonsResults({
  result,
  curves,
  viewWidth,
  viewHeight,
  playingIndex,
  head,
  sharePath,
  onReplay,
  onSave,
  onAgain,
  againHref,
}: {
  readonly result: SharedRibbonsResult;
  readonly curves: readonly { line: string; mapped: readonly [number, number][] }[];
  readonly viewWidth: number;
  readonly viewHeight: number;
  readonly playingIndex: number | null;
  readonly head: readonly [number, number] | null;
  readonly sharePath: string;
  readonly onReplay: (index: number) => void;
  readonly onSave: () => string;
  readonly onAgain?: () => void;
  readonly againHref?: string;
}) {
  const linkId = useId();
  const sourcesTitle = useId();
  const sourcesRef = useRef<HTMLDivElement | null>(null);
  const sourcesButtonRef = useRef<HTMLButtonElement | null>(null);
  const againRef = useRef<HTMLButtonElement | null>(null);
  const readyAt = useRef(0);
  const [url, setUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [note, setNote] = useState("");
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [imageFont, setImageFont] = useState("");

  useEffect(() => {
    setUrl(new URL(sharePath, window.location.origin).toString());
    readyAt.current = performance.now() + 400;
  }, [sharePath]);

  useEffect(() => {
    if (!sourcesOpen) return;
    const dialog = sourcesRef.current;
    dialog?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setSourcesOpen(false);
        sourcesButtonRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [sourcesOpen]);

  const copy = async () => {
    try {
      await writeClipboard(url || new URL(sharePath, window.location.origin).toString());
      setCopied(true);
      setNote("Result link copied.");
    } catch (error) {
      setCopied(false);
      setNote(error instanceof Error ? error.message : "The result link could not be copied.");
    }
  };

  const save = () => {
    try {
      const family = onSave();
      setImageFont(family);
      setNote("Result image downloaded.");
    } catch (error) {
      setNote(error instanceof Error ? error.message : "The result image could not be saved.");
    }
  };

  const again = () => {
    if (performance.now() < readyAt.current) return;
    onAgain?.();
  };

  const shareUrl = url || sharePath;
  return (
    <main id="main-content" tabIndex={-1} className={styles.resultsPage} data-hide-target-cursor="true" data-image-font={imageFont} data-testid="ribbons-result">
      <header className={styles.hero}>
        <div className={styles.heroLead}>
          <Link href="/challenge" className={styles.resultsBack} data-testid="ribbons-back">
            <span aria-hidden="true">←</span> Challenges
          </Link>
          <p className={styles.resultsKicker}>{CHALLENGE_EYEBROW}</p>
          <h1 className={styles.bigScore}>
            <span className={styles.bigNum}>{result.patternsSolved}</span>
            <span className={styles.bigOf}>/3</span> <span className={styles.bigWord}>turns</span>
          </h1>
        </div>
        <p className={styles.scoreBig}>
          <b className={styles.bigNum}>{result.totalScore}</b>
          <span className={styles.scoreMeta}>
            <span>Pts</span>
            <span>First try {result.firstTries} of 3</span>
          </span>
        </p>
      </header>

      <ol className={styles.tiles} aria-label="The three rounds">
        {PATTERNS.map((pattern, index) => {
          const round = result.rounds[index];
          if (!round) return null;
          return (
            <li key={pattern.id}>
              <RoundTile
                index={index}
                pattern={pattern}
                round={round}
                curve={curves[index]}
                viewWidth={viewWidth}
                viewHeight={viewHeight}
                playing={playingIndex === index}
                head={playingIndex === index ? head : null}
                onReplay={() => onReplay(index)}
              />
            </li>
          );
        })}
      </ol>

      <div className={styles.bar}>
        <div className={styles.shareBox}>
          <p className={styles.shareLabelText}>Share</p>
          <div className={styles.share} role="group" aria-label="Share your result">
            <div className={`${styles.frame} ${styles.linkShell} lv-cut`} style={cutStyle(8)}>
              <ChamferMark />
              <div className={styles.linkFace}>
                <label className={styles.sr} htmlFor={linkId}>
                  Result link
                </label>
                <input id={linkId} className={styles.linkInput} readOnly value={shareUrl} data-testid="ribbons-link" />
                <button
                  type="button"
                  className={`${styles.frame} ${styles.copyBtn} lv-cut`}
                  style={cutStyle(6)}
                  data-testid="ribbons-copy"
                  data-done={copied ? "true" : "false"}
                  aria-label={copied ? "Link copied" : "Copy result link"}
                  onClick={() => void copy()}
                >
                  <ChamferMark />
                  <span className={styles.frameFace}>{copied ? <CheckIcon /> : <CopyIcon />}</span>
                </button>
              </div>
            </div>
            <button type="button" className={`${styles.frame} ${styles.shareBtn} lv-cut`} style={cutStyle(8)} data-testid="ribbons-save" aria-label="Save image" onClick={save}>
              <ChamferMark />
              <span className={styles.frameFace}>
                <span className={styles.shareIcon}>
                  <SaveIcon />
                </span>
                <span className={styles.shareWord}>Save image</span>
              </span>
            </button>
            <a
              className={`${styles.frame} ${styles.shareBtn} lv-cut`}
              style={cutStyle(8)}
              data-testid="ribbons-share-x"
              aria-label="Share to X"
              href={xHref(shareUrl, result.patternsSolved, result.totalScore)}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ChamferMark />
              <span className={styles.frameFace}>
                <span className={styles.shareIcon}>
                  <XIcon />
                </span>
                <span className={styles.shareWord}>Share to X</span>
              </span>
            </a>
          </div>
        </div>
        <div className={styles.barActions}>
          <button
            ref={sourcesButtonRef}
            type="button"
            className={`${styles.frame} ${styles.ghostBtn} lv-cut`}
            style={cutStyle(8)}
            data-testid="ribbons-sources"
            aria-expanded={sourcesOpen}
            aria-controls="ribbon-sources"
            onClick={() => setSourcesOpen(true)}
          >
            <ChamferMark />
            <span className={styles.frameFace}>Sources</span>
          </button>
          <Link href="/challenge" className={`${styles.frame} ${styles.ghostBtn} lv-cut`} style={cutStyle(8)} data-testid="ribbons-all">
            <ChamferMark />
            <span className={styles.frameFace}>
              <span className={styles.longLabel}>All challenges</span>
              <span className={styles.shortLabel}>Challenges</span>
            </span>
          </Link>
          {againHref ? (
            <Link href={againHref} className={`${styles.frame} ${styles.againBtn} lv-cut`} style={cutStyle(8)} data-testid="ribbons-again">
              <ChamferMark />
              <span className={styles.frameFace}>
                <span aria-hidden="true">↻</span> Play again
              </span>
            </Link>
          ) : (
            <button ref={againRef} type="button" className={`${styles.frame} ${styles.againBtn} lv-cut`} style={cutStyle(8)} data-testid="ribbons-again" onClick={again}>
              <ChamferMark />
              <span className={styles.frameFace}>
                <span aria-hidden="true">↻</span> Play again
              </span>
            </button>
          )}
        </div>
      </div>
      <p className={styles.resultsLive} role="status" data-testid="ribbons-share-note">
        {note}
      </p>

      {sourcesOpen ? (
        <div className={styles.dialogBack} onMouseDown={() => setSourcesOpen(false)}>
          <div
            ref={sourcesRef}
            id="ribbon-sources"
            className={`${styles.frame} ${styles.dialog} lv-cut`}
            style={cutStyle(12)}
            role="dialog"
            aria-modal="true"
            aria-labelledby={sourcesTitle}
            tabIndex={-1}
            data-testid="ribbons-sources-dialog"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <ChamferMark />
            <div className={styles.dialogFace}>
              <h2 id={sourcesTitle}>Sources</h2>
              <p>The three curves are this challenge’s teaching shapes, seven points across the year.</p>
              <ol>
                {PATTERNS.map((pattern, index) => (
                  <li key={pattern.id}>
                    <span>
                      Round {index + 1} · {pattern.shortTitle}
                    </span>
                    <span>{pattern.infoFact}</span>
                  </li>
                ))}
              </ol>
              <button type="button" className={`${styles.frame} ${styles.ghostBtn} lv-cut`} style={cutStyle(8)} onClick={() => { setSourcesOpen(false); sourcesButtonRef.current?.focus(); }}>
                <ChamferMark />
                <span className={styles.frameFace}>Close</span>
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function RoundTile({
  index,
  pattern,
  round,
  curve,
  viewWidth,
  viewHeight,
  playing,
  head,
  onReplay,
}: {
  index: number;
  pattern: RibbonPattern;
  round: RoundRecord;
  curve: { line: string; mapped: readonly [number, number][] } | undefined;
  viewWidth: number;
  viewHeight: number;
  playing: boolean;
  head: readonly [number, number] | null;
  onReplay: () => void;
}) {
  const badge = tryLabel(round);
  const said = saidParts(round, pattern);
  const titleId = `ribbon-round-${pattern.id}`;
  return (
    <article className={`${styles.frame} ${styles.tile} lv-cut`} style={cutStyle(12)} aria-labelledby={titleId} data-playing={playing ? "true" : "false"}>
      <ChamferMark />
      <div className={styles.tileFace}>
        <div className={styles.tileTop}>
          <span className={styles.tileIndex}>
            {String(index + 1).padStart(2, "0")} · {pattern.months[pattern.turnIndex].toUpperCase()}
          </span>
          <span className={`${styles.frame} ${styles.badge} ${badge.first ? styles.badgeOn : ""} lv-cut`} style={cutStyle(5)}>
            <ChamferMark />
            <span className={styles.badgeFace}>{badge.first ? "✓ " : ""}{badge.text}</span>
          </span>
        </div>
        <h2 id={titleId} className={styles.tileTitle}>
          {pattern.shortTitle}
        </h2>
        {curve ? (
          <MiniCurve pattern={pattern} line={curve.line} mapped={curve.mapped} playing={playing} head={head} viewWidth={viewWidth} viewHeight={viewHeight} />
        ) : null}
        <div className={styles.tileFoot}>
          <p className={styles.said} data-testid="ribbons-you-said">
            <span>You said</span>
            <b>
              {said.misses.map((season) => (
                <s key={season}>{season} </s>
              ))}
              <span>{said.turn}</span>
            </b>
          </p>
          <span className={styles.tilePts}>+{round.score}</span>
          <button
            type="button"
            className={`${styles.frame} ${styles.replay} lv-cut`}
            style={cutStyle(8)}
            aria-pressed={playing}
            aria-label={playing ? `Pause round ${index + 1}, ${pattern.shortTitle}` : `Replay round ${index + 1}, ${pattern.shortTitle}`}
            data-testid="ribbons-replay"
            onClick={onReplay}
          >
            <ChamferMark />
            <span className={styles.frameFace}>
              <PlayGlyph paused={playing} />
            </span>
          </button>
        </div>
      </div>
    </article>
  );
}

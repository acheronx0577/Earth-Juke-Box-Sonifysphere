"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import type { GuessHistoryEntry } from "@/lib/guessSession";
import { RESULT_CURVE_VIEW, recordForClip, seriesReadout, type DrawnCurve } from "./guessResultCurve";
import styles from "./guessResults.module.css";

function PlayIcon() {
  return (
    <svg className={styles.playIcon} width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <path d="M4.1 2.3v9.4l6.8-4.7-6.8-4.7Z" fill="currentColor" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <path d="M3.1 2.2h2.5v9.6H3.1V2.2Zm5.3 0h2.5v9.6H8.4V2.2Z" fill="currentColor" />
    </svg>
  );
}

function SignalName({ label }: { readonly label: string }) {
  const parts = label.split(/(CO₂|CO2)/g);
  return (
    <>
      {parts.map((part, index) =>
        part === "CO₂" || part === "CO2" ? (
          <span key={`${part}-${index}`}>
            CO<sub>2</sub>
          </span>
        ) : (
          <span key={`${part}-${index}`}>{part}</span>
        ),
      )}
    </>
  );
}

export function GuessResults({
  history,
  curves,
  score,
  best,
  playingIndex,
  playing,
  phraseLabel,
  listenHref,
  shareNote,
  soundOff,
  onReplay,
  onAgain,
  onShare,
  onSound,
  onLeaveSlide,
  againRef,
  bindClip,
  bindDot,
}: {
  readonly history: readonly GuessHistoryEntry[];
  readonly curves: readonly DrawnCurve[];
  readonly score: number;
  readonly best: number;
  readonly playingIndex: number | null;
  readonly playing: boolean;
  readonly phraseLabel: string;
  readonly listenHref: string;
  readonly shareNote: string;
  readonly soundOff: boolean;
  readonly onReplay: (entry: GuessHistoryEntry, index: number) => void;
  readonly onAgain: () => void;
  readonly onShare: () => void;
  readonly onSound: () => void;
  readonly onLeaveSlide: () => void;
  readonly againRef: (node: HTMLButtonElement | null) => void;
  readonly bindClip: (index: number, node: SVGRectElement | null) => void;
  readonly bindDot: (index: number, node: HTMLSpanElement | null) => void;
}) {
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [phone, setPhone] = useState(false);
  const [slide, setSlide] = useState(0);
  const [slideNote, setSlideNote] = useState("");
  const titleId = useId();
  const boardRef = useRef<HTMLElement | null>(null);
  const sourcesButtonRef = useRef<HTMLButtonElement | null>(null);
  const sourcesNarrowRef = useRef<HTMLButtonElement | null>(null);
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const scrollerRef = useRef<HTMLOListElement | null>(null);
  const slideRef = useRef(0);
  const primed = useRef(false);
  const settle = useRef(0);
  const records = history.map((entry) => recordForClip(entry));
  const unique = records.filter((record, index) => records.findIndex((item) => item.id === record.id) === index);

  useEffect(() => {
    if (!sourcesOpen) return;
    const dialog = sheetRef.current;
    if (!dialog) return;
    const sourcesNarrow = sourcesNarrowRef.current;
    const sourcesButton = sourcesButtonRef.current;
    const focusables = () =>
      Array.from(dialog.querySelectorAll<HTMLElement>("button, a[href], input, select, textarea, [tabindex]:not([tabindex='-1'])")).filter(
        (node) => !node.hasAttribute("disabled") && node.tabIndex !== -1,
      );
    const initial = window.setTimeout(() => focusables()[0]?.focus(), 0);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        setSourcesOpen(false);
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
      if (sourcesNarrow && sourcesNarrow.getClientRects().length > 0) sourcesNarrow.focus();
      else sourcesButton?.focus();
    };
  }, [sourcesOpen]);

  useEffect(() => {
    const node = boardRef.current;
    if (!node) return;
    const sync = () => setPhone(node.getBoundingClientRect().width <= 900);
    const observer = new ResizeObserver(sync);
    observer.observe(node);
    sync();
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!phone) return;
    if (!primed.current) {
      primed.current = true;
      return;
    }
    const entry = history[slide];
    if (!entry) return;
    setSlideNote(`Signal ${slide + 1} of ${history.length}, ${entry.answerLabel}, ${entry.correct ? "named" : "missed"}`);
  }, [history, phone, slide]);

  const goTo = (index: number) => {
    const scroller = scrollerRef.current;
    const card = scroller?.querySelectorAll<HTMLElement>("[data-testid='guess-result-card']")[index];
    if (!scroller || !card) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const delta = card.getBoundingClientRect().left - scroller.getBoundingClientRect().left;
    scroller.scrollTo({ left: scroller.scrollLeft + delta, behavior: reduce ? "auto" : "smooth" });
  };

  const onScrollerScroll = () => {
    const scroller = scrollerRef.current;
    if (!scroller || !phone) return;
    window.clearTimeout(settle.current);
    settle.current = window.setTimeout(() => {
      const cards = [...scroller.querySelectorAll<HTMLElement>("[data-testid='guess-result-card']")];
      const left = scroller.getBoundingClientRect().left;
      let next = 0;
      let best = Number.POSITIVE_INFINITY;
      cards.forEach((card, index) => {
        const distance = Math.abs(card.getBoundingClientRect().left - left);
        if (distance < best) {
          best = distance;
          next = index;
        }
      });
      if (next === slideRef.current) return;
      slideRef.current = next;
      setSlide(next);
      if (playing && playingIndex !== null && playingIndex !== next) onLeaveSlide();
    }, 80);
  };

  const onCarouselKey = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!phone) return;
    const last = history.length - 1;
    if (event.key === "ArrowRight") {
      event.preventDefault();
      goTo(Math.min(last, slideRef.current + 1));
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      goTo(Math.max(0, slideRef.current - 1));
    } else if (event.key === "Home") {
      event.preventDefault();
      goTo(0);
    } else if (event.key === "End") {
      event.preventDefault();
      goTo(last);
    }
  };

  const sheet =
    sourcesOpen && typeof document !== "undefined"
      ? createPortal(
          <div className={styles.sheetBackdrop} data-hide-target-cursor="true" onMouseDown={() => setSourcesOpen(false)}>
            <div
              ref={sheetRef}
              className={styles.sheet}
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              data-testid="guess-sources"
              onMouseDown={(event) => event.stopPropagation()}
            >
              <div className={styles.sheetFace}>
                <h2 id={titleId}>Sources</h2>
                <ul className={styles.sheetList}>
                  {unique.map((record) => (
                    <li key={record.id}>
                      <p>{record.caption}</p>
                      <p>{record.source}</p>
                      <a href={record.url} target="_blank" rel="noopener noreferrer">
                        {record.url}
                      </a>
                    </li>
                  ))}
                </ul>
                <span className={styles.ring}>
                  <button type="button" className={styles.shell} onClick={() => setSourcesOpen(false)}>
                    <span className={styles.face}>Close</span>
                  </button>
                </span>
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <section ref={boardRef} className={styles.board} data-testid="guess-result" aria-labelledby="guess-result-title">
      <div className={styles.hero}>
        <div className={styles.heroLine}>
          <h1 id="guess-result-title">
            <span className={styles.phoneTitle}>{history.filter((entry) => entry.correct).length} of {history.length} named</span>
            <span className={styles.deskTitle}>
              <span className={styles.scoreDigits}>{history.filter((entry) => entry.correct).length}</span>
              <span className={styles.scoreOf}>/{history.length}</span>
              <span className={styles.scoreWord}> named</span>
            </span>
          </h1>
          <p className={styles.score}>
            <b>{score}</b>
            <span className={styles.scoreAside}><span>PTS</span><span className={styles.streak}>Best streak {best}</span></span>
          </p>
        </div>
        <ol className={styles.chips} aria-label="Round results">
          {history.map((entry, index) => (
            <li key={`${entry.answerId}-${index}`} className={styles.chip} data-correct={entry.correct ? "true" : "false"}>
              <span className={styles.chipFace}>
                {String(index + 1).padStart(2, "0")} {entry.correct ? "✓" : "✗"}
              </span>
            </li>
          ))}
        </ol>
      </div>
      <div className={styles.kickerRow}>
        <p className={styles.kicker}>The five signals</p>
        <span className={styles.ring}>
          <button ref={sourcesButtonRef} type="button" className={styles.shell} onClick={() => setSourcesOpen(true)}>
            <span className={styles.face}>Sources</span>
          </button>
        </span>
      </div>
      <div className={styles.carouselRegion} onKeyDown={onCarouselKey}>
      <p className={styles.live} aria-live="polite">
        {slideNote}
      </p>
      <ol
        ref={scrollerRef}
        className={styles.rows}
        data-testid="guess-carousel"
        aria-label="The five signals"
        tabIndex={phone ? 0 : undefined}
        onScroll={onScrollerScroll}
      >
        {history.map((entry, index) => {
          const curve = curves[index];
          const readout = seriesReadout(entry);
          const active = playing && playingIndex === index;
          const clipId = `guess-heard-${index}`;
          return (
            <li
              key={`${entry.answerId}-${index}`}
              className={styles.row}
              data-correct={entry.correct ? "true" : "false"}
              data-playing={active ? "true" : "false"}
              data-active={index === slide ? "true" : "false"}
              data-record={records[index]?.id}
              data-testid="guess-result-card"
              aria-roledescription={phone ? "slide" : undefined}
              aria-label={`${index + 1} of ${history.length}, ${entry.answerLabel}, ${entry.correct ? "named" : "missed"}`}
            >
              <div className={styles.rowFace}>
                <div className={styles.identity}>
                  <p className={styles.meta}>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <span className={styles.tag}>
                      <span className={styles.tagFace}>{entry.correct ? "Named" : "Missed"}</span>
                    </span>
                  </p>
                  <p className={styles.name}>
                    <span className={styles.phoneName}>{entry.answerLabel}</span>
                    <span className={styles.deskName}><SignalName label={entry.answerLabel} /></span>
                  </p>
                </div>
                <div className={styles.plotBlock}>
                  <div className={styles.plot}>
                    <svg viewBox={`0 0 ${RESULT_CURVE_VIEW.width} ${RESULT_CURVE_VIEW.height}`} preserveAspectRatio="none" aria-hidden="true">
                      <defs>
                        <clipPath id={clipId}>
                          <rect
                            ref={(node) => bindClip(index, node)}
                            x="0"
                            y="0"
                            width="0"
                            height={RESULT_CURVE_VIEW.height}
                          />
                        </clipPath>
                      </defs>
                      <path d={curve?.fill ?? ""} className={styles.curveFill} />
                      <path d={curve?.d ?? ""} className={styles.curveRest} data-testid="guess-result-curve" />
                      <path d={curve?.d ?? ""} className={styles.curveHeard} clipPath={`url(#${clipId})`} />
                      {curve?.marks.map((mark) => (
                        <circle key={mark.kind} className={styles.mark} cx={mark.x} cy={mark.y} r={mark.kind === "end" ? 3.5 : 2.4} />
                      ))}
                      <line
                        className={styles.baseline}
                        x1="0"
                        x2={RESULT_CURVE_VIEW.width}
                        y1={RESULT_CURVE_VIEW.height - 1}
                        y2={RESULT_CURVE_VIEW.height - 1}
                      />
                    </svg>
                    <span className={styles.yearStart}>{readout.start.year}</span>
                    <span className={styles.yearEnd}>{readout.end.year}</span>
                    <span
                      ref={(node) => bindDot(index, node)}
                      className={styles.heardDot}
                      data-on="off"
                    />
                  </div>
                </div>
                <span className={styles.rule} />
                <div className={styles.verdict}>
                  <p className={styles.said}>
                    You said: {entry.correct ? "✓" : "✗"} {entry.pickedLabel}
                  </p>
                </div>
                <div className={styles.replay}>
                  <span className={styles.ring}>
                    <button
                      type="button"
                      className={`${styles.shell} ${styles.replayButton}`}
                      aria-pressed={active}
                      aria-label={active ? `Pause round ${index + 1}` : `Replay round ${index + 1}`}
                      data-testid="guess-replay"
                      onClick={() => onReplay(entry, index)}
                    >
                      <span className={styles.face}>{active ? <PauseIcon /> : <PlayIcon />}</span>
                    </button>
                  </span>
                  <p className={styles.replayLabel}>{phraseLabel}</p>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
      <div className={styles.carouselBar}>
        <span className={styles.ring}>
          <button type="button" className={styles.shell} aria-label="Previous signal" disabled={slide === 0} onClick={() => goTo(slide - 1)}>
            <span className={styles.face}>Prev</span>
          </button>
        </span>
        <p className={styles.counter} aria-hidden="true" data-testid="guess-carousel-count">
          {String(slide + 1).padStart(2, "0")} / {String(history.length).padStart(2, "0")}
        </p>
        <span className={styles.ring}>
          <button type="button" className={styles.shell} aria-label="Next signal" disabled={slide >= history.length - 1} onClick={() => goTo(slide + 1)}>
            <span className={styles.face}>Next</span>
          </button>
        </span>
      </div>
      <div className={styles.pager} role="group" aria-label="Signal pager">
        {history.map((entry, index) => (
          <button
            key={`${entry.answerId}-page-${index}`}
            type="button"
            className={styles.segment}
            data-correct={entry.correct ? "true" : "false"}
            aria-current={index === slide ? "true" : undefined}
            aria-label={`Signal ${index + 1} of ${history.length}, ${entry.correct ? "named" : "missed"}`}
            onClick={() => goTo(index)}
          >
            <span>{entry.correct ? "✓" : "✗"}</span>
          </button>
        ))}
      </div>
      </div>
      <div className={styles.actions}>
        <div className={styles.actionsShell}>
        <div className={styles.actionsFace}>
        <div className={styles.cluster}>
          <span className={`${styles.ring} ${styles.sourcesNarrow}`}>
            <button ref={sourcesNarrowRef} type="button" className={styles.shell} onClick={() => setSourcesOpen(true)}>
              <span className={styles.face}>Sources</span>
            </button>
          </span>
          <span className={`${styles.ring} ${styles.playWide}`}>
            <button ref={againRef} type="button" className={`${styles.shell} ${styles.primary}`} onClick={onAgain}>
              <span className={styles.face}>Play again</span>
            </button>
          </span>
          <span className={styles.pair}>
            <span className={`${styles.ring} ${styles.shareSlot}`}>
              <button type="button" className={styles.shell} onClick={onShare}>
                <span className={styles.face}>Share</span>
              </button>
            </span>
            <Link className={`${styles.linkSlot} ${styles.nextSlot} ${styles.narrowTab}`} href="/challenge/compose">
              <span className={styles.ring}>
                <span className={styles.linkFace}>
                  Next · Compose
                  <span className={styles.linkArrow} aria-hidden="true">→</span>
                </span>
              </span>
            </Link>
          </span>
        </div>
        <div className={styles.cluster}>
          <Link className={`${styles.linkSlot} ${styles.hearWide} ${styles.wideTab}`} href={listenHref} aria-hidden={phone || undefined} tabIndex={phone ? -1 : undefined}>
            <span className={styles.ring}>
              <span className={styles.linkFace}>
                Hear the real data
                <span className={styles.linkArrow} aria-hidden="true">↗</span>
              </span>
            </span>
          </Link>
          <Link className={`${styles.linkSlot} ${styles.nextSlot} ${styles.wideTab}`} href="/challenge/compose">
            <span className={styles.ring}>
              <span className={styles.linkFace}>
                Next · Compose
                <span className={styles.linkArrow} aria-hidden="true">→</span>
              </span>
            </span>
          </Link>
          <Link className={`${styles.linkSlot} ${styles.hearWide} ${styles.narrowTab}`} href={listenHref} aria-hidden={phone || undefined} tabIndex={phone ? -1 : undefined}>
            <span className={styles.ring}>
              <span className={styles.linkFace}>
                Hear the real data
                <span className={styles.linkArrow} aria-hidden="true">↗</span>
              </span>
            </span>
          </Link>
        </div>
        </div>
        </div>
      </div>
      {shareNote ? <p className={styles.note}>{shareNote}</p> : null}
      {soundOff ? (
        <p className={styles.banner} role="status">
          Sound is off.
          <span className={styles.ring}>
            <button type="button" className={styles.shell} onClick={onSound}>
              <span className={styles.face}>Turn sound on</span>
            </button>
          </span>
        </p>
      ) : null}
      {sheet}
    </section>
  );
}

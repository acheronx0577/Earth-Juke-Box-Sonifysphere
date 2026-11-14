"use client";

import { memo, useEffect, useState } from "react";
import { SoundOffNote } from "@/components/shared/SoundOffNote";
import { VoiceStrip } from "@/components/about/VoiceStrip";
import { VOICE_CARDS } from "@/data/aboutData";
import { CutButton } from "@/components/play/CutControls";
import { IconPause, IconPlay, SignalMeter } from "@/components/shared/Icons";
import { useSonifyPlayer } from "@/context/SonifyPlayerContext";

const VoicesHead = memo(function VoicesHead() {
  return (
    <div className="about-sec-head">
      <p className="about-kicker">The three voices</p>
      <h2 id="voices-h" data-about-h2>
        One sound for each pattern in the data.
      </h2>
    </div>
  );
});

export function HowItSoundsSection() {
  const { soloVoice, playSoloVoice, soundOn, setSoundEnabled, isSoundOn } = useSonifyPlayer();
  const [soundOff, setSoundOff] = useState(false);
  const [pending, setPending] = useState<(typeof VOICE_CARDS)[number]["id"] | null>(null);

  useEffect(() => {
    if (soundOn) setSoundOff(false);
  }, [soundOn]);

  const ask = (id: (typeof VOICE_CARDS)[number]["id"]) => {
    if (!isSoundOn()) {
      setPending(id);
      setSoundOff(true);
      return;
    }
    setSoundOff(false);
    playSoloVoice(id);
  };

  const turnSoundOn = () => {
    const id = pending;
    setSoundEnabled(true);
    setSoundOff(false);
    if (id) playSoloVoice(id);
  };

  return (
    <section id="voices" className="about-sec" aria-labelledby="voices-h">
      <div className="about-wrap">
        <VoicesHead />
        {soundOff ? <SoundOffNote onTurnOn={turnSoundOn} /> : null}
        <div className="about-reg">
          {VOICE_CARDS.map((card) => {
            const playing = soloVoice === card.id;
            const headingId = `voice-${card.id}`;
            return (
              <article
                key={card.id}
                className="about-row"
                data-testid="voice-row"
                data-roll=""
                data-voice-row=""
                data-playing={playing ? "true" : "false"}
                aria-labelledby={headingId}
                onClick={(event) => {
                  if ((event.target as HTMLElement).closest("button")) return;
                  ask(card.id);
                }}
              >
                <p className="about-idx">{card.index}</p>
                <div className="min-w-0">
                  <div className="sonify-roll" aria-hidden="true">
                    <div className="sonify-roll__stack">
                      <div>{card.title}</div>
                      <div className="sonify-roll__band">
                        <b>{card.title}</b>
                        <span>
                          {playing ? (
                            <>
                              <SignalMeter live /> Playing
                            </>
                          ) : (
                            "▶ Hear this voice"
                          )}
                        </span>
                      </div>
                      <div>{card.title}</div>
                    </div>
                  </div>
                  <h3 id={headingId} className="sr-only">
                    {card.title}
                  </h3>
                  <div className="about-vsub">
                    <p className="about-body">{card.body}</p>
                    <VoiceStrip kind={card.strip} label={card.stripAlt} />
                  </div>
                </div>
                <div className="about-act">
                  <CutButton solid={playing} aria-pressed={playing} onClick={() => ask(card.id)}>
                    {playing ? (
                      <>
                        <IconPause /> Playing
                      </>
                    ) : (
                      <>
                        <IconPlay /> Hear this voice
                      </>
                    )}
                  </CutButton>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

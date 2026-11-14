"use client";

import { useState } from "react";
import { SoundOffNote } from "@/components/shared/SoundOffNote";
import { useSonifyPlayer, type VoiceId } from "@/context/SonifyPlayerContext";

const VOICES: readonly {
  id: VoiceId;
  index: string;
  title: string;
  tracks: string;
  sounds: string;
}[] = [
  { id: "pitch", index: "01 / 03", title: "Pitch", tracks: "CO₂ level, in ppm", sounds: "A higher note as CO₂ rises" },
  { id: "pulse", index: "02 / 03", title: "Pulse", tracks: "The yearly swing, ~6 ppm", sounds: "A steady beat, one swing per year" },
  { id: "click", index: "03 / 03", title: "Click", tracks: "Record months, 163 so far", sounds: "A soft click at each new record" },
];

function Glyph({ kind }: { readonly kind: VoiceId }) {
  if (kind === "pitch") {
    return (
      <svg viewBox="0 0 160 48" aria-hidden="true">
        {Array.from({ length: 18 }, (_, i) => {
          const h = 8 + i * 2;
          return <rect key={i} x={i * 9} y={48 - h} width="4" height={h} fill="currentColor" />;
        })}
      </svg>
    );
  }
  if (kind === "pulse") {
    return (
      <svg viewBox="0 0 160 48" aria-hidden="true">
        <path d="M0 24 Q 13 4 26 24 T 52 24 T 78 24 T 104 24 T 130 24 T 156 24" fill="none" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 160 48" aria-hidden="true">
      {Array.from({ length: 16 }, (_, i) => (
        <rect key={i} x={i * 10 + 2} y={i % 3 === 0 ? 8 : 20} width="1.5" height={i % 3 === 0 ? 32 : 16} fill="currentColor" />
      ))}
    </svg>
  );
}

export function VoiceTable() {
  const { playSoloVoice, soloVoice, soundOn, setSoundEnabled, isSoundOn } = useSonifyPlayer();
  const [pending, setPending] = useState<VoiceId | null>(null);

  const hear = (id: VoiceId) => {
    if (!isSoundOn()) {
      setPending(id);
      return;
    }
    setPending(null);
    playSoloVoice(id);
  };

  return (
    <section className="voices" aria-labelledby="voicesTitle">
      <div className="voices-head">
        <p className="voices-lbl am-label">[ How to listen · 3 voices ]</p>
        <p className="voices-lede" id="voicesTitle">
          Three voices play the Mauna Loa record at once. Each one follows a single pattern in the data.
        </p>
      </div>
      {pending && !soundOn ? (
        <SoundOffNote
          onTurnOn={() => {
            const id = pending;
            setSoundEnabled(true);
            setPending(null);
            if (id) playSoloVoice(id);
          }}
        />
      ) : null}
      <div className="voices-grid">
        <div className="vg-rowlbl am-label">Voice</div>
        <div className="vg-rowlbl am-label">Tracks</div>
        <div className="vg-rowlbl am-label">Sounds like</div>
        <div className="vg-rowlbl am-label">Hear</div>
        {VOICES.map((voice) => (
          <article key={voice.id} className="vg-col" data-testid="voice-row" data-playing={soloVoice === voice.id ? "true" : "false"} aria-label={voice.title}>
            <div className="vg-cell vg-name">
              <p className="am-label">{voice.index}</p>
              <h3>{voice.title}</h3>
            </div>
            <div className="vg-cell">
              <p className="vg-k am-label">Tracks</p>
              <p className="vg-copy">{voice.tracks}</p>
            </div>
            <div className="vg-cell">
              <p className="vg-k am-label">Sounds like</p>
              <p className="vg-copy">{voice.sounds}</p>
              <div className="vg-glyph">
                <Glyph kind={voice.id} />
              </div>
            </div>
            <div className="vg-cell">
              <button type="button" className="am-btn" aria-pressed={soloVoice === voice.id} onClick={() => hear(voice.id)}>
                {soloVoice === voice.id ? "Playing" : `Hear ${voice.title.toLowerCase()}`}
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

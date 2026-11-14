"use client";

import { useEffect } from "react";
import { useSonifyPlayer } from "@/context/SonifyPlayerContext";

export function AudioLiveFlag() {
  const { soundOn, playing, muted, ensembleOn, soloVoice } = useSonifyPlayer();
  const live = soundOn && playing && !muted && (ensembleOn || soloVoice !== null);

  useEffect(() => {
    if (live) document.documentElement.dataset.sonifyLive = "1";
    else delete document.documentElement.dataset.sonifyLive;
    return () => {
      delete document.documentElement.dataset.sonifyLive;
    };
  }, [live]);

  return null;
}

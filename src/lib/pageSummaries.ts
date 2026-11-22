export interface PageSection {
  heading: string;
  paragraphs: string[];
}

export interface PageSummary {
  title: string;
  h1?: string;
  sections: PageSection[];
}

export type SummaryPageKey =
  | "ribbons"
  | "guess"
  | "match"
  | "compose"
  | "challenge"
  | "listen"
  | "story"
  | "contact";

export const PAGE_SUMMARIES: Record<SummaryPageKey, PageSummary> = {
  ribbons: {
    title: "Waveform Ribbons — Seasonal Cycle Sonification Challenge",
    sections: [
      {
        heading: "How the Waveform Ribbons Challenge Works",
        paragraphs: [
          "Waveform Ribbons is an interactive climate ear-training game where players track Earth's seasonal cycles by ear. In each round, a continuous melodic curve sonifies planetary rhythms—such as Arctic sea ice freezing and melting, temperate forest photosynthetic uptake, and seasonal CO₂ respiration.",
          "Players listen to the looping two-second audio cycle. The pitch rises and falls as the data value increases and decreases across the calendar year. Click on the waveform or use keyboard controls (1 through 4) to assign seasonal segments to Spring, Summer, Autumn, or Winter.",
        ],
      },
      {
        heading: "Seasonal Cycle Ear Training",
        paragraphs: [
          "Score points by identifying seasonal extrema and matching the sonified contour to real planetary data. In spring, warming temperatures trigger rapid northern hemisphere vegetative awakening. In summer, peak photosynthetic carbon drawdown drives values to their annual trough.",
          "Autumn brings deciduous leaf senescence and fungal decomposition, turning the curve upward again into winter dormancy. Honing your ear against these acoustic profiles builds direct auditory understanding of planetary metabolism.",
        ],
      },
      {
        heading: "Scientific Records & Auditory Mapping",
        paragraphs: [
          "The curves in Waveform Ribbons are derived from empirical Earth observations, including the Scripps Institution of Oceanography Mauna Loa Keeling curve, NASA MODIS satellite vegetation indices, and National Snow and Ice Data Center (NSIDC) Arctic polar sea ice extents.",
          "Sonification maps higher sensor values to higher audible frequencies using calibrated harmonic synthesis. All synthesis runs locally on your device via the Web Audio API with zero cloud latency.",
        ],
      },
    ],
  },

  guess: {
    title: "Guess the Signal — Earth Audio Challenge",
    sections: [
      {
        heading: "Auditory Identification Challenge",
        paragraphs: [
          "Guess the Signal tests your auditory intuition against real Earth monitoring records. Players listen to short sonified audio phrases generated from distinct planetary phenomena and identify the underlying region or climate record from four multiple-choice candidates.",
          "Each round presents a sonified excerpt with a unique acoustic timbre and pitch profile. Atmospheric carbon dioxide features gradual upward sweeps with seasonal oscillations, sea surface temperatures exhibit cyclic multi-year El Niño Southern Oscillation waves, and polar ice extent produces sharp seasonal plunge-and-recovery curves.",
        ],
      },
      {
        heading: "Ear-Training & Acoustic Clues",
        paragraphs: [
          "Listen carefully to harmonic frequency inflection, vibrato depth, and contour dynamics. A rapid upward glissando often signifies sudden summer meltwater release or post-volcanic greenhouse spike.",
          "Subtle multi-year fluctuations reveal decadal Pacific Decadal Oscillation shifts. Select your answer and track your streak across consecutive rounds to master planetary acoustic signatures.",
        ],
      },
      {
        heading: "Planetary Observation Signals",
        paragraphs: [
          "Data streams include NOAA ESRL Mauna Loa carbon dioxide measurements, Meteomatics global meteorological reanalysis, NASA Earth Observations (NEO) sea surface temperature anomalies, and global precipitation radar networks.",
          "All synthesis is computed on-device in real time via the Web Audio API without pre-recorded audio samples.",
        ],
      },
    ],
  },

  match: {
    title: "Tune the Signal — Keeling Curve Audio Matching",
    sections: [
      {
        heading: "Keeling Curve Frequency Calibration",
        paragraphs: [
          "Tune the Signal is an auditory synthesis matching challenge. Players manipulate synthesizer parameters to match the fundamental frequency, resonance, and harmonic modulation of historical Earth data recordings.",
          "Adjust the primary frequency oscillator and resonance filter until the synthesized tone perfectly aligns with the reference target. Watch for acoustic phase cancellation and beat frequencies as you approach the exact target value.",
        ],
      },
      {
        heading: "How to Tune the Synthesizer",
        paragraphs: [
          "Use the dual slider controls or arrow keys to adjust fundamental pitch and filter Q. As your tone nears the recorded frequency, harmonic dissonance resolves into smooth acoustic unison.",
          "Test your ear against historical milestones from 315 ppm in 1958 to over 426 ppm today, building an intuitive understanding of exponential greenhouse gas accumulation.",
        ],
      },
      {
        heading: "Atmospheric Carbon Dioxide History",
        paragraphs: [
          "Continuous atmospheric carbon dioxide measurements began at Mauna Loa Observatory in March 1958 under Charles David Keeling. SonifySphere transforms these discrete monthly ppm values into continuous musical pitch intervals.",
          "This sonification makes sixty-eight years of atmospheric accumulation perceptible in seconds, transforming an abstract scientific chart into an immediate sensory experience.",
        ],
      },
    ],
  },

  compose: {
    title: "Compose Earth Mixtape — Multitrack Climate Mixer",
    sections: [
      {
        heading: "Interactive Planetary Music Mixer",
        paragraphs: [
          "The Compose Board allows you to arrange multiple sonified Earth monitoring streams into an interactive musical composition. Layer atmospheric carbon dioxide basslines with ocean temperature leads and vegetation percussion to create a personalized Earth mixtape.",
          "Select from curated stems across global observation stations. Adjust individual track volume, stereo panning, mute, and solo states to craft custom auditory soundscapes.",
        ],
      },
      {
        heading: "Multitrack Environmental Stems",
        paragraphs: [
          "Stems include Arctic sea ice extent percussive pulses, equatorial trade wind velocity hums, global sea surface temperature ambient pads, and Mauna Loa CO₂ melodic arpeggios.",
          "Experiment with pitch octave shifts and rhythmic subdivision variations to explore how planetary cycles interact across decadal timescales.",
        ],
      },
      {
        heading: "Composition Controls & Export Options",
        paragraphs: [
          "Once your arrangement is complete, preview playback in real time, generate a shareable URL containing your mix parameters, or export audio waveforms directly for educational and creative presentations.",
          "All audio processing runs entirely in your browser through high-performance Web Audio DSP nodes.",
        ],
      },
    ],
  },

  challenge: {
    title: "Earth Climate Sonification Challenges",
    h1: "Earth Climate Sonification Challenges — SonifySphere",
    sections: [
      {
        heading: "Three Interactive Listening Challenges",
        paragraphs: [
          "SonifySphere provides three distinct interactive auditory challenges designed to develop ear training and intuitive understanding of planetary environmental systems. Each challenge focuses on a specific aspect of scientific climate observation.",
          "Sound starts only when you request it. All audio synthesis is computed client-side using Web Audio oscillators and filters without external tracking or audio recording.",
        ],
      },
      {
        heading: "Challenge 01: Guess the Signal",
        paragraphs: [
          "An ear-training quiz that plays a short sonified phrase and asks which region or climate record it came from. Test your auditory intuition across atmospheric, oceanic, and polar datasets, identifying acoustic signatures from Antarctica to the Sahara.",
        ],
      },
      {
        heading: "Challenge 02: Tune the Signal",
        paragraphs: [
          "An interactive synthesizer calibration challenge. Overlap your tone with the Mauna Loa Keeling record and tune frequency and resonance until the two waveforms reach harmonic alignment.",
        ],
      },
      {
        heading: "Challenge 03: Waveform Ribbons",
        paragraphs: [
          "Follow the annual planetary inhale and seasonal rhythms by ear. Trace seasonal transitions across vegetation cycles, atmospheric CO₂ fluctuations, and Arctic ice pack movements.",
        ],
      },
    ],
  },

  listen: {
    title: "Listen — Global Planetary Sonification Probe",
    sections: [
      {
        heading: "Equal Earth Projection & Auditory Probe",
        paragraphs: [
          "The Listen studio provides an interactive Equal Earth map projection and NASA media viewer. Place the auditory probe anywhere on the globe to sonify live meteorological and environmental satellite datasets in real time.",
          "Move across oceans, mountain ranges, and urban centers to hear how elevation, moisture, and thermal gradients create distinct acoustic textures.",
        ],
      },
      {
        heading: "Satellite Data Layers & Meteorological Bands",
        paragraphs: [
          "Switch between precipitation radar, air temperature, wind velocity, sea surface temperature, and atmospheric pressure. Each layer features a custom acoustic timbre designed to convey the physical nature of the phenomenon.",
          "Warm analog chords signify tropical thermal belts, while resonant percussive pulses indicate intense precipitation. Ocean currents produce shifting stereo phase movements that trace global thermohaline circulation.",
        ],
      },
      {
        heading: "Synthesized Sonification Engine",
        paragraphs: [
          "SonifySphere renders all audio client-side using Web Audio API synthesis. Tone frequencies, modulation indices, and harmonic balances respond dynamically to coordinate movements and temporal scrubber adjustments across historical observation periods.",
        ],
      },
    ],
  },

  story: {
    title: "Three Chapters of the Mauna Loa Record",
    h1: "Three Chapters of the Mauna Loa CO₂ Record — SonifySphere",
    sections: [
      {
        heading: "Chapter 01: The First Breath (March 1958)",
        paragraphs: [
          "Charles David Keeling establishes the first continuous infrared gas analyzer on the high northern flank of Mauna Loa, Hawaii. The initial reading is 315.71 parts per million, establishing the baseline for humanity's longest continuous atmospheric carbon record.",
          "This pristine high-altitude Pacific air, sampled above the local inversion layer, provides an unpolluted baseline of the global atmosphere.",
        ],
      },
      {
        heading: "Chapter 02: The Seasonal Inhale (The Keeling Curve)",
        paragraphs: [
          "Every northern spring, vast boreal and temperate forests burst into leaf. Photosynthesis draws billions of tons of carbon dioxide out of the air, causing global CO₂ concentrations to decline until late summer.",
          "In autumn and winter, leaves fall and microbial decomposition releases the carbon back into the atmosphere, producing an annual six-parts-per-million seasonal wave—the literal breath of the living Earth.",
        ],
      },
      {
        heading: "Chapter 03: The Modern Run of Record Highs",
        paragraphs: [
          "From 315 ppm in 1958 past 350 ppm in 1988, 400 ppm in 2013, and exceeding 426 ppm today, the underlying trend rises continuously. Superimposed upon the seasonal oscillation is an accelerating accumulation of greenhouse gases.",
          "SonifySphere sonifies this relentless upward trajectory as an escalating acoustic pitch progression, transforming sixty-eight years of scientific measurement into an immediate sensory reality.",
        ],
      },
    ],
  },

  contact: {
    title: "Contact the SonifySphere Team",
    h1: "Contact the SonifySphere Team — Six Voices, One Earth Record",
    sections: [
      {
        heading: "Project Overview & Inquiry Information",
        paragraphs: [
          "SonifySphere was developed for NASA Space Apps 2026. For inquiries, research collaborations, educational demonstrations, or press questions, reach out to richardhuynh0824@gmail.com.",
          "We welcome educators, researchers, and climate communicators to incorporate SonifySphere's sonification models and interactive challenges into science curricula and public installations.",
        ],
      },
      {
        heading: "The Six Project Voices",
        paragraphs: [
          "The multidisciplinary team spans data sonification, cartography, frontend engineering, and scientific visualization: Richard Huynh (Lead Engineer), Andi Eng, Vu Dang, The Nguyen, Khuu Khoi Danh, and Dang Khoa.",
          "Each member contributed to the acoustic sound design, interactive data pipelines, and responsive visualizations that bring NASA and NOAA climate observations to life.",
        ],
      },
      {
        heading: "Open-Source Repository & Educational Purpose",
        paragraphs: [
          "All code is open-source under the MIT license on GitHub at https://github.com/acheronx0577/Earth-Juke-Box-Sonifysphere.",
          "We believe public scientific data should be accessible to everyone through multiple sensory modalities, bridging the gap between visual charts and auditory perception.",
        ],
      },
    ],
  },
};

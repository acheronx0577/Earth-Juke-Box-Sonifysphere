import { NextRequest, NextResponse } from "next/server";
import { RATE_LIMIT_MESSAGE, clientIp, soundVariationRateLimit } from "@/lib/listen/rateLimit";

const PROMPTS = {
  glass: "A gentle seamless ambient loop of clear glass key notes, soft and spacious, no speech, no percussion",
  strings: "A gentle seamless ambient loop of warm oceanic strings, slow and spacious, no speech, no percussion",
  mallet: "A gentle seamless ambient loop of soft wooden mallet tones, organic and spacious, no speech",
  pulse: "A gentle seamless ambient loop of deep rounded synth pulses, calm and spacious, no speech",
} as const;

export async function POST(request: NextRequest) {
  if (process.env.ELEVENLABS_SOUND_GENERATION_ENABLED !== "true") return NextResponse.json({ error: "ElevenLabs generation is disabled on this server." }, { status: 503 });
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) return NextResponse.json({ error: "ElevenLabs is not configured on this server." }, { status: 503 });
  let instrument: string;
  try { instrument = (await request.json() as { instrument?: string }).instrument ?? ""; }
  catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  if (!Object.hasOwn(PROMPTS, instrument)) return NextResponse.json({ error: "Choose an instrument first." }, { status: 400 });

  const decision = soundVariationRateLimit.check(clientIp((name) => request.headers.get(name)));
  if (!decision.ok) {
    return NextResponse.json(
      { error: RATE_LIMIT_MESSAGE },
      { status: 429, headers: { "Retry-After": String(decision.retryAfterSeconds), "Cache-Control": "no-store" } },
    );
  }

  try {
    const response = await fetch("https://api.elevenlabs.io/v1/sound-generation", {
      method: "POST",
      headers: { "xi-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({ text: PROMPTS[instrument as keyof typeof PROMPTS], loop: true, duration_seconds: 5, prompt_influence: 0.3 }),
      signal: AbortSignal.timeout(35000),
      cache: "no-store",
    });
    if (!response.ok) return NextResponse.json({ error: response.status === 403 ? "This key cannot generate sound effects." : "Sound generation is unavailable right now." }, { status: 502 });
    return new NextResponse(response.body, { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ error: "ElevenLabs could not be reached." }, { status: 502 }); }
}

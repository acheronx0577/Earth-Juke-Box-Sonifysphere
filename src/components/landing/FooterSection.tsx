import type { ReactNode } from "react";
import Link from "next/link";
import { FooterWordmark } from "@/components/landing/FooterWordmark";

function NavLinks({ showChallenge }: Readonly<{ showChallenge: boolean }>) {
  return (
    <>
      <Link href="/listen" className="sonify-text-link sonify-footer-link">
        Listen
      </Link>
      <Link href="/story" className="sonify-text-link sonify-footer-link">
        Story
      </Link>
      <Link href="/about" className="sonify-text-link sonify-footer-link">
        About
      </Link>
      {showChallenge ? (
        <Link href="/challenge" className="sonify-text-link sonify-footer-link">
          Challenge
        </Link>
      ) : null}
    </>
  );
}

function Co2Body() {
  return (
    <>
      <p className="sonify-footer-copy">NOAA Global Monitoring Laboratory</p>
      <p className="sonify-footer-copy">Mauna Loa Observatory · monthly mean</p>
      <a
        className="sonify-text-link sonify-footer-link sonify-footer-link-underline"
        href="https://gml.noaa.gov/ccgg/trends/"
        target="_blank"
        rel="noreferrer"
      >
        gml.noaa.gov
      </a>
    </>
  );
}

function EarthBody() {
  return (
    <>
      <p className="sonify-footer-copy">NASA EPIC Team (DSCOVR)</p>
      <a
        className="sonify-text-link sonify-footer-link sonify-footer-link-underline"
        href="https://epic.gsfc.nasa.gov/"
        target="_blank"
        rel="noreferrer"
      >
        epic.gsfc.nasa.gov
      </a>
    </>
  );
}

function TypeBody() {
  return (
    <>
      <p className="sonify-footer-copy">
        <span>{"Display: Planet Kosmos by Mads Rydahl, The Planet ("}</span>
        <a
          className="sonify-footer-inline-link"
          href="https://www.dafont.com/planet-kosmos.font"
          target="_blank"
          rel="noreferrer"
        >
          dafont.com
        </a>
        <span>{")"}</span>
      </p>
      <p className="sonify-footer-copy">UI: Geist / Geist Mono (SIL OFL 1.1)</p>
    </>
  );
}

function FooterCredit({ title, children }: Readonly<{ title: string; children: ReactNode }>) {
  return (
    <details className="sonify-footer-col sonify-footer-fold">
      <summary className="sonify-footer-kicker">
        <span>{title}</span>
        <span className="sonify-footer-chevron" aria-hidden="true" />
      </summary>
      <div className="sonify-footer-fold-body">{children}</div>
    </details>
  );
}

export function FooterSection({ showChallenge = false }: Readonly<{ showChallenge?: boolean }>) {
  return (
    <footer className="sonify-footer" data-name="Landing/Footer">
      <div className="sonify-footer-frame">
        <div className="sonify-footer-bg-wrapper" aria-hidden="true">
          <div className="sonify-footer-bg" />
        </div>

        <div className="sonify-footer-inner">
          <div className="sonify-footer-cols">
            <div className="sonify-footer-static">
              <div className="sonify-footer-col">
                <p className="sonify-footer-kicker">Navigate</p>
                <NavLinks showChallenge={showChallenge} />
              </div>
              <div className="sonify-footer-col">
                <p className="sonify-footer-kicker">CO₂ data</p>
                <Co2Body />
              </div>
              <div className="sonify-footer-col">
                <p className="sonify-footer-kicker">Earth image</p>
                <EarthBody />
              </div>
              <div className="sonify-footer-col">
                <p className="sonify-footer-kicker">Type</p>
                <TypeBody />
              </div>
            </div>

            <div className="sonify-footer-phone">
              <div className="sonify-footer-col sonify-footer-nav">
                <p className="sonify-footer-kicker">Navigate</p>
                <div className="sonify-footer-nav-links">
                  <NavLinks showChallenge />
                </div>
              </div>
              <FooterCredit title="CO₂ data">
                <Co2Body />
              </FooterCredit>
              <FooterCredit title="Earth image">
                <EarthBody />
              </FooterCredit>
              <FooterCredit title="Type">
                <TypeBody />
              </FooterCredit>
            </div>
          </div>

          <FooterWordmark />

          <div className="sonify-footer-legal">
            <p>Space Apps 2026 · The Earth Information Jukebox</p>
            <p>
              Hero image: AI-generated illustration (ChatGPT), not a real person or a real photo of Earth. SI tools: Grok Bot, ChatGPT, Claude, Antigravity, and Codex. CO₂: NOAA GML Mauna Loa
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}

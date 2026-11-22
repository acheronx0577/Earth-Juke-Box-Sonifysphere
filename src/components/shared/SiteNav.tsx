"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { GITHUB_REPO } from "@/lib/agentCopy";

const GITHUB_ICON_PATH =
  "M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z";

export function SiteNav() {
  const navRef = useRef<HTMLElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [compact, setCompact] = useState(false);
  const pathname = usePathname();

  const handleLinkClick = () => {
    if (typeof window !== "undefined" && window.innerWidth <= 1000) {
      setTimeout(() => setIsOpen(false), 300);
    }
  };

  useEffect(() => {
    const media = window.matchMedia("(max-width: 1000px)");
    const onResize = () => {
      setCompact(media.matches);
      if (!media.matches) setIsOpen(false);
    };
    onResize();
    media.addEventListener("change", onResize);
    return () => media.removeEventListener("change", onResize);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };

    const onClickOutside = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("click", onClickOutside);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("click", onClickOutside);
    };
  }, [isOpen]);

  const navLinks = [
    { href: "/", label: "Home", isActive: pathname === "/" },
    { href: "/listen", label: "Listen", isActive: pathname === "/listen" },
    { href: "/challenge", label: "Challenges", isActive: pathname === "/challenge" || pathname.startsWith("/challenge") },
    { href: "/about", label: "About", isActive: pathname === "/about" },
    { href: "/contact", label: "Contact", isActive: pathname === "/contact" },
  ];

  return (
    <nav
      ref={navRef}
      aria-label="Primary navigation"
      className={`sonify-nav ${isOpen ? "nav-open" : ""}`}
    >
        <div className="nav-container">
          <div className="nav-bg" />
        </div>

        <button
          type="button"
          className="nav-mobile-header"
          onClick={() => setIsOpen((prev) => !prev)}
          aria-expanded={isOpen}
          aria-label="SonifySphere menu"
        >
          <p className="nav-logo">SonifySphere</p>
          <p className="nav-menu-toggle">Menu</p>
        </button>

        <div className="nav-overlay" inert={compact && !isOpen ? true : undefined}>
          <div className="nav-items">
            {navLinks.map((link) => (
              <div key={link.href} className="nav-item">
                <Link
                  href={link.href}
                  prefetch={false}
                  onClick={handleLinkClick}
                  className={link.isActive ? "active" : ""}
                  aria-current={link.isActive ? "page" : undefined}
                >
                  {link.label}
                  {link.isActive ? <span className="active-underline" aria-hidden="true" /> : null}
                </Link>
              </div>
            ))}
            <div className="nav-item">
              <a
                href={GITHUB_REPO}
                target="_blank"
                rel="noreferrer"
                onClick={handleLinkClick}
                className="nav-github-link"
                aria-label="GitHub repository"
              >
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 16 16"
                  fill="currentColor"
                  aria-hidden="true"
                  className="nav-github-svg"
                >
                  <path d={GITHUB_ICON_PATH} />
                </svg>
                <span>GitHub</span>
              </a>
            </div>
          </div>
        </div>
      </nav>
  );
}

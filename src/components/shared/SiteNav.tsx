"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

function GooSvgFilter() {
  return (
    <svg
      style={{ visibility: "hidden", position: "absolute" }}
      width="0"
      height="0"
      aria-hidden="true"
    >
      <defs>
        <filter id="goo">
          <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
          <feColorMatrix
            in="blur"
            mode="matrix"
            values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 19 -9"
            result="goo"
          />
          <feComposite in="SourceGraphic" in2="goo" operator="atop" />
        </filter>
      </defs>
    </svg>
  );
}

export function SiteNav() {
  const navRef = useRef<HTMLElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  const handleLinkClick = () => {
    if (typeof window !== "undefined" && window.innerWidth <= 1000) {
      setTimeout(() => setIsOpen(false), 300);
    }
  };

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth > 1000) {
        setIsOpen(false);
      }
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
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
  ];

  return (
    <>
      <GooSvgFilter />
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
          aria-label="Toggle mobile menu"
        >
          <p className="nav-logo">SonifySphere</p>
          <p className="nav-menu-toggle">Menu</p>
        </button>

        <div className="nav-overlay">
          <div className="nav-items">
            {navLinks.map((link) => (
              <div key={link.href} className="nav-item">
                <Link
                  href={link.href}
                  prefetch={pathname === "/listen" ? false : undefined}
                  onClick={handleLinkClick}
                  className={link.isActive ? "active" : ""}
                  aria-current={link.isActive ? "page" : undefined}
                >
                  {link.label}
                  {link.isActive ? <span className="active-underline" aria-hidden="true" /> : null}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </nav>
    </>
  );
}

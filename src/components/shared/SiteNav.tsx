"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

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
          aria-label="Toggle mobile menu"
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
          </div>
        </div>
      </nav>
  );
}

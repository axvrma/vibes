import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { Github } from "../ui/Github";
import { AnimatePresence, m } from "motion/react";
import { Brand } from "../ui/Brand";
import { REPO } from "../../data/feed";

const links = [
  ["Experience", "#experience"],
  ["Features", "#features"],
  ["How it works", "#how-it-works"],
  ["Self-hosting", "#self-hosting"],
] as const;

export function Header() {
  const [open, setOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const nav = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        menuButton.current?.focus();
      }
    };
    const outside = (event: PointerEvent) => {
      if (!nav.current?.contains(event.target as Node)) setOpen(false);
    };
    const resize = () => {
      if (window.innerWidth > 900) setOpen(false);
    };
    document.addEventListener("keydown", close);
    document.addEventListener("pointerdown", outside);
    window.addEventListener("resize", resize);
    return () => {
      document.removeEventListener("keydown", close);
      document.removeEventListener("pointerdown", outside);
      window.removeEventListener("resize", resize);
    };
  }, [open]);
  return (
    <header className="site-header" ref={nav}>
      <nav className="nav-shell container" aria-label="Main navigation">
        <Brand />
        <div className="desktop-links">
          {links.map(([name, href]) => (
            <a href={href} key={href}>
              {name}
            </a>
          ))}
          <a href={REPO} target="_blank" rel="noreferrer">
            GitHub <ArrowUpRight size={12} />
          </a>
        </div>
        <a className="nav-cta" href={REPO} target="_blank" rel="noreferrer">
          <Github size={15} /> Explore on GitHub <ArrowUpRight size={14} />
        </a>
        <button
          className="menu-toggle icon-button"
          ref={menuButton}
          onClick={() => setOpen(!open)}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          aria-controls="mobile-nav"
        >
          {open ? <X /> : <Menu />}
        </button>
      </nav>
      <AnimatePresence>
        {open && (
          <m.nav
            id="mobile-nav"
            className="mobile-nav"
            aria-label="Mobile navigation"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
          >
            {links.map(([name, href]) => (
              <a href={href} key={href} onClick={() => setOpen(false)}>
                {name}
                <ArrowUpRight size={18} />
              </a>
            ))}
            <a href={REPO} target="_blank" rel="noreferrer">
              GitHub <Github size={18} />
            </a>
          </m.nav>
        )}
      </AnimatePresence>
    </header>
  );
}

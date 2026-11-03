import { ArrowDown, ArrowUpRight, Play } from "lucide-react";
import { Github } from "../ui/Github";
import { PhoneDemo } from "../player/PhoneDemo";
import { REPO } from "../../data/feed";

export function Hero() {
  return (
    <section className="hero container" id="home" aria-labelledby="hero-title">
      <div className="hero-copy">
        <div className="eyebrow">
          <span className="status-dot" /> OPEN SOURCE <span>·</span> SELF-HOSTED{" "}
          <span>·</span> MADE FOR YOU
        </div>
        <h1 id="hero-title">
          <span>Scroll freely.</span>
          <span>Own the</span>
          <span className="gradient-text">
            experience<span className="headline-dot">.</span>
          </span>
        </h1>
        <p className="hero-description">
          All the joy of a vertical video feed, with your media and your rules.
          Meet Vibes: a personal short-video experience built for self-hosting.
        </p>
        <div className="hero-buttons">
          <a href="#experience" className="button button-pink">
            <Play size={16} fill="currentColor" /> See it in action{" "}
            <ArrowDown size={16} />
          </a>
          <a
            className="button button-outline"
            href={REPO}
            target="_blank"
            rel="noreferrer"
          >
            <Github size={17} /> View on GitHub <ArrowUpRight size={15} />
          </a>
        </div>
        <div className="hero-footnote">
          <span className="tiny-lines">
            <i />
            <i />
            <i />
            <i />
          </span>
          <span>A little less algorithm. A lot more you.</span>
        </div>
      </div>
      <div className="hero-demo" id="experience">
        <div className="demo-label">
          <span className="status-dot" /> INTERACTIVE PREVIEW{" "}
          <span>· SAMPLE CONTENT</span>
        </div>
        <PhoneDemo />
      </div>
      <div className="hero-bottom">
        <span>YOUR FEED. YOUR RULES.</span>
        <a href="#features">
          A good place to get lost <ArrowDown size={13} />
        </a>
        <span>SCROLL A LITTLE. FEEL A LOT.</span>
      </div>
    </section>
  );
}

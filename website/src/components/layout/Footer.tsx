import { ArrowRight, ArrowUpRight } from "lucide-react";
import { Github } from "../ui/Github";
import { REPO } from "../../data/feed";
import { Brand } from "../ui/Brand";

export function Footer() {
  return (
    <>
      <section
        className="closing-section container"
        aria-labelledby="closing-title"
      >
        <div className="closing-decoration" aria-hidden="true">
          ✳
        </div>
        <span className="label">LESS NOISE. MORE YOU.</span>
        <h2 id="closing-title">
          Make room for
          <br />
          better vibes<span>.</span>
        </h2>
        <p>Your favorite videos deserve a space you control.</p>
        <div className="closing-buttons">
          <a
            className="button button-light"
            href={REPO}
            target="_blank"
            rel="noreferrer"
          >
            <Github size={17} /> Get started on GitHub{" "}
            <ArrowUpRight size={16} />
          </a>
          <a href="#experience" className="closing-demo">
            Experience the demo <ArrowRight size={16} />
          </a>
        </div>
        <span className="closing-bottom">
          A LITTLE SCROLL. A LITTLE SOUL. ALL YOURS.
        </span>
      </section>
      <footer className="site-footer container">
        <div className="footer-main">
          <div>
            <Brand />
            <p>Your feed. Your rules.</p>
          </div>
          <div className="footer-links">
            <div>
              <span>EXPLORE</span>
              <a href="#experience">Experience</a>
              <a href="#features">Features</a>
              <a href="#self-hosting">Self-hosting</a>
            </div>
            <div>
              <span>IN THE OPEN</span>
              <a href={REPO} target="_blank" rel="noreferrer">
                GitHub <ArrowUpRight size={12} />
              </a>
              <a href={`${REPO}/issues`} target="_blank" rel="noreferrer">
                Issues <ArrowUpRight size={12} />
              </a>
              <a href={`${REPO}#readme`} target="_blank" rel="noreferrer">
                Documentation <ArrowUpRight size={12} />
              </a>
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} Vibes. A space of your own.</span>
          <a href="https://github.com/axvrma" target="_blank" rel="noreferrer">
            Built by Abhishek Verma <ArrowUpRight size={12} />
          </a>
          <span>
            <span className="status-dot" /> KEEP THE GOOD VIBES GOING.
          </span>
        </div>
      </footer>
    </>
  );
}

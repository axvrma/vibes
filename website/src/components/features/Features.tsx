import {
  ArrowDownUp,
  ArrowUpRight,
  Check,
  FolderOpen,
  Heart,
  LayoutDashboard,
  LockKeyhole,
  Server,
} from "lucide-react";
import { useDemo } from "../../lib/demo-context";
import { Reveal } from "../ui/Reveal";
import { SOURCE } from "../../data/feed";

export function Features() {
  const { likes, toggleLike, openNote, index } = useDemo();
  const currentId = ["alpine", "coffee", "city", "ocean", "night"][index];
  return (
    <section
      className="features section container"
      id="features"
      aria-labelledby="features-title"
    >
      <Reveal>
        <div className="section-heading">
          <div>
            <span className="label pink">THE GOOD STUFF, BUILT IN</span>
            <h2 id="features-title">
              Everything you love.
              <br />
              <span className="muted">Nothing you don’t.</span>
            </h2>
          </div>
          <p>
            Familiar where it matters.
            <br />
            Yours where it counts.
          </p>
        </div>
      </Reveal>
      <div className="feature-grid">
        <Reveal className="feature-card feature-feed">
          <span className="feature-icon pink">
            <ArrowDownUp size={21} />
          </span>
          <h3>One more swipe.</h3>
          <p>
            A familiar, fluid vertical-video experience. Just your collection,
            in full focus.
          </p>
          <div className="mini-film">
            <img
              src="/media/ocean.webp"
              alt="Ocean sample illustration"
              loading="lazy"
              width="115"
              height="155"
            />
            <img
              src="/media/alpine.webp"
              alt="Mountain sample illustration"
              loading="lazy"
              width="115"
              height="155"
            />
            <img
              src="/media/coffee.webp"
              alt="Coffee sample illustration"
              loading="lazy"
              width="115"
              height="155"
            />
            <span>
              <ArrowDownUp size={18} />
            </span>
          </div>
          <a className="card-link" href="#experience">
            Try the feed <ArrowUpRight size={15} />
          </a>
        </Reveal>
        <Reveal className="feature-card feature-library">
          <span className="feature-icon violet">
            <FolderOpen size={21} />
          </span>
          <h3>Your kind of collection.</h3>
          <p>
            Bring your personal media library. Organize it with tags and
            categories.
          </p>
          <div className="collection-stack">
            <div>
              <span className="collection-emoji">↟</span>
              <div>
                Out in the wild<small>Travel · Nature</small>
              </div>
              <Check size={14} />
            </div>
            <div>
              <span className="collection-emoji warm">☕</span>
              <div>
                Little rituals<small>Everyday · Slow living</small>
              </div>
              <Check size={14} />
            </div>
            <div>
              <span className="collection-emoji violet">☾</span>
              <div>
                After hours<small>City · Night</small>
              </div>
              <Check size={14} />
            </div>
          </div>
          <span className="sample-indicator">Illustrative collections</span>
        </Reveal>
        <Reveal className="feature-card feature-likes">
          <span className="feature-icon pink">
            <Heart size={21} />
          </span>
          <h3>More than a like.</h3>
          <p>
            Keep the moments that matter. Like a video, then try a personal
            note.
          </p>
          <div className="like-illustration">
            <button
              className={likes[currentId] ? "liked" : ""}
              aria-pressed={Boolean(likes[currentId])}
              aria-label="Like the current sample"
              onClick={() => toggleLike(currentId)}
            >
              <Heart
                size={34}
                fill={likes[currentId] ? "currentColor" : "none"}
              />
            </button>
            <span className="dashed-line" />
            <button className="sample-note" onClick={openNote}>
              <span>note to self</span>More days like this. <span>↗</span>
            </button>
          </div>
          <span className="sample-indicator">
            Notes editor: concept preview
          </span>
        </Reveal>
        <Reveal className="feature-card compact-feature">
          <span className="feature-icon cyan">
            <LockKeyhole size={21} />
          </span>
          <div>
            <h3>Private by design.</h3>
            <p>
              Run the platform on infrastructure you control. Choose where your
              media lives.
            </p>
          </div>
        </Reveal>
        <Reveal className="feature-card compact-feature">
          <span className="feature-icon violet">
            <LayoutDashboard size={21} />
          </span>
          <div>
            <h3>A place for everything.</h3>
            <p>
              Upload, tag, and manage your videos from a dedicated Angular
              dashboard.
            </p>
          </div>
          <a
            className="feature-arrow"
            href="#dashboard"
            aria-label="Explore the dashboard"
          >
            <ArrowUpRight size={20} />
          </a>
        </Reveal>
        <Reveal className="feature-card compact-feature">
          <span className="feature-icon warm">
            <Server size={21} />
          </span>
          <div>
            <h3>Home is your server.</h3>
            <p>
              A self-hosted stack. Docker brings the dashboard and API together.
            </p>
          </div>
          <a
            className="feature-arrow"
            href={`${SOURCE}/infra`}
            target="_blank"
            rel="noreferrer"
            aria-label="View Docker configuration"
          >
            <ArrowUpRight size={20} />
          </a>
        </Reveal>
      </div>
    </section>
  );
}

import {
  ArrowUpRight,
  Check,
  Heart,
  MessageSquare,
  MoveUpRight,
} from "lucide-react";
import { feed } from "../../data/feed";
import { useDemo } from "../../lib/demo-context";
import { Reveal } from "../ui/Reveal";

export function FeedStory() {
  const { index, select, likes, notes, openNote } = useDemo();
  const item = feed[index];
  return (
    <section className="feed-story section" aria-labelledby="feed-story-title">
      <div className="container">
        <Reveal className="story-header">
          <div>
            <span className="label pink">
              A FEED WITH YOUR FINGERPRINTS ON IT
            </span>
            <h2 id="feed-story-title">
              Made for the
              <br />
              <span className="serif-emphasis">next swipe.</span>
            </h2>
          </div>
          <div>
            <p>
              That trip. That first sip. That perfect bit of nothing.
              <br />
              Make a little space for the things you love.
            </p>
            <a className="text-link" href="#experience">
              Meet your new happy place <ArrowUpRight size={16} />
            </a>
          </div>
          <span className="story-asterisk" aria-hidden="true">
            ✳
          </span>
        </Reveal>
        <div className="filmstrip" aria-label="Choose sample media">
          {feed.map((clip, i) => (
            <button
              className={`film-card ${index === i ? "selected" : ""}`}
              key={clip.id}
              onClick={() => select(i)}
              aria-pressed={index === i}
              aria-label={`Select ${clip.name}`}
            >
              <img
                src={`/media/${clip.id}.webp`}
                alt=""
                loading="lazy"
                width="260"
                height="350"
              />
              <span className="film-number" aria-hidden="true">
                0{i + 1}
              </span>
              <span className="film-caption">
                <small aria-hidden="true">{clip.tag}</small>
                <strong>{clip.name}</strong>
              </span>
              <span className="film-select">
                {index === i ? <Check size={17} /> : <MoveUpRight size={17} />}
              </span>
            </button>
          ))}
        </div>
        <div className="story-live">
          <div>
            <span className="status-dot" />
            <span>NOW IN YOUR PREVIEW</span>
            <strong aria-live="polite">{item.name}</strong>
            <span className="live-divider" />
            <span className="live-detail">
              <Heart
                size={14}
                fill={likes[item.id] ? "currentColor" : "none"}
              />
              {likes[item.id] ? "Liked" : "Not liked yet"}
            </span>
          </div>
          <button className="text-link" onClick={openNote}>
            <MessageSquare size={14} />
            {notes[item.id] ? "View your note" : "Leave yourself a note"}{" "}
            <ArrowUpRight size={14} />
          </button>
        </div>
        <p className="media-disclosure">
          Original animated illustrations. Sample content, made for this
          preview. Likes and notes stay in this browser session.
        </p>
      </div>
    </section>
  );
}

import { useState } from "react";
import {
  ArrowUpRight,
  FolderOpen,
  Grid2X2,
  Search,
  SlidersHorizontal,
  Tag,
  Upload,
  Video,
} from "lucide-react";
import { feed, SOURCE } from "../../data/feed";
import { Reveal } from "../ui/Reveal";
import { useDemo } from "../../lib/demo-context";

export function Dashboard() {
  const [filter, setFilter] = useState("All media");
  const [search, setSearch] = useState("");
  const { select } = useDemo();
  const filters = ["All media", "Nature", "Everyday", "Architecture"];
  const visible = feed.filter(
    (clip) =>
      (filter === "All media" ||
        clip.tag === filter ||
        (filter === "Nature" && clip.id === "alpine")) &&
      clip.name.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <section
      className="dashboard-section section container"
      id="dashboard"
      aria-labelledby="dashboard-title"
    >
      <Reveal className="section-heading">
        <div>
          <span className="label violet">
            A LITTLE ORGANIZATION. A LOT OF POSSIBILITIES.
          </span>
          <h2 id="dashboard-title">
            The control room
            <br />
            <span className="muted">behind the feed.</span>
          </h2>
        </div>
        <p>
          Your collection, beautifully in order.
          <br />
          Upload. Organize. Press play.
        </p>
      </Reveal>
      <Reveal className="browser-frame">
        <div className="browser-chrome">
          <span className="browser-dots">
            <i />
            <i />
            <i />
          </span>
          <span>
            <span className="status-dot" /> YOUR VIBES / MEDIA LIBRARY
          </span>
          <span>CONCEPT PREVIEW</span>
        </div>
        <div className="dashboard-preview">
          <aside className="dashboard-sidebar">
            <span className="mini-wordmark">
              vibes<span>.</span>
            </span>
            <span className="dashboard-sidebar-label">YOUR WORKSPACE</span>
            <span className="active">
              <Grid2X2 size={15} /> Media library
            </span>
            <span>
              <FolderOpen size={15} /> Categories
            </span>
            <span>
              <Tag size={15} /> Tags
            </span>
            <div className="sidebar-bottom">
              <span className="avatar">Y</span>
              <span>
                Your space<small>Administrator</small>
              </span>
              <span className="status-dot" />
            </div>
          </aside>
          <div className="dashboard-content">
            <div className="dashboard-title">
              <div>
                <span className="label">A SPACE FOR YOUR FAVORITES</span>
                <h3>
                  Media library<span>.</span>
                </h3>
              </div>
              <a
                className="button button-small"
                href={`${SOURCE}/dashboard/src/app/shared/components/upload-dialog.component.ts`}
                target="_blank"
                rel="noreferrer"
              >
                <Upload size={14} /> Explore uploads <ArrowUpRight size={12} />
              </a>
            </div>
            <div className="dashboard-toolbar">
              <div role="group" aria-label="Filter sample library">
                {filters.map((name) => (
                  <button
                    key={name}
                    aria-pressed={filter === name}
                    className={filter === name ? "active" : ""}
                    onClick={() => setFilter(name)}
                  >
                    {name}
                    {name === "All media" && <span>5</span>}
                  </button>
                ))}
              </div>
              <label className="dashboard-search">
                <Search size={14} />
                <input
                  aria-label="Search sample library"
                  type="search"
                  placeholder="Find your moment…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </label>
            </div>
            <div className="dashboard-media" aria-live="polite">
              {visible.map((clip) => (
                <a
                  className="dashboard-media-card"
                  href="#experience"
                  key={clip.id}
                  onClick={() =>
                    select(feed.findIndex((item) => item.id === clip.id))
                  }
                >
                  <div>
                    <img
                      src={`/media/${clip.id}.webp`}
                      alt={`${clip.name} sample artwork`}
                      loading="lazy"
                      width="190"
                      height="145"
                    />
                    <span>
                      <Video size={11} /> {clip.duration}
                    </span>
                  </div>
                  <strong>{clip.name}</strong>
                  <small>
                    <span style={{ backgroundColor: clip.color }} />
                    {clip.tag}
                    <ArrowUpRight size={13} />
                  </small>
                </a>
              ))}
              {visible.length === 0 && (
                <p className="library-empty">
                  No sample videos match. Try another search or category.
                </p>
              )}
            </div>
            <div className="dashboard-status">
              <span>
                <span className="status-dot" /> SAMPLE LIBRARY ·{" "}
                {visible.length} OF 5 VIDEOS
              </span>
              <span>
                <SlidersHorizontal size={11} /> Everything in its place.
              </span>
            </div>
          </div>
        </div>
      </Reveal>
      <p className="preview-disclosure">
        Interactive concept based on the Angular dashboard’s media library,
        tags, and category filters. Sample data; no uploads or account
        connection.{" "}
        <a href={`${SOURCE}/dashboard`} target="_blank" rel="noreferrer">
          View the real dashboard source <ArrowUpRight size={12} />
        </a>
      </p>
    </section>
  );
}

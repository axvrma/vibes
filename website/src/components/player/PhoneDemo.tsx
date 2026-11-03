import { useEffect, useRef, useState } from "react";
import { m, useReducedMotion } from "motion/react";
import {
  ChevronDown,
  ChevronUp,
  Heart,
  MessageSquare,
  Pause,
  Play,
  RotateCcw,
  Volume2,
  VolumeX,
  Wifi,
  BatteryFull,
} from "lucide-react";
import { feed, nextIndex } from "../../data/feed";
import { useDemo } from "../../lib/demo-context";

export function PhoneDemo() {
  const { index, select, likes, toggleLike, notes, openNote } = useDemo();
  const item = feed[index];
  const video = useRef<HTMLVideoElement>(null);
  const feedRef = useRef<HTMLDivElement>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const wheelTime = useRef(0);
  const [muted, setMuted] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [status, setStatus] = useState<
    "ready" | "loading" | "error" | "blocked"
  >("ready");
  const [progress, setProgress] = useState(0);
  const reduced = useReducedMotion();

  useEffect(() => {
    const element = video.current;
    if (!element) return;
    let inView = false;
    let manuallyPaused = Boolean(reduced);
    const attemptPlay = () => {
      if (!document.hidden && inView && !manuallyPaused) {
        element.play().catch((error: DOMException) => {
          if (error.name !== "AbortError")
            setStatus(element.error ? "error" : "blocked");
        });
      } else element.pause();
    };
    const observer = new IntersectionObserver(
      ([entry]) => {
        inView = entry.isIntersecting;
        attemptPlay();
      },
      { threshold: 0.2 },
    );
    const interaction = () => {
      manuallyPaused = !element.paused;
    };
    const holder = feedRef.current;
    const change = (event: Event) => {
      if ((event as CustomEvent).detail === "toggle") interaction();
      else if ((event as CustomEvent).detail === "play") manuallyPaused = false;
    };
    holder?.addEventListener("playback-intent", change);
    observer.observe(element);
    document.addEventListener("visibilitychange", attemptPlay);
    return () => {
      observer.disconnect();
      holder?.removeEventListener("playback-intent", change);
      document.removeEventListener("visibilitychange", attemptPlay);
      element.pause();
    };
  }, [index, reduced]);

  const navigate = (delta: number) => {
    select(nextIndex(index, delta));
  };
  const togglePlayback = () => {
    const element = video.current;
    if (!element) return;
    feedRef.current?.dispatchEvent(
      new CustomEvent("playback-intent", { detail: "toggle" }),
    );
    if (element.paused)
      element.play().catch((error: DOMException) => {
        if (error.name !== "AbortError")
          setStatus(element.error ? "error" : "blocked");
      });
    else element.pause();
  };
  const replay = () => {
    if (!video.current) return;
    feedRef.current?.dispatchEvent(
      new CustomEvent("playback-intent", { detail: "play" }),
    );
    video.current.currentTime = 0;
    const element = video.current;
    if (element.error) element.load();
    element.play().catch((error: DOMException) => {
      if (error.name !== "AbortError")
        setStatus(element.error ? "error" : "blocked");
    });
  };

  return (
    <div className="demo-stage">
      <div className="stage-orbit orbit-one" />
      <div className="stage-orbit orbit-two" />
      <div className="peek-card peek-coffee">
        <img
          src="/media/coffee.webp"
          alt="Original coffee artwork from the sample feed"
          width="150"
          height="220"
        />
        <span>
          little rituals <span>↗</span>
        </span>
      </div>
      <div className="peek-card peek-ocean">
        <img
          src="/media/ocean.webp"
          alt="Original coastal artwork from the sample feed"
          width="160"
          height="235"
        />
        <span>offline state of mind</span>
      </div>
      <div className="phone-wrap">
        <div className="phone-edge" />
        <div className="phone-shell">
          <div
            className="phone-feed"
            ref={feedRef}
            tabIndex={0}
            role="region"
            aria-label="Interactive sample video feed. Use Up and Down arrow keys to browse."
            onKeyDown={(event) => {
              if (event.target !== event.currentTarget) return;
              if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                event.preventDefault();
                navigate(event.key === "ArrowDown" ? 1 : -1);
              }
            }}
            onWheel={(event) => {
              if (
                Math.abs(event.deltaY) > 24 &&
                Date.now() - wheelTime.current > 650
              ) {
                wheelTime.current = Date.now();
                navigate(event.deltaY > 0 ? 1 : -1);
              }
            }}
            onTouchStart={(event) => {
              touchStart.current = {
                x: event.touches[0].clientX,
                y: event.touches[0].clientY,
              };
            }}
            onTouchEnd={(event) => {
              const start = touchStart.current;
              if (!start || (event.target as HTMLElement).closest("button"))
                return;
              const delta = start.y - event.changedTouches[0].clientY;
              if (
                Math.abs(delta) > 55 &&
                Math.abs(delta) >
                  Math.abs(start.x - event.changedTouches[0].clientX)
              )
                navigate(delta > 0 ? 1 : -1);
              touchStart.current = null;
            }}
          >
            <m.div
              className="feed-media"
              key={item.id}
              initial={false}
              animate={{ opacity: 1 }}
              transition={{ duration: reduced ? 0 : 0.25 }}
            >
              <video
                ref={video}
                key={item.id}
                src={`/media/${item.id}.mp4`}
                poster={`/media/${item.id}.webp`}
                muted={muted}
                playsInline
                loop
                preload="none"
                aria-label={`${item.name}: original animated illustration, with no audio track`}
                onLoadStart={() => {
                  setStatus("loading");
                  setProgress(0);
                }}
                onCanPlay={() => setStatus("ready")}
                onPlaying={() => {
                  setPlaying(true);
                  setStatus("ready");
                }}
                onPause={() => setPlaying(false)}
                onError={() => {
                  setStatus("error");
                  setPlaying(false);
                }}
                onTimeUpdate={() => {
                  if (video.current?.duration)
                    setProgress(
                      video.current.currentTime / video.current.duration,
                    );
                }}
              />
            </m.div>
            <div className="phone-shade" />
            <div className="phone-status">
              <span>9:41</span>
              <span className="camera" />
              <span>
                <Wifi size={12} />
                <BatteryFull size={17} />
              </span>
            </div>
            <div className="feed-header">
              <span className="mini-wordmark">
                vibes<span>.</span>
              </span>
              <span className="feed-pill">Your collection</span>
            </div>
            <div className="phone-actions">
              <button
                className={`phone-action ${likes[item.id] ? "is-liked" : ""}`}
                aria-label={likes[item.id] ? "Unlike video" : "Like video"}
                aria-pressed={Boolean(likes[item.id])}
                onClick={() => toggleLike(item.id)}
              >
                <m.span
                  key={String(likes[item.id])}
                  animate={{ scale: likes[item.id] ? [1, 1.35, 1] : 1 }}
                  transition={{ duration: reduced ? 0 : 0.3 }}
                >
                  <Heart
                    size={25}
                    fill={likes[item.id] ? "currentColor" : "none"}
                  />
                </m.span>
                <span>{likes[item.id] ? "Liked" : "Like"}</span>
              </button>
              <button
                className="phone-action"
                aria-label="Add a personal note (concept preview)"
                onClick={openNote}
              >
                <MessageSquare
                  size={23}
                  fill={notes[item.id] ? "currentColor" : "none"}
                />
                <span>{notes[item.id] ? "1 note" : "Note"}</span>
              </button>
              <button
                className="phone-action"
                aria-label={muted ? "Unmute video" : "Mute video"}
                aria-pressed={!muted}
                onClick={() => setMuted(!muted)}
              >
                {muted ? <VolumeX size={22} /> : <Volume2 size={22} />}
                <span>{muted ? "Unmute" : "Mute"}</span>
              </button>
            </div>
            <div className="feed-info">
              <span className="collection-label">
                <span />
                {item.collection}
              </span>
              <h2>{item.title}</h2>
              <p>{item.caption}</p>
              <span className="art-label">
                Original motion study · no audio
              </span>
            </div>
            {(status === "loading" ||
              status === "error" ||
              status === "blocked") && (
              <div className={`media-status ${status}`} role="status">
                {status === "loading"
                  ? "Loading motion…"
                  : status === "error"
                    ? "Preview unavailable. Browse the artwork."
                    : "Press play to start the preview."}
              </div>
            )}
            <div className="playback-bar">
              <button
                aria-label={playing ? "Pause video" : "Play video"}
                className="icon-button"
                onClick={togglePlayback}
              >
                {playing ? (
                  <Pause size={14} fill="currentColor" />
                ) : (
                  <Play size={14} fill="currentColor" />
                )}
              </button>
              <div
                className="media-progress"
                role="progressbar"
                aria-label="Video progress"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(progress * 100)}
              >
                <span style={{ transform: `scaleX(${progress})` }} />
              </div>
              <button
                className="icon-button"
                aria-label="Replay video"
                onClick={replay}
              >
                <RotateCcw size={14} />
              </button>
            </div>
            <span className="home-indicator" />
          </div>
        </div>
      </div>
      <div className="floating-note">
        <span className="float-icon">
          <Heart size={17} fill="currentColor" />
        </span>
        <div>
          <strong>A feed that feels like you.</strong>
          <span>Your media. Your little escape.</span>
        </div>
        <span className="little-spark">✳</span>
      </div>
      <div className="feed-navigation">
        <button
          aria-label="Previous video"
          disabled={index === 0}
          onClick={() => navigate(-1)}
        >
          <ChevronUp size={19} />
        </button>
        <span aria-live="polite">
          {String(index + 1).padStart(2, "0")} <span>/ 05</span>
        </span>
        <button
          aria-label="Next video"
          disabled={index === feed.length - 1}
          onClick={() => navigate(1)}
        >
          <ChevronDown size={19} />
        </button>
      </div>
      <p className="demo-instruction">
        Scroll inside. Find your vibe. <span>↓</span>
      </p>
    </div>
  );
}

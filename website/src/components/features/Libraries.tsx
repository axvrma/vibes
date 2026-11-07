import { FolderOpen, HardDrive, Server, ArrowUpRight } from "lucide-react";
import { Reveal } from "../ui/Reveal";
import { SOURCE } from "../../data/feed";

export function Libraries() {
  return (
    <section
      className="section container acquisition"
      id="libraries"
      aria-labelledby="libraries-title"
    >
      <Reveal>
        <span className="label pink">YOUR PRIVATE VIDEO UNIVERSE</span>
        <h2 id="libraries-title">
          Your collection.
          <br />
          <span className="muted">At home, wherever you are.</span>
        </h2>
        <p className="acquisition-intro">
          Your space. Your stories. Your vibe. Choose videos on this device, or
          connect to your own Vibes server.
        </p>
      </Reveal>
      <div className="acquisition-grid">
        <Reveal className="feature-card">
          <FolderOpen className="pink" size={25} aria-hidden="true" />
          <h3>On this device</h3>
          <p>
            Enjoy videos stored locally on your device. Choose a folder, include
            subfolders when you want, and keep favorites and notes on that
            device. No server account required.
          </p>
          <p className="sample-indicator">
            Native app only. Folder access depends on your operating system and
            document provider. Browsers use Network Mode.
          </p>
        </Reveal>
        <Reveal className="feature-card">
          <Server className="violet" size={25} aria-hidden="true" />
          <h3>Connect to my Vibes server</h3>
          <p>
            Stream and organize your private collection. Search categories and
            tags, return to favorites, and continue watching with your personal
            server account.
          </p>
          <p className="sample-indicator">
            The server runs on infrastructure you control. Use TLS for access
            outside a trusted local network.
          </p>
        </Reveal>
      </div>
      <Reveal className="external-library">
        <div>
          <HardDrive className="violet" size={30} aria-hidden="true" />
          <h3>Already on your SSD? Keep it there.</h3>
          <p>
            Mount a server folder read-only, authorize its root, then refresh in
            Media Libraries. Vibes indexes metadata and creates thumbnails in
            its own storage. Repeat scans skip unchanged files; disconnected
            drives keep their records and your notes.
          </p>
          <p className="sample-indicator">
            External indexing supports MP4, MOV, MKV, WEBM, M4V and AVI.
            Playback depends on client codec support. No automatic transcoding
            or scheduled scans.
          </p>
          <a
            className="card-link"
            href={`${SOURCE}/docs/UPGRADE-2.3.md`}
            target="_blank"
            rel="noreferrer"
          >
            Set up a server library <ArrowUpRight size={16} />
          </a>
        </div>
        <div
          className="library-paths"
          aria-label="Read-only indexing architecture"
        >
          <code>Your SSD / mounted folder</code>
          <span aria-hidden="true">↓ read-only discovery</span>
          <code>Vibes metadata + thumbnails</code>
          <span aria-hidden="true">↓ authenticated playback</span>
          <code>Your private collection</code>
          <small>Architecture illustration · no live server connection</small>
        </div>
      </Reveal>
      <figure className="product-capture">
        <img
          src="/media/vibes-libraries.png"
          alt="Vibes Media Libraries dashboard showing a completed scan of a disposable SSD library"
          loading="lazy"
          width="1440"
          height="1000"
        />
        <figcaption>
          Vibes 2.3 dashboard · actual application in a disposable test
          environment with one sample video. Your counts reflect your own
          library.
        </figcaption>
      </figure>
    </section>
  );
}

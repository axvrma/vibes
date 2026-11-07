import { useState } from "react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Check,
  Code2,
  Copy,
  Database,
  FolderOpen,
  HardDrive,
  LayoutDashboard,
  Server,
  Smartphone,
} from "lucide-react";
import { Github } from "../ui/Github";
import { deployCommand, REPO, SOURCE } from "../../data/feed";
import { Reveal } from "../ui/Reveal";

export function HowItWorks() {
  const steps = [
    {
      number: "01",
      name: "Make yourself at home.",
      label: "DEPLOY",
      description:
        "Run the API and dashboard on your own machine with Docker Compose.",
      path: "infra",
      Icon: Server,
    },
    {
      number: "02",
      name: "Bring your favorites.",
      label: "MANAGE",
      description:
        "Upload MP4 / H.264 videos. Organize your collection in the Angular dashboard.",
      path: "dashboard",
      Icon: FolderOpen,
    },
    {
      number: "03",
      name: "Find your flow.",
      label: "ENJOY",
      description:
        "Connect the Flutter app to your server. Your next favorite moment is a swipe away.",
      path: "app",
      Icon: Smartphone,
    },
  ];
  return (
    <section
      className="how-section section container"
      id="how-it-works"
      aria-labelledby="how-title"
    >
      <Reveal className="how-heading">
        <span className="label pink">YOUR OWN LITTLE ECOSYSTEM</span>
        <h2 id="how-title">
          From your server
          <br />
          to your screen.
        </h2>
      </Reveal>
      <div className="steps">
        {steps.map(({ number, name, label, description, path, Icon }) => (
          <Reveal className="step" key={number}>
            <div className="step-top">
              <span>{number}</span>
              <Icon size={23} />
              <ArrowRight size={20} />
            </div>
            <span className="label">{label}</span>
            <h3>{name}</h3>
            <p>{description}</p>
            <a
              href={`${SOURCE}/${path}`}
              target="_blank"
              rel="noreferrer"
              className="text-link"
            >
              Explore {path === "infra" ? "the setup" : `the ${path}`}{" "}
              <ArrowUpRight size={15} />
            </a>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

export function SelfHosting() {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(deployCommand);
      setCopied(true);
      setCopyError(false);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopyError(true);
    }
  };
  return (
    <section
      className="hosting-section section"
      id="self-hosting"
      aria-labelledby="hosting-title"
    >
      <div className="container hosting-grid">
        <Reveal className="hosting-copy">
          <span className="label cyan">YOUR MEDIA. YOUR INFRASTRUCTURE.</span>
          <h2 id="hosting-title">
            Cloud optional.
            <br />
            <span className="muted">Control essential.</span>
          </h2>
          <p>
            Built for people who prefer running their media on their own
            infrastructure. A familiar stack. A place to call your own.
          </p>
          <div className="hosting-badges">
            <span>
              <Check size={14} /> Your storage
            </span>
            <span>
              <Check size={14} /> Your server
            </span>
            <span>
              <Check size={14} /> Your rules
            </span>
          </div>
          <a
            href={`${SOURCE}/infra#readme`}
            className="text-link"
            target="_blank"
            rel="noreferrer"
          >
            Read the installation guide <ArrowUpRight size={16} />
          </a>
        </Reveal>
        <Reveal>
          <div className="terminal">
            <div className="terminal-top">
              <span className="browser-dots">
                <i />
                <i />
                <i />
              </span>
              <span>LET’S GET YOU HOME</span>
              <button onClick={copy} aria-label="Copy deployment commands">
                {copied ? <Check size={13} /> : <Copy size={13} />}
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
            <div className="terminal-body">
              <p className="terminal-comment">
                # Configure your private server before starting.
              </p>
              <pre tabIndex={0} aria-label="Deployment commands">
                {deployCommand.split("\n").map((line) => (
                  <code key={line}>
                    <span className="terminal-dollar">$</span> {line}
                  </code>
                ))}
              </pre>
              <span className="terminal-cursor" />
            </div>
            <div className="terminal-footer">
              <Server size={13} />
              <span>
                Requires Git, Docker, Compose and configured .env secrets.
              </span>
            </div>
          </div>
          <p className="sample-indicator">
            In the editor, set two distinct random secrets, your exact browser
            origin and cookie security. Keep your existing settings when
            upgrading. See the installation guide for backups and TLS.
          </p>
          <p className="copy-status" role="status">
            {copyError
              ? "Clipboard unavailable. Select and copy the commands above."
              : copied
                ? "Deployment commands copied to clipboard."
                : "\u00a0"}
          </p>
        </Reveal>
        <div
          className="architecture"
          aria-label="System architecture: Flutter app and Angular dashboard connect through the authenticated Node.js and Express API to SQLite metadata and media storage."
        >
          <div>
            <Smartphone size={20} />
            <span>Flutter app</span>
          </div>
          <span className="architecture-line" />
          <div>
            <LayoutDashboard size={20} />
            <span>Angular dashboard</span>
          </div>
          <ArrowRight size={20} className="architecture-arrow" />
          <div className="api-node">
            <Code2 size={21} />
            <span>
              Node.js + Express<small>JWT-authenticated API</small>
            </span>
          </div>
          <ArrowRight size={20} className="architecture-arrow" />
          <div className="storage-nodes">
            <span>
              <Database size={16} /> SQLite metadata
            </span>
            <span>
              <HardDrive size={16} /> Media storage
            </span>
          </div>
        </div>
        <p className="hosting-note">
          <ArrowDown size={12} /> Netlify hosts this website. Your application
          services and video library run on your own infrastructure. Configure
          authentication and private access before use.
        </p>
      </div>
    </section>
  );
}

export function OpenSource() {
  return (
    <section
      className="source-section section container"
      aria-labelledby="source-title"
    >
      <Reveal className="source-content">
        <div className="source-github">
          <Github size={34} />
        </div>
        <span className="label">BUILT IN THE OPEN. MADE TO BE YOURS.</span>
        <h2 id="source-title">
          Good vibes.
          <br />
          <span className="gradient-text">Open source.</span>
        </h2>
        <p>
          Explore the code, understand how it works, and build on a media
          experience designed for independence.
        </p>
        <a className="repo-link" href={REPO} target="_blank" rel="noreferrer">
          <Github size={18} />
          <span>
            axvrma <span>/</span> <strong>vibes</strong>
          </span>
          <ArrowUpRight size={17} />
        </a>
        <div className="source-links">
          <a className="text-link" href={REPO} target="_blank" rel="noreferrer">
            Explore the source <ArrowUpRight size={14} />
          </a>
          <a
            className="text-link muted"
            href={`${REPO}/issues`}
            target="_blank"
            rel="noreferrer"
          >
            Report an issue <ArrowUpRight size={14} />
          </a>
        </div>
      </Reveal>
      <div className="source-art" aria-hidden="true">
        <div className="code-ring ring-one" />
        <div className="code-ring ring-two" />
        <div className="code-ring ring-three" />
        <span className="source-symbol">✳</span>
        <span className="orbit-tag tag-flutter">Flutter</span>
        <span className="orbit-tag tag-angular">Angular</span>
        <span className="orbit-tag tag-node">Node.js</span>
        <span className="orbit-tag tag-sqlite">SQLite</span>
        <span className="orbit-tag tag-docker">Docker</span>
        <span className="orbit-tag tag-express">Express</span>
      </div>
    </section>
  );
}

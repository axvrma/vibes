import { useCallback, useState } from "react";
import { LazyMotion, MotionConfig } from "motion/react";
import { Header } from "./components/layout/Header";
import { Footer } from "./components/layout/Footer";
import { Hero } from "./components/hero/Hero";
import { Libraries } from "./components/features/Libraries";
import { Features } from "./components/features/Features";
import { FeedStory } from "./components/showcase/FeedStory";
import { Dashboard } from "./components/showcase/Dashboard";
import {
  HowItWorks,
  OpenSource,
  SelfHosting,
} from "./components/showcase/SelfHosting";
import { NoteDialog } from "./components/player/NoteDialog";
import { DemoContext } from "./lib/demo-context";
import { nextIndex, normalizeNote } from "./data/feed";

const loadMotion = () =>
  import("./lib/motion-features").then((module) => module.default);

export default function App() {
  const [index, setIndex] = useState(0);
  const [likes, setLikes] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [noteOpen, setNoteOpen] = useState(false);
  const toggleLike = useCallback(
    (id: string) => setLikes((value) => ({ ...value, [id]: !value[id] })),
    [],
  );
  const saveNote = useCallback(
    (id: string, note: string) =>
      setNotes((value) => ({ ...value, [id]: normalizeNote(note) })),
    [],
  );
  const select = useCallback(
    (value: number) => setIndex(nextIndex(value, 0)),
    [],
  );
  return (
    <MotionConfig reducedMotion="user">
      <LazyMotion features={loadMotion} strict>
        <DemoContext.Provider
          value={{
            index,
            select,
            likes,
            toggleLike,
            notes,
            saveNote,
            openNote: () => setNoteOpen(true),
          }}
        >
          <a className="skip-link" href="#main">
            Skip to content
          </a>
          <Header />
          <main id="main">
            <div className="hero-overflow">
              <Hero />
            </div>
            <div className="stack-bar">
              <div className="container">
                <span>
                  GOOD VIBES.
                  <br />
                  <strong>SOLID FOUNDATIONS.</strong>
                </span>
                <div>
                  <span className="stack-icon flutter">▰</span>Flutter
                </div>
                <div>
                  <span className="stack-icon angular">A</span>Angular
                </div>
                <div>
                  <span className="stack-icon node">⬡</span>Node.js
                </div>
                <div>
                  <span className="stack-icon sqlite">◩</span>SQLite
                </div>
                <div>
                  <span className="stack-icon docker">▦</span>Docker
                </div>
                <span className="stack-footnote">
                  Built with Flutter, Angular,
                  <br />
                  Node.js, and Docker.
                </span>
              </div>
            </div>
            <Features />
            <Libraries />
            <FeedStory />
            <Dashboard />
            <HowItWorks />
            <SelfHosting />
            <OpenSource />
          </main>
          <Footer />
          <NoteDialog open={noteOpen} close={() => setNoteOpen(false)} />
        </DemoContext.Provider>
      </LazyMotion>
    </MotionConfig>
  );
}

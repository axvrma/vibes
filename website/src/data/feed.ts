export const REPO = "https://github.com/axvrma/vibes";
export const SOURCE = `${REPO}/tree/master`;
export const deployCommand =
  "git clone https://github.com/axvrma/vibes.git\ncd vibes/infra\ntest -f .env || cp .env.example .env\n${EDITOR:-vi} .env\ndocker compose config -q && docker compose up -d --build";

export const feed = [
  {
    id: "alpine",
    title: "A little closer to nowhere.",
    name: "Mountain Escape",
    collection: "Out in the wild",
    tag: "Travel",
    caption: "Less noise. More of this.",
    color: "#c0edcd",
    duration: "00:08",
  },
  {
    id: "coffee",
    title: "Slow mornings, on repeat.",
    name: "Morning Ritual",
    collection: "Little rituals",
    tag: "Everyday",
    caption: "Taking the long way to the first sip.",
    color: "#ffbd8f",
    duration: "00:08",
  },
  {
    id: "city",
    title: "A different point of view.",
    name: "City Geometry",
    collection: "Urban wandering",
    tag: "Architecture",
    caption: "Finding a little rhythm in the everyday.",
    color: "#b7adff",
    duration: "00:08",
  },
  {
    id: "ocean",
    title: "Meet me where it’s quiet.",
    name: "Ocean Hours",
    collection: "Out in the wild",
    tag: "Nature",
    caption: "No agenda. Just the tide.",
    color: "#90e3e1",
    duration: "00:08",
  },
  {
    id: "night",
    title: "After the world slows down.",
    name: "Midnight Drive",
    collection: "After hours",
    tag: "Night",
    caption: "A few more minutes under these lights.",
    color: "#ff9fc8",
    duration: "00:08",
  },
] as const;

export function nextIndex(
  index: number,
  delta: number,
  length = feed.length,
): number {
  return Math.min(Math.max(index + delta, 0), length - 1);
}

export function normalizeNote(note: string): string {
  return note.trim().slice(0, 500);
}

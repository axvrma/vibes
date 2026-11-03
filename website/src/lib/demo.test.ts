import { describe, expect, it } from "vitest";
import { feed, nextIndex, normalizeNote } from "../data/feed";

describe("feed boundaries", () => {
  it("keeps visitors at the start and end instead of wrapping unexpectedly", () => {
    expect(nextIndex(0, -1)).toBe(0);
    expect(nextIndex(feed.length - 1, 1)).toBe(feed.length - 1);
  });
  it("navigates both directions and clamps direct selection", () => {
    expect(nextIndex(2, 1)).toBe(3);
    expect(nextIndex(2, -1)).toBe(1);
    expect(nextIndex(99, 0)).toBe(4);
    expect(nextIndex(-7, 0)).toBe(0);
  });
});
describe("personal notes", () => {
  it("normalizes whitespace and supports clearing a note", () => {
    expect(normalizeNote("  Take this trip. \n")).toBe("Take this trip.");
    expect(normalizeNote("  \n  ")).toBe("");
  });
  it("caps input at 500 characters without changing user text", () => {
    expect(normalizeNote("x".repeat(600))).toHaveLength(500);
    expect(normalizeNote("<script>hello</script>")).toBe(
      "<script>hello</script>",
    );
  });
});

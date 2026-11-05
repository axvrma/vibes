import { createContext, useContext } from "react";
export interface DemoState {
  index: number;
  select: (index: number) => void;
  likes: Record<string, boolean>;
  toggleLike: (id: string) => void;
  notes: Record<string, string>;
  saveNote: (id: string, note: string) => void;
  openNote: () => void;
}
export const DemoContext = createContext<DemoState | null>(null);
export function useDemo() {
  const value = useContext(DemoContext);
  if (!value) throw new Error("DemoProvider is required");
  return value;
}

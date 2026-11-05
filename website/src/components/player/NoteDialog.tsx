import { useEffect, useRef } from "react";
import { Check, MessageSquare, X } from "lucide-react";
import { useDemo } from "../../lib/demo-context";
import { feed } from "../../data/feed";

export function NoteDialog({
  open,
  close,
}: {
  open: boolean;
  close: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const { index, notes, saveNote } = useDemo();
  const item = feed[index];
  useEffect(() => {
    if (open && !dialog.current?.open) dialog.current?.showModal();
    else if (!open && dialog.current?.open) dialog.current.close();
  }, [open]);
  return (
    <dialog
      ref={dialog}
      className="note-dialog"
      aria-labelledby="note-title"
      onCancel={close}
      onClose={close}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <form
        key={`${item.id}-${open}`}
        onSubmit={(e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          saveNote(item.id, String(data.get("note") ?? ""));
          close();
        }}
      >
        <div className="dialog-top">
          <span className="label pink">
            <MessageSquare size={14} /> A THOUGHT TO KEEP
          </span>
          <button
            type="button"
            aria-label="Close notes"
            className="icon-button"
            onClick={close}
          >
            <X size={20} />
          </button>
        </div>
        <h2 id="note-title">{item.name}</h2>
        <label htmlFor="personal-note">Your personal note</label>
        <textarea
          id="personal-note"
          name="note"
          maxLength={500}
          defaultValue={notes[item.id] ?? ""}
          placeholder="What does this moment make you think of?"
          rows={5}
          autoFocus
        />
        <p className="fine-print">
          Concept preview · Saved for this browser session only. The Flutter app
          does not yet include a note editor.
        </p>
        <button className="button button-pink" type="submit">
          <Check size={16} /> Save note
        </button>
      </form>
    </dialog>
  );
}

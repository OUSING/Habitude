import { useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { CheckSquare, Folder, MoreVertical, Pin, Search, Settings, Trash2, ImagePlus, Bold, Italic, Underline, NotebookPen, Share2, Shirt } from "lucide-react";
import { db } from "../services/db";
import { todayStr } from "../utils/date";
import { backupToDrive } from "../services/driveBackup";
import { getSession } from "../services/auth";
import { getThemePreference, resolveTheme, type ThemeMode } from "../services/settings";

interface Props {
  selectedDate: string;
  onSelectDate: (date: string) => void;
}

function prettyDate(date: string) {
  const d = new Date(`${date}T12:00:00`);
  return d.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
}

function prettyTime(timestamp?: number) {
  const d = timestamp ? new Date(timestamp) : new Date();
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export function DailyNotes({ selectedDate, onSelectDate }: Props) {
  const dailyNote = useLiveQuery(() => db.dailyNotes.where("date").equals(selectedDate).first(), [selectedDate]);
  const notes = useLiveQuery(() => db.dailyNotes.orderBy("updatedAt").reverse().limit(30).toArray(), [], []);
  const [note, setNote] = useState("");
  const [title, setTitle] = useState("");
  const [theme, setTheme] = useState<ThemeMode>("crimson");
  const [showSearch, setShowSearch] = useState(false);
  const [query, setQuery] = useState("");
  const [pinned, setPinned] = useState(false);
  const [editing, setEditing] = useState(false);
  const saveTimer = useRef<number | null>(null);
  const driveTimer = useRef<number | null>(null);

  useEffect(() => {
    setNote(dailyNote?.content ?? "");
    setTitle(dailyNote?.title ?? "");
    setPinned(Boolean((dailyNote as any)?.pinned));
  }, [dailyNote?.content, dailyNote?.title, (dailyNote as any)?.pinned, selectedDate]);

  useEffect(() => {
    getThemePreference().then((pref) => setTheme(resolveTheme(pref))).catch(() => {});
  }, []);

  useEffect(() => () => {
    if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    if (driveTimer.current !== null) window.clearTimeout(driveTimer.current);
  }, []);

  async function persist(nextTitle: string, nextContent: string, nextPinned = pinned) {
    const existing = await db.dailyNotes.where("date").equals(selectedDate).first();
    if (!nextTitle.trim() && !nextContent.trim()) {
      if (existing?.id != null) await db.dailyNotes.delete(existing.id);
      return;
    }
    const payload = { title: nextTitle, content: nextContent, updatedAt: Date.now(), pinned: nextPinned } as any;
    if (existing?.id != null) await db.dailyNotes.update(existing.id, payload);
    else await db.dailyNotes.add({ date: selectedDate, ...payload } as any);
    driveTimer.current = window.setTimeout(async () => {
      // interactive: false — this fires automatically while the user is
      // typing a note, so it must never pop up a Google sign-in window. If
      // there's no cached Drive token, it just skips; the debounced
      // Dexie-hook auto-sync (or the user's next manual/interactive sync)
      // will pick the change up once reconnected.
      try { if (await getSession()) await backupToDrive(false); } catch (error) { console.warn("Daily note Drive sync failed:", error); }
    }, 700);
  }

  function save(nextTitle: string, nextContent: string, nextPinned = pinned) {
    setTitle(nextTitle);
    setNote(nextContent);
    if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    if (driveTimer.current !== null) window.clearTimeout(driveTimer.current);
    saveTimer.current = window.setTimeout(() => { void persist(nextTitle, nextContent, nextPinned); }, 350);
  }

  function openNote(date: string) {
    onSelectDate(date);
    setEditing(true);
  }

  function createNote() {
    const d = todayStr();
    onSelectDate(d);
    setTitle("");
    setNote("");
    setPinned(false);
    setEditing(true);
  }

  const filteredNotes = (notes ?? []).filter((n) => `${n.title ?? ""} ${n.content}`.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className={`redmi-notes-screen daily-notes-${theme}`}>
      <header className="redmi-notes-header pt-safe-top">
        <div className="redmi-top-icons">
          <button className="redmi-top-icon active" aria-label="Notes"><NotebookPen size={29} strokeWidth={1.9}/></button>
          <button className="redmi-top-icon" aria-label="Tasks"><CheckSquare size={27} strokeWidth={2.1}/></button>
          <button className="redmi-top-icon" aria-label="Settings"><Settings size={27} strokeWidth={2}/></button>
        </div>
        <div className="redmi-filter-row">
          <button className="redmi-filter active">All</button>
          <button className="redmi-folder-button" aria-label="Folders"><Folder size={28} strokeWidth={1.8}/></button>
          <div className="flex-1" />
          <button className="redmi-small-action" aria-label="Search" onClick={() => setShowSearch(v => !v)}><Search size={21}/></button>
          <button className="redmi-small-action" aria-label="More"><MoreVertical size={21}/></button>
        </div>
        {showSearch && <div className="redmi-search-wrap"><Search size={18}/><input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search notes"/><button onClick={() => setQuery("")}>×</button></div>}
      </header>

      <main className="redmi-notes-list scroll-area">
        {filteredNotes.length === 0 && (
          <div className="redmi-empty"><div className="redmi-empty-icon">✎</div><strong>No notes yet</strong><span>Tap + to write your first note</span></div>
        )}
        {filteredNotes.map((n) => (
          <button key={n.id} className={`redmi-note-card ${n.date === selectedDate ? "selected" : ""}`} onClick={() => openNote(n.date)}>
            <div className="redmi-note-preview">{n.content?.trim() || n.title?.trim() || "Untitled note"}</div>
            {n.title?.trim() && n.content?.trim() && <div className="redmi-note-secondary">{n.title.trim()}</div>}
            <div className="redmi-note-date">{prettyDate(n.date)}</div>
            {(n as any).pinned && <Pin className="redmi-card-pin" size={15}/>} 
          </button>
        ))}
      </main>

      <button className="redmi-fab" aria-label="New note" onClick={createNote}>+</button>

      {editing && (
        <div className={`redmi-editor-overlay daily-notes-${theme}`}>
          <header className="redmi-editor-header pt-safe-top">
            <button className="redmi-editor-back" onClick={() => { void persist(title, note, pinned); setEditing(false); }} aria-label="Back">
              <span aria-hidden="true">‹</span>
            </button>
            <div className="flex-1" />
            <button className="redmi-editor-top-action" aria-label="Share" onClick={() => {
              const text = [title.trim(), note.trim()].filter(Boolean).join("\n\n");
              if (navigator.share) { void navigator.share({ title: title.trim() || "Daily note", text }); }
            }}>
              <Share2 size={23} strokeWidth={1.9} />
            </button>
            <button className="redmi-editor-top-action" aria-label="Note appearance">
              <Shirt size={24} strokeWidth={1.9} />
            </button>
            <button className="redmi-editor-top-action" aria-label="More options">
              <MoreVertical size={24} strokeWidth={2} />
            </button>
          </header>

          <input
            value={title}
            onChange={(e) => save(e.target.value, note)}
            placeholder="Title"
            className="redmi-editor-title"
            maxLength={120}
            aria-label="Note title"
          />

          <div className="redmi-editor-meta">
            <span>{prettyDate(selectedDate)}</span>
            <span>{prettyTime((dailyNote as any)?.updatedAt)}</span>
            <span>|</span>
            <span>{note.length} characters</span>
          </div>

          <textarea
            autoFocus
            value={note}
            onChange={(e) => save(title, e.target.value)}
            onBlur={() => save(title, note)}
            placeholder="Start writing..."
            maxLength={5000}
            className="redmi-editor-textarea"
            aria-label="Daily note"
          />

          <div className="redmi-editor-footer">
            <div className="redmi-editor-tools">
              <button aria-label="Bold"><Bold size={19}/></button>
              <button aria-label="Italic"><Italic size={19}/></button>
              <button aria-label="Underline"><Underline size={19}/></button>
              <button aria-label="Checklist"><CheckSquare size={19}/></button>
              <button aria-label="Image"><ImagePlus size={19}/></button>
            </div>
            <button className="redmi-editor-delete" aria-label="Delete note" onClick={async () => {
              if (dailyNote?.id != null) await db.dailyNotes.delete(dailyNote.id);
              setTitle("");
              setNote("");
              setEditing(false);
            }}>
              <Trash2 size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

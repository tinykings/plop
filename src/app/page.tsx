'use client';

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { format, isThisYear } from 'date-fns';
import { useNotes } from '@/context/NoteContext';
import { useSettings } from '@/context/SettingsContext';
import { useServiceWorker } from '@/hooks/useServiceWorker';
import { Note, NoteEntry } from '@/types/note';
import { searchNoteContents } from '@/services/githubSync';
import NoteEditor from '@/components/NoteEditor';
import SettingsModal from '@/components/SettingsModal';

function formatNoteDate(iso: string): string {
  const d = new Date(iso);
  if (d.getTime() === 0) return ''; // unknown date fallback
  return isThisYear(d) ? format(d, 'MMM d') : format(d, 'MMM d, yyyy');
}

export default function HomePage() {
  useServiceWorker();
  const { notes, isLoaded, isRepoConfigured, fetchNoteContent, saveNote, createNote, deleteNote } = useNotes();
  const { isRepoConfigured: configured, repoSettings } = useSettings();

  const [isMounted, setIsMounted] = useState(false);
  const [activeNote, setActiveNote] = useState<Note | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [isOpening, setIsOpening] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [contentMatchTitles, setContentMatchTitles] = useState<Set<string>>(new Set());
  const [isContentSearching, setIsContentSearching] = useState(false);
  const contentSearchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Defer rendering until client has read localStorage, preventing hydration mismatch
  useEffect(() => {
    setIsMounted(true);
    if (!configured) setIsSettingsOpen(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const searchInputRef = useCallback((node: HTMLInputElement | null) => {
    if (node) node.focus();
  }, []);

  // Debounced GitHub content search — fires 500ms after the user stops typing
  useEffect(() => {
    if (contentSearchTimeoutRef.current) clearTimeout(contentSearchTimeoutRef.current);
    if (!searchQuery.trim()) {
      setContentMatchTitles(new Set());
      setIsContentSearching(false);
      return;
    }
    setIsContentSearching(true);
    contentSearchTimeoutRef.current = setTimeout(async () => {
      try {
        const titles = await searchNoteContents(searchQuery.trim(), repoSettings);
        setContentMatchTitles(new Set(titles));
      } catch {
        // Silently ignore (e.g. rate limit) — title search still works
      } finally {
        setIsContentSearching(false);
      }
    }, 500);
    return () => {
      if (contentSearchTimeoutRef.current) clearTimeout(contentSearchTimeoutRef.current);
    };
  }, [searchQuery, repoSettings]);

  const filteredNotes = useMemo(() => {
    if (!searchQuery.trim()) return notes;
    const q = searchQuery.toLowerCase();
    const titleMatches = notes.filter((n) => n.title.toLowerCase().includes(q));
    const titleMatchSet = new Set(titleMatches.map((n) => n.title));
    // Append content-only matches after title matches
    const contentOnlyMatches = notes.filter(
      (n) => contentMatchTitles.has(n.title) && !titleMatchSet.has(n.title)
    );
    return [...titleMatches, ...contentOnlyMatches];
  }, [notes, searchQuery, contentMatchTitles]);

  const handleOpenNote = useCallback(async (entry: NoteEntry) => {
    if (isOpening) return;
    setIsOpening(true);
    try {
      // Show editor immediately with title; content loads asynchronously
      const placeholder: Note = { ...entry, content: '', sha: '' };
      setActiveNote(placeholder);
      const full = await fetchNoteContent(entry.title);
      setActiveNote(full);
    } catch (err) {
      console.error('Failed to open note:', err);
      setActiveNote(null);
    } finally {
      setIsOpening(false);
    }
  }, [fetchNoteContent, isOpening]);

  const handleNewNote = useCallback(() => {
    setActiveNote(createNote());
  }, [createNote]);

  // Keyboard shortcut: N to create new note (only in list view)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'n' && !activeNote && !isSettingsOpen && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        handleNewNote();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeNote, isSettingsOpen, handleNewNote]);

  const handleBack = useCallback(() => {
    setActiveNote(null);
    setConfirmDelete(false);
  }, []);

  const handleSave = useCallback(async (note: Note, originalTitle: string) => {
    await saveNote(note, originalTitle);
    setActiveNote((prev) =>
      prev && (prev.title === note.title || prev.title === originalTitle)
        ? { ...prev, title: note.title, content: note.content }
        : prev
    );
  }, [saveNote]);

  const handleDeleteConfirm = useCallback(async () => {
    if (!activeNote) return;
    try {
      await deleteNote(activeNote.title, activeNote.sha);
    } catch (err) {
      console.error('Failed to delete note:', err);
    }
    setActiveNote(null);
    setConfirmDelete(false);
  }, [activeNote, deleteNote]);

  // Render nothing until client has mounted (avoids SSR/localStorage hydration mismatch)
  if (!isMounted) return <div style={{ minHeight: '100vh', background: 'var(--background)' }} />;

  // ── Note editor view ────────────────────────────────────────────────────
  if (activeNote) {
    return (
      <>
        <NoteEditor
          note={activeNote}
          onBack={handleBack}
          onSave={handleSave}
          onDelete={() => setConfirmDelete(true)}
        />

        {confirmDelete && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 200 }}>
            <div
              onClick={() => setConfirmDelete(false)}
              style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
            />
            <div style={{
              position: 'absolute',
              left: 20, right: 20, top: '50%',
              transform: 'translateY(-50%)',
              maxWidth: 380, margin: '0 auto',
              background: 'var(--card)',
              border: '1px solid var(--border)',
              boxShadow: '12px 12px 0 rgba(0,0,0,0.2)',
            }}>
              <div style={{ padding: 24 }}>
                <h3 style={{ fontSize: 20, fontWeight: 600, margin: '0 0 12px', fontFamily: 'var(--font-display)' }}>
                  Delete note?
                </h3>
                <p style={{ fontSize: 15, color: 'var(--muted)', margin: 0, lineHeight: 1.5 }}>
                  &ldquo;{activeNote.title || 'Untitled'}&rdquo; will be permanently deleted from GitHub.
                </p>
              </div>
              <div style={{ display: 'flex', gap: 12, padding: '16px 24px', background: 'var(--background)', borderTop: '1px solid var(--border)' }}>
                <button
                  onClick={() => setConfirmDelete(false)}
                  style={{ flex: 1, padding: '12px 20px', fontSize: 16, fontWeight: 500, color: 'var(--muted)', background: 'var(--card)', border: '1px solid var(--border)', cursor: 'pointer', minHeight: 48, borderRadius: 0 }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteConfirm}
                  style={{ flex: 1, padding: '12px 20px', fontSize: 16, fontWeight: 500, color: 'var(--background)', background: 'var(--red)', border: 'none', cursor: 'pointer', minHeight: 48, borderRadius: 0 }}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  // ── List view ───────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: 'var(--background)', transition: 'background 0.2s' }}>

      {/* Search header */}
      {isSearchExpanded && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 20,
          background: 'var(--background)',
          padding: '16px 24px',
          borderBottom: '2px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search notes…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') { setSearchQuery(''); setIsSearchExpanded(false); }
              }}
              style={{
                width: '100%',
                padding: '10px 12px 10px 40px',
                fontSize: 16,
                background: 'var(--card)',
                border: '1px solid var(--accent)',
                borderRadius: 0,
                color: 'var(--foreground)',
                outline: 'none',
                boxShadow: '4px 4px 0 var(--accent-light)',
                height: 44,
              }}
            />
            <svg width="18" height="18" fill="none" stroke="var(--muted)" strokeWidth="2" viewBox="0 0 24 24"
              style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
              <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
            </svg>
          </div>
          {isContentSearching && (
            <span style={{ fontSize: 13, color: 'var(--muted)', whiteSpace: 'nowrap', fontStyle: 'italic' }}>
              searching…
            </span>
          )}
          <button
            onClick={() => { setSearchQuery(''); setIsSearchExpanded(false); }}
            style={{ fontSize: 15, color: 'var(--accent)', background: 'none', border: '1px solid var(--accent)', cursor: 'pointer', padding: '0 16px', fontWeight: 500, height: 44, borderRadius: 0 }}
          >
            Cancel
          </button>
        </div>
      )}

      <main style={{ padding: isSearchExpanded ? '88px 24px 100px' : '24px 24px 100px' }}>

        {/* Not configured */}
        {!isRepoConfigured && isLoaded && (
          <div style={{ textAlign: 'center', padding: '80px 0' }}>
            <div style={{ width: 100, height: 100, background: 'var(--accent-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
              <svg width="48" height="48" fill="none" stroke="var(--accent)" strokeWidth="1.5" viewBox="0 0 24 24">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="12" y1="18" x2="12" y2="12"/>
                <line x1="9" y1="15" x2="15" y2="15"/>
              </svg>
            </div>
            <h3 style={{ fontSize: 22, fontWeight: 600, marginBottom: 8, fontFamily: 'var(--font-display)' }}>Set up GitHub storage</h3>
            <p style={{ color: 'var(--muted)', fontSize: 16, marginBottom: 24, lineHeight: 1.5 }}>
              Notes are saved as .txt files in a GitHub repo.<br/>Configure your repo to get started.
            </p>
            <button
              onClick={() => setIsSettingsOpen(true)}
              style={{ padding: '14px 28px', fontSize: 16, fontWeight: 600, background: 'var(--accent)', color: 'var(--background)', border: 'none', cursor: 'pointer', borderRadius: 0 }}
            >
              Open Settings
            </button>
          </div>
        )}

        {/* Loading */}
        {isRepoConfigured && !isLoaded && (
          <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--muted)' }}>Loading notes…</div>
        )}

        {/* Empty */}
        {isRepoConfigured && isLoaded && filteredNotes.length === 0 && (
          <div style={{ textAlign: 'center', padding: '80px 0' }}>
            <div style={{ width: 100, height: 100, background: 'var(--accent-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
              <svg width="48" height="48" fill="none" stroke="var(--accent)" strokeWidth="1.5" viewBox="0 0 24 24">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
              </svg>
            </div>
            <h3 style={{ fontSize: 22, fontWeight: 600, marginBottom: 8, fontFamily: 'var(--font-display)' }}>
              {searchQuery ? 'No results' : 'No notes yet'}
            </h3>
            <p style={{ color: 'var(--muted)', fontSize: 16 }}>
              {searchQuery ? `No notes match "${searchQuery}"` : 'Tap + to create your first note.'}
            </p>
          </div>
        )}

        {/* Notes list */}
        {isRepoConfigured && isLoaded && filteredNotes.length > 0 && (
          <div style={{ borderTop: '2px solid var(--border)' }}>
            {filteredNotes.map((entry, index) => (
              <NoteListItem
                key={entry.title}
                entry={entry}
                index={index}
                onClick={() => handleOpenNote(entry)}
              />
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 10,
        background: 'var(--background)',
        padding: '16px 24px 24px',
        transition: 'background 0.2s',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        borderTop: '2px solid var(--border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => setIsSettingsOpen(true)}
            aria-label="Settings"
            style={{
              width: 44, height: 44,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--muted)', background: 'none',
              border: '1px solid var(--border)', cursor: 'pointer',
              position: 'relative', padding: 0, borderRadius: 0,
            }}
          >
            <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
            {isRepoConfigured && (
              <div style={{ position: 'absolute', top: 6, right: 6, width: 6, height: 6, background: 'var(--green)' }} />
            )}
          </button>

          <button
            onClick={() => setIsSearchExpanded(true)}
            aria-label="Search notes"
            style={{
              width: 44, height: 44,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: searchQuery ? 'var(--accent)' : 'var(--muted)',
              background: 'none',
              border: searchQuery ? '1px solid var(--accent)' : '1px solid var(--border)',
              cursor: 'pointer', borderRadius: 0,
            }}
          >
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
            </svg>
          </button>
        </div>

        <button
          onClick={handleNewNote}
          aria-label="New note"
          style={{
            width: 44, height: 44,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--background)', background: 'var(--foreground)',
            border: 'none', borderRadius: 0,
            cursor: 'pointer', flexShrink: 0,
            transition: 'transform 0.2s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.transform = 'translate(-2px,-2px)')}
          onMouseLeave={(e) => (e.currentTarget.style.transform = 'translate(0,0)')}
        >
          <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path d="M12 5v14M5 12h14"/>
          </svg>
        </button>
      </footer>

      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </div>
  );
}

function NoteListItem({
  entry,
  index,
  onClick,
}: {
  entry: NoteEntry;
  index: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        padding: '16px 0',
        background: 'transparent',
        border: 'none',
        borderBottom: '1px solid var(--border)',
        width: '100%',
        textAlign: 'left',
        cursor: 'pointer',
        animation: 'fadeIn 0.4s cubic-bezier(0.16,1,0.3,1) forwards',
        opacity: 0,
        animationDelay: `${index * 30}ms`,
      }}
    >
      <span style={{
        fontSize: 18,
        color: entry.title ? 'var(--foreground)' : 'var(--muted)',
        fontStyle: entry.title ? 'normal' : 'italic',
        flex: 1,
        minWidth: 0,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>
        {entry.title || 'Untitled'}
      </span>
      <span style={{ fontSize: 13, color: 'var(--muted)', flexShrink: 0, whiteSpace: 'nowrap' }}>
        {formatNoteDate(entry.updatedAt)}
      </span>
    </button>
  );
}

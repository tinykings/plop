'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Note } from '@/types/note';

interface NoteEditorProps {
  note: Note;
  onBack: () => void;
  /** onSave receives the current note and the original title (for rename detection) */
  onSave: (note: Note, originalTitle: string) => Promise<void>;
  onDelete: () => void;
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export default function NoteEditor({ note, onBack, onSave, onDelete }: NoteEditorProps) {
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const isContentLoading = note.sha === '' && note.content === '' && note.title !== '';

  // Track the "saved" title so renames work correctly across multiple saves
  const savedTitleRef = useRef(note.title);

  // Refs for latest values — used inside debounce callbacks
  const titleRef = useRef(title);
  const contentRef = useRef(content);
  const onSaveRef = useRef(onSave);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const savedStatusTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isSavingRef = useRef(false);
  const isDirtyRef = useRef(false);
  // Only allow the one-time async content load to overwrite local state
  const asyncLoadDoneRef = useRef(note.sha !== '');

  useEffect(() => { titleRef.current = title; }, [title]);
  useEffect(() => { contentRef.current = content; }, [content]);
  useEffect(() => { onSaveRef.current = onSave; }, [onSave]);

  // Sync content exactly once: when async load completes (sha transitions '' → non-'')
  // Does NOT fire after saves, preventing the race where a save overwrites in-progress typing.
  useEffect(() => {
    if (!asyncLoadDoneRef.current && note.sha !== '') {
      asyncLoadDoneRef.current = true;
      if (!isDirtyRef.current) {
        setTitle(note.title);
        setContent(note.content);
      }
    }
  }, [note.sha, note.content, note.title]);

  const executeSave = useCallback(async (force = false) => {
    if (isSavingRef.current) return;
    const t = titleRef.current.trim();
    const c = contentRef.current;

    // For a new (unsaved) note, wait until there's body content before auto-saving.
    // Exception: force=true (used when navigating back) saves with just a title too.
    if (!force && note.sha === '' && !c.trim()) return;

    // Skip if there's truly nothing to save
    if (!t && !c.trim()) return;

    // Use "Untitled" if title is empty
    const finalTitle = t || 'Untitled';
    titleRef.current = finalTitle;
    if (titleRef.current !== title) setTitle(finalTitle);

    isSavingRef.current = true;
    setSaveStatus('saving');

    try {
      const originalTitle = savedTitleRef.current;
      await onSaveRef.current(
        { ...note, title: finalTitle, content: c },
        originalTitle
      );
      // After save, the "original title" for the next rename check is the new title
      savedTitleRef.current = finalTitle;
      isDirtyRef.current = false;
      setSaveStatus('saved');
      if (savedStatusTimeoutRef.current) clearTimeout(savedStatusTimeoutRef.current);
      savedStatusTimeoutRef.current = setTimeout(() => setSaveStatus('idle'), 2500);
    } catch (err) {
      console.error('Save failed:', err);
      setSaveStatus('error');
    } finally {
      isSavingRef.current = false;
    }
  }, [note, title]);

  const scheduleSave = useCallback(() => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(executeSave, 2000);
  }, [executeSave]);

  const handleTitleChange = (value: string) => {
    setTitle(value);
    isDirtyRef.current = true;
    scheduleSave();
  };

  const handleContentChange = (value: string) => {
    setContent(value);
    isDirtyRef.current = true;
    scheduleSave();
  };

  const handleBack = async () => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    // force=true: save even a title-only note when the user navigates back
    if (isDirtyRef.current) await executeSave(true);
    onBack();
  };

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      if (savedStatusTimeoutRef.current) clearTimeout(savedStatusTimeoutRef.current);
    };
  }, []);

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'var(--background)',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 50,
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '16px 24px',
        borderBottom: '2px solid var(--border)',
        flexShrink: 0,
      }}>
        <button
          onClick={handleBack}
          style={{
            width: 44, height: 44,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'none',
            border: '1px solid var(--border)',
            cursor: 'pointer',
            color: 'var(--foreground)',
            flexShrink: 0,
            borderRadius: 0,
          }}
          aria-label="Back"
        >
          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
        </button>

        {/* Save status */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
          {saveStatus === 'saving' && (
            <span style={{ fontSize: 13, color: 'var(--muted)', fontStyle: 'italic' }}>Saving…</span>
          )}
          {saveStatus === 'saved' && (
            <span style={{ fontSize: 13, color: 'var(--green)' }}>Saved</span>
          )}
          {saveStatus === 'error' && (
            <span style={{ fontSize: 13, color: 'var(--red)' }}>
              Save failed —{' '}
              <button
                onClick={() => executeSave()}
                style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', textDecoration: 'underline', fontSize: 13, padding: 0 }}
              >
                retry
              </button>
            </span>
          )}
        </div>

        {/* Delete */}
        {note.sha !== '' && (
          <button
            onClick={onDelete}
            style={{
              width: 44, height: 44,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'none',
              border: '1px solid var(--border)',
              cursor: 'pointer',
              color: 'var(--muted)',
              flexShrink: 0,
              borderRadius: 0,
            }}
            aria-label="Delete note"
          >
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
              <path d="M10 11v6M14 11v6M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
            </svg>
          </button>
        )}
      </div>
      <div style={{ padding: '20px 24px 0', flexShrink: 0 }}>
        <input
          type="text"
          placeholder="Untitled"
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          autoFocus={note.sha === ''}
          style={{
            width: '100%',
            fontSize: 26,
            fontWeight: 700,
            fontFamily: 'var(--font-display)',
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: 'var(--foreground)',
            padding: 0,
          }}
        />
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: '12px 24px 24px', overflow: 'hidden' }}>
        {isContentLoading ? (
          <div style={{ color: 'var(--muted)', fontSize: 16, paddingTop: 8 }}>Loading…</div>
        ) : (
          <textarea
            placeholder="Start writing…"
            value={content}
            onChange={(e) => handleContentChange(e.target.value)}
            style={{
              width: '100%',
              height: '100%',
              fontSize: 16,
              lineHeight: 1.7,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              resize: 'none',
              color: 'var(--foreground)',
              padding: 0,
              fontFamily: 'var(--font-body), sans-serif',
            }}
          />
        )}
      </div>
    </div>
  );
}

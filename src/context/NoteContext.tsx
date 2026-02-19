'use client';

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
} from 'react';
import { NoteEntry, Note } from '@/types/note';
import { useSettings } from '@/context/SettingsContext';
import {
  listNotes,
  fetchNoteDates,
  loadNoteFile,
  saveNoteFile,
  deleteNoteFile,
  renameNoteFile,
} from '@/services/githubSync';

interface NoteContextType {
  notes: NoteEntry[];
  isLoaded: boolean;
  isRepoConfigured: boolean;
  fetchNoteContent: (title: string) => Promise<Note>;
  saveNote: (note: Note, originalTitle: string) => Promise<void>;
  createNote: () => Note;
  deleteNote: (title: string, sha: string) => Promise<void>;
  refreshNotes: () => Promise<void>;
}

const NoteContext = createContext<NoteContextType | undefined>(undefined);

export function NoteProvider({ children }: { children: React.ReactNode }) {
  const [notes, setNotes] = useState<NoteEntry[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const { repoSettings, isRepoConfigured } = useSettings();

  // Ref to always access latest notes without stale closures
  const notesRef = useRef<NoteEntry[]>([]);
  notesRef.current = notes;

  // Per-note SHA cache (blob SHA from Contents API)
  const noteShasRef = useRef<Record<string, string>>({});

  // Simple mutex to prevent overlapping saves
  const isSavingRef = useRef(false);

  const loadNotes = useCallback(async () => {
    if (!isRepoConfigured) {
      setIsLoaded(true);
      return;
    }
    try {
      const entries = await listNotes(repoSettings);
      for (const e of entries) noteShasRef.current[e.title] = e.sha;
      setNotes(entries);
      setIsLoaded(true);

      const items = entries.map((e) => ({ name: `${e.title}.txt` }));
      const dates = await fetchNoteDates(items, repoSettings);
      setNotes((prev) => {
        const updated = prev.map((n) => ({
          ...n,
          updatedAt: dates[n.title] || n.updatedAt,
        }));
        return updated.sort(
          (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
      });
    } catch (err) {
      console.error('Failed to load notes:', err);
      setIsLoaded(true);
    }
  }, [isRepoConfigured, repoSettings]);

  useEffect(() => {
    setIsLoaded(false);
    setNotes([]);
    noteShasRef.current = {};
    loadNotes();
  }, [loadNotes]);

  const fetchNoteContent = useCallback(
    async (title: string): Promise<Note> => {
      const entry = notesRef.current.find((n) => n.title === title);
      const { content, sha } = await loadNoteFile(title, repoSettings);
      noteShasRef.current[title] = sha;
      return {
        title,
        sha,
        content,
        updatedAt: entry?.updatedAt ?? new Date().toISOString(),
      };
    },
    [repoSettings]
  );

  const saveNote = useCallback(
    async (note: Note, originalTitle: string): Promise<void> => {
      if (isSavingRef.current) throw new Error('Save in progress');
      isSavingRef.current = true;

      try {
        const currentSha = noteShasRef.current[originalTitle] || '';
        let newSha: string;

        if (note.title !== originalTitle && originalTitle !== '') {
          // Title changed → rename (create new file + delete old)
          newSha = await renameNoteFile(
            originalTitle,
            note.title,
            note.content,
            currentSha,
            repoSettings
          );
          delete noteShasRef.current[originalTitle];
        } else {
          // Same title → create or update
          newSha = await saveNoteFile(note.title, note.content, currentSha, repoSettings);
        }

        noteShasRef.current[note.title] = newSha;

        const updatedAt = new Date().toISOString();
        const updatedEntry: NoteEntry = { title: note.title, sha: newSha, updatedAt };

        const current = notesRef.current;
        const withoutOld = current.filter(
          (n) => n.title !== originalTitle && n.title !== note.title
        );
        const newNotes = [updatedEntry, ...withoutOld].sort(
          (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );

        setNotes(newNotes);
      } finally {
        isSavingRef.current = false;
      }
    },
    [repoSettings]
  );

  /** Returns an unsaved in-memory note. */
  const createNote = useCallback((): Note => {
    const now = new Date().toISOString();
    return { title: '', content: '', sha: '', updatedAt: now };
  }, []);

  const deleteNote = useCallback(
    async (title: string, sha: string): Promise<void> => {
      const fileSha = noteShasRef.current[title] || sha;
      if (fileSha) {
        await deleteNoteFile(title, fileSha, repoSettings);
        delete noteShasRef.current[title];
      }
      setNotes((prev) => prev.filter((n) => n.title !== title));
    },
    [repoSettings]
  );

  const refreshNotes = useCallback(async () => {
    if (!isRepoConfigured) return;
    const entries = await listNotes(repoSettings);
    for (const e of entries) noteShasRef.current[e.title] = e.sha;
    const items = entries.map((e) => ({ name: `${e.title}.txt` }));
    const dates = await fetchNoteDates(items, repoSettings);
    const sorted = entries
      .map((n) => ({ ...n, updatedAt: dates[n.title] || n.updatedAt }))
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    setNotes(sorted);
  }, [isRepoConfigured, repoSettings]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshNotes();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [refreshNotes]);

  return (
    <NoteContext.Provider
      value={{
        notes,
        isLoaded,
        isRepoConfigured,
        fetchNoteContent,
        saveNote,
        createNote,
        deleteNote,
        refreshNotes,
      }}
    >
      {children}
    </NoteContext.Provider>
  );
}

export function useNotes() {
  const context = useContext(NoteContext);
  if (!context) throw new Error('useNotes must be used within NoteProvider');
  return context;
}

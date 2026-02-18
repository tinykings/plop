export interface NoteEntry {
  title: string;     // filename without .txt — acts as the note's identity
  updatedAt: string; // ISO string from last commit date
  sha: string;       // GitHub blob SHA, required for PUT/DELETE
}

export interface Note extends NoteEntry {
  content: string;
}

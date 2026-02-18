import { NoteEntry } from '@/types/note';

const API_BASE = 'https://api.github.com';

export interface RepoSettings {
  owner: string;
  repo: string;
  token: string;
}

interface GithubContentsItem {
  name: string;
  path: string;
  sha: string;
  size: number;
  type: 'file' | 'dir' | 'symlink' | 'submodule';
  content?: string;
}

interface GithubFileResponse extends GithubContentsItem {
  content: string; // base64, newline-wrapped
}

interface GithubPutResponse {
  content: { sha: string };
}

interface GithubCommit {
  commit: { committer: { date: string } };
}

function encodeContent(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function decodeContent(base64: string): string {
  const clean = base64.replace(/\n/g, '');
  const binary = atob(clean);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

async function apiRequest<T = unknown>(
  path: string,
  method: string,
  token: string,
  body?: object
): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    let message = `GitHub API ${response.status}: ${response.statusText}`;
    try {
      const parsed = JSON.parse(errorText);
      if (parsed.message) message += ` — ${parsed.message}`;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  return response.json();
}

// Encode title to a safe filename path segment
function titleToPath(title: string): string {
  // Replace any path separators to be safe
  return encodeURIComponent(title.replace(/\//g, '-')) + '.txt';
}

// ── List notes from repo root ─────────────────────────────────────────────

export async function listNotes(settings: RepoSettings): Promise<NoteEntry[]> {
  const items = await apiRequest<GithubContentsItem[]>(
    `/repos/${settings.owner}/${settings.repo}/contents/`,
    'GET',
    settings.token
  );

  const txtFiles = items.filter((f) => f.type === 'file' && f.name.endsWith('.txt'));

  if (txtFiles.length === 0) return [];

  // Fetch last-commit date for each file in parallel
  const entries = await Promise.all(
    txtFiles.map(async (file): Promise<NoteEntry> => {
      const title = file.name.slice(0, -4); // strip .txt
      let updatedAt = new Date(0).toISOString();
      try {
        const commits = await apiRequest<GithubCommit[]>(
          `/repos/${settings.owner}/${settings.repo}/commits?path=${encodeURIComponent(file.name)}&per_page=1`,
          'GET',
          settings.token
        );
        if (commits.length > 0) {
          updatedAt = commits[0].commit.committer.date;
        }
      } catch {
        // Use epoch as fallback so the note still appears
      }
      return { title, sha: file.sha, updatedAt };
    })
  );

  return entries.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

// ── Load a single note's content ──────────────────────────────────────────

export async function loadNoteFile(
  title: string,
  settings: RepoSettings
): Promise<{ content: string; sha: string }> {
  const data = await apiRequest<GithubFileResponse>(
    `/repos/${settings.owner}/${settings.repo}/contents/${titleToPath(title)}`,
    'GET',
    settings.token
  );
  return { content: decodeContent(data.content), sha: data.sha };
}

// ── Save (create or update) a note ───────────────────────────────────────

export async function saveNoteFile(
  title: string,
  content: string,
  sha: string, // pass '' to create a new file
  settings: RepoSettings
): Promise<string> {
  const body: Record<string, unknown> = {
    message: sha ? `Update: ${title}` : `Create: ${title}`,
    content: encodeContent(content),
  };
  if (sha) body.sha = sha;

  const data = await apiRequest<GithubPutResponse>(
    `/repos/${settings.owner}/${settings.repo}/contents/${titleToPath(title)}`,
    'PUT',
    settings.token,
    body
  );
  return data.content.sha;
}

// ── Delete a note ─────────────────────────────────────────────────────────

export async function deleteNoteFile(
  title: string,
  sha: string,
  settings: RepoSettings
): Promise<void> {
  await apiRequest(
    `/repos/${settings.owner}/${settings.repo}/contents/${titleToPath(title)}`,
    'DELETE',
    settings.token,
    { message: `Delete: ${title}`, sha }
  );
}

// ── Rename a note (create new + delete old) ───────────────────────────────

export async function renameNoteFile(
  oldTitle: string,
  newTitle: string,
  content: string,
  oldSha: string,
  settings: RepoSettings
): Promise<string> {
  // Create new file first (safer: we don't lose content if delete fails)
  const newSha = await saveNoteFile(newTitle, content, '', settings);
  // Delete old file
  await deleteNoteFile(oldTitle, oldSha, settings);
  return newSha;
}

// ── Content search via GitHub code search API ─────────────────────────────

export async function searchNoteContents(
  query: string,
  settings: RepoSettings
): Promise<string[]> {
  // Returns titles (filenames without .txt) of notes whose content matches
  const data = await apiRequest<{ items: Array<{ name: string }> }>(
    `/search/code?q=${encodeURIComponent(query)}+repo:${settings.owner}/${settings.repo}+extension:txt+in:file`,
    'GET',
    settings.token
  );
  return data.items
    .filter((item) => item.name.endsWith('.txt'))
    .map((item) => item.name.slice(0, -4));
}

// ── Connection test ───────────────────────────────────────────────────────

export async function testConnection(settings: RepoSettings): Promise<void> {
  await apiRequest(
    `/repos/${settings.owner}/${settings.repo}`,
    'GET',
    settings.token
  );
}

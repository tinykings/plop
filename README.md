<p align="center">
<img src="public/icon-192.png" alt="Plop Logo" width="120" />
</p>

<h1 align="center">plop</h1>

<h3 align="center">A minimal note-taking PWA backed by GitHub.</h3>
<h4 align="center">https://tinykings.github.io/plop/</h4>

---

## What it is

Plop is a lightweight, installable note-taking app that stores your notes as plain `.txt` files in a GitHub repository you own. There's no database, no backend, no account — just your GitHub repo as a simple file store.

## Features

- **GitHub storage** — notes are saved, updated, and deleted via the GitHub Contents API
- **Full-text search** — searches note titles instantly and note contents via the GitHub code search API (with debounce)
- **Autosave** — saves 2 seconds after you stop typing; handles renames transparently
- **PWA** — installable on mobile and desktop, with a service worker for offline shell caching
- **Dark / light theme** — respects system preference
- **Keyboard shortcuts** — `N` to create a new note from the list view

## Tech stack

- [Next.js](https://nextjs.org/) (App Router, static export)
- TypeScript
- Tailwind CSS
- date-fns
- GitHub REST API

## Getting started

1. **Clone and install**
   ```bash
   git clone https://github.com/tinykings/plop
   cd plop
   npm install
   npm run dev
   ```

2. **Configure your GitHub repo**
   - Create a GitHub repo to store your notes (can be private)
   - Generate a [fine-grained personal access token](https://github.com/settings/tokens) with **Contents** read/write permission for that repo
   - Open the app, tap the settings icon, and enter your repo owner, repo name, and token

Notes are stored as `<title>.txt` files in the root of the configured repo.

## Deployment

The app is deployed as a static site via GitHub Pages. See [`DEPLOY.md`](DEPLOY.md) for details.

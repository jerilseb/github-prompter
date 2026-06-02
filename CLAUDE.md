# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

GitHub Prompter is a Chrome extension (Manifest V3) that lets you browse any GitHub repository's file tree from the toolbar popup, select files, and copy their contents to the clipboard as LLM-ready Markdown. There is no build step, no framework, and no dependencies — it is plain ES modules, HTML, and CSS loaded directly by Chrome.

## Development workflow

There is no build, bundler, lint, or test tooling. To develop:

1. Open `chrome://extensions/`
2. Enable Developer mode
3. "Load unpacked" → select the project root
4. After editing files, click the reload icon on the extension card. Reload the popup/options page to pick up changes.

Because there are no automated checks, verify changes by exercising the popup against a real GitHub repo URL. The popup only activates on `https://github.com/owner/repo` URLs (optionally `/tree/<branch>/<subdir>`); the URL is parsed in `popup.js`.

When bumping the released version, update `version` in `manifest.json`.

## Architecture

The extension has two independent UI surfaces, each a standalone HTML page with its own script. There is **no background/service worker** — all logic runs in the popup or options page.

### Popup (the main surface)
`popup.html` → `popup.js` (entry, ES module) orchestrates everything:
- Parses the active tab's GitHub URL (owner / repo / branch / optional subdirectory) via regex.
- `github-api.js` — all GitHub REST calls. Reads the optional PAT from `chrome.storage.sync` and attaches it as an `Authorization` header. Centralizes error handling in `handleApiResponse` (403 → rate-limit message, 404 → private-repo message). `fetchFileContent` decodes base64 inline content and falls back to `download_url` for larger files.
- `popup.js > buildTree()` converts GitHub's flat `git/trees?recursive=1` response into a nested tree structure, then drills into the subdirectory if the URL pointed inside one.
- `tree.js` — a **self-contained, dependency-free tree-view widget** (default-exported `Tree` class). It renders a checkbox tree with tri-state checkboxes (status `0`/`1`/`2` = unchecked/half-checked/checked) and propagates selection up (`walkUp`) and down (`walkDown`) the hierarchy. `tree.css` styles it. The public surface used by `popup.js` is the constructor `{ data, closeDepth, loaded, onChange }`, the `values` getter/setter (array of selected leaf IDs), and the `selectedNodes` getter. Node IDs are the full repo-relative file paths.
- `ignore-utils.js` — converts a `.gitignore`-style pattern list (from the options page) into RegExps (`globToRegex` / `parseIgnoreFile`) and evaluates them with last-match-wins semantics (`isIgnored`). Ignored files are visually marked and excluded from the copy, not hidden.
- On copy, selected file contents are fetched in parallel, wrapped in `## File: <path>` + fenced code blocks, optionally prefixed with an ASCII file tree (`asciiTree`), and written to the clipboard. Note: inside `.md` files, ``` fences are rewritten to `~~~` to avoid breaking the outer fences.

### Options page
`options.html` → `options.js` manages persisted settings and saved selections. No imports — pure `chrome.storage` manipulation.

### Storage model (important)
Two Chrome storage areas are used with distinct roles:
- `chrome.storage.sync` — user settings: `githubToken` (PAT), `ignorePatterns` (raw text), `includeFileTree` (bool).
- `chrome.storage.local` — per-repo saved selections under keys `selections:<owner>/<repo>` (an array of file path IDs). Written by the "Remember" button in the popup; listed/exported/imported/deleted in the options page. Export/import uses a JSON envelope `{ format: 'github-prompter-selections', version: 1, selections }` and import **merges** rather than replaces.

## Conventions

- Plain ES modules with `import`/`export`; scripts are loaded via `<script type="module">`. No transpilation — only use browser-native syntax targeting `minimum_chrome_version` 120 (manifest).
- The popup style is modern/functional (arrow functions, a single `el` element-cache object, a `state` object). `tree.js` and `options.js` are written in an older class/function style — match the style of the file you are editing.
- Token estimation uses a fixed heuristic of 4 bytes ≈ 1 token (`popup.js`), driven by file `size` from the tree API.
- GitHub API access without a PAT is limited to 60 files/hour; with a PAT, ~5000/hour. Keep this rate limit in mind when changing fetch behavior (e.g., the per-file parallel fetch on copy).

## Note on `.gitignore`

`.gitignore` ignores `*.md` except for an explicit allowlist (`README.md`, `AGENT.md`, and `CLAUDE.md`). If you add a new Markdown doc that should be committed, add a matching `!your-file.md` exception.

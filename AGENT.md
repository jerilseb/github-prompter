# GitHub Prompter - Agent Overview

This document provides a high-level overview of the GitHub Prompter Chrome extension for AI agents and LLMs to understand the project structure, functionality, and components.

## Project Purpose

GitHub Prompter is a Chrome extension that allows users to:
- Browse GitHub repositories and select specific files
- Copy selected files in Markdown format
- Paste the formatted code directly into LLMs like ChatGPT, Claude, or Gemini
- See estimated token count for selected files
- Avoid manual copy-pasting or repository cloning when asking LLMs about code

## Architecture Overview

The extension is built as a standard Chrome extension with manifest v3 and consists of:

1. **Popup Interface**: The main UI that appears when clicking the extension icon
2. **Options Page**: For configuring GitHub tokens and preferences
3. **GitHub API Integration**: For fetching repository data and file contents
4. **File Tree Visualization**: For browsing and selecting files

## File Structure

```
/
├── manifest.json       # Extension configuration
├── popup.html          # Main extension popup UI
├── popup.js            # Popup functionality
├── popup.css           # Popup styling
├── options.html        # Settings page
├── options.js          # Settings functionality
├── options.css         # Settings styling
├── github-api.js       # GitHub API integration
├── ignore-utils.js     # File filtering utilities
├── tree.js             # File tree visualization
├── tree.css            # Tree styling
├── images/             # Extension icons
│   ├── 16.png
│   ├── 32.png
│   ├── 48.png
│   ├── 64.png
│   ├── 128.png
│   └── 256.png
└── LICENSE             # License information
```

## Key Components

### 1. GitHub API Integration (`github-api.js`)

This module handles all interactions with the GitHub API:
- Fetching repository information
- Retrieving file trees
- Getting file contents
- Managing authentication with GitHub tokens
- Handling rate limits and error responses

Key functions:
- `fetchRepoInfo(owner, repo)`: Gets repository metadata
- `fetchRepoTree(owner, repo, branch)`: Gets the file structure
- `fetchFileContent(owner, repo, path, branch)`: Gets the content of a specific file

### 2. Popup Interface (`popup.js`, `popup.html`, `popup.css`)

The main user interface that appears when clicking the extension icon:
- Displays a tree view of repository files
- Allows file selection
- Provides copy functionality
- Shows estimated token count for selected files
- Shows loading states and error messages

Key functions:
- `loadRepository(url)`: Parses the current GitHub URL and loads the repository
- `buildTree(items)`: Converts GitHub API data into a tree structure
- `copySelectedFiles()`: Fetches and formats selected files for copying
- `updateTokenEstimation(validFiles)`: Calculates and displays estimated token count

### 3. File Tree Visualization (`tree.js`, `tree.css`)

Provides an interactive tree view for browsing and selecting files:
- Hierarchical display of directories and files
- Selection capabilities
- Visual indicators for file types

### 4. Ignore Patterns (`ignore-utils.js`)

Handles filtering of files based on gitignore-style patterns:
- Converts glob patterns to regular expressions
- Applies ignore rules to file paths
- Supports negation patterns

Key functions:
- `parseIgnoreFile(raw)`: Parses ignore patterns from text
- `isIgnored(filePath, rules)`: Determines if a file should be ignored

### 5. Options Page (`options.js`, `options.html`, `options.css`)

Allows users to configure:
- GitHub Personal Access Tokens for API authentication
- Ignore patterns for filtering files
- Other preferences like including file tree structure

## Data Flow

1. User navigates to a GitHub repository and clicks the extension icon
2. Extension parses the current URL to identify repository owner, name, and branch
3. Extension fetches repository metadata and file tree from GitHub API
4. File tree is rendered in the popup interface
5. User selects files of interest
6. Extension calculates and displays estimated token count for selected files
7. When "Copy" is clicked, extension fetches content of selected files
8. Files are formatted as Markdown with proper code blocks
9. Formatted content is copied to clipboard for pasting into an LLM

## Key Features

1. **GitHub API Integration**
   - Handles authentication with GitHub tokens
   - Manages rate limits (60 requests/hour unauthenticated, 5000/hour with token)
   - Supports both public and private repositories

2. **File Selection**
   - Interactive tree view for browsing repository structure
   - Multi-file selection
   - Directory navigation

3. **Ignore Patterns**
   - Filters files based on gitignore-style patterns
   - Prevents selection of binary or irrelevant files

4. **Markdown Formatting**
   - Formats code with proper Markdown syntax
   - Optionally includes file tree structure
   - Ensures compatibility with LLMs

5. **Token Estimation**
   - Calculates estimated token count based on the size of selected files
   - Updates dynamically as files are selected/deselected
   - Helps users stay within LLM context limits

## Extension Permissions

- `activeTab`: To access the current tab's URL
- `storage`: To store user preferences and GitHub tokens
- `host_permissions` for `https://api.github.com/repos/*`: To make API requests

## Development Notes

- GitHub tokens are stored in Chrome's sync storage
- The project handles rate limiting and provides feedback to users
- Large repositories (>3000 files) may experience performance issues
# GitHub Prompter

A Chrome extension that helps you copy content from GitHub repositories in a format optimized for Large Language Models (LLMs). Perfect for developers who want to efficiently reference code in their LLM prompts.

## Features

- Copy files in LLM-friendly format with proper context and structure
- Smart formatting that preserves code hierarchy and relationships
- Auto-detects repository URLs from active tabs
- Customizable output format for different LLM preferences
- Clean, modern interface with tree visualization
- Save frequently accessed repositories
- Dark/light theme support

## Installation

1. Download or clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right corner
4. Click "Load unpacked" and select the directory containing this extension

## How to Use

1. Click on the extension icon in your Chrome toolbar
2. The extension will automatically detect if you're on a GitHub repository page
3. Browse the repository structure and select files
4. Copy the content in LLM-optimized format
5. Paste directly into your favorite LLM interface
6. Use the settings page to customize output format

## Project Structure

```
GitHub-Prompter/
├── manifest.json        # Extension configuration
├── popup.html          # Main popup interface
├── popup.js           # Main extension logic
├── popup.css         # Main styles
├── settings.html     # Settings page
├── settings.js      # Settings functionality
├── tree.js         # Tree view implementation
├── tree.css       # Tree view styles
├── githubApi.js   # GitHub API interactions
├── ajax.js       # AJAX utility functions
├── styles.css   # Global styles
├── images/      # Extension icons
│   ├── 32.png
│   ├── 48.png
│   ├── 64.png
│   ├── 128.png
│   └── 256.png
└── README.md    # Documentation
```

## Requirements

- Chrome browser
- Internet connection to access GitHub repositories

## Permissions

This extension requires minimal permissions:
- Access to active tab for detecting GitHub URLs
- Storage permission for saving settings
- Access to GitHub API for repository data

## Privacy

The extension only accesses:
- GitHub API for repository data
- Chrome storage for saving your preferences
- Active tab URL for GitHub repository detection

No personal data is collected or stored beyond your extension settings.
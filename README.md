# GitHub Repository Tree Viewer

A Chrome extension that allows you to quickly clone any GitHub repository and view its file structure in a tree format.

## Features

- Enter any GitHub repository URL and generate a tree view
- Auto-detects repository URLs from active tabs
- Displays file structure similar to the Unix `tree` command
- Copy tree structure to clipboard
- Saves the last viewed repository tree

## Installation

1. Download or clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right corner
4. Click "Load unpacked" and select the directory containing this extension

## How to Use

1. Click on the extension icon in your Chrome toolbar
2. Enter a GitHub repository URL (or it will auto-fill if you're already on a GitHub repo page)
3. Click "Clone & View Tree"
4. Wait for the extension to download and process the repository
5. View the tree structure in the popup

## Project Structure

```
GitHub-Repository-Tree-Viewer/
├── manifest.json        # Extension configuration
├── background.js        # Background script for download handling
├── popup.html           # Popup UI structure
├── popup.js             # Popup functionality
├── images/              # Extension icons
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md            # This file
```

## Requirements

- Chrome browser
- Internet connection to download repository files

## Limitations

- Currently supports public repositories only
- Large repositories may take longer to process
- The extension requires permissions to download files and access GitHub

## Privacy

This extension only requests the minimum permissions needed:
- Access to GitHub URLs to fetch repository data
- Download permission to get repository ZIP files
- Storage permission to save the last viewed repository tree
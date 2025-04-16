# GitHub Prompter 🚀

[![Chrome Extension](https://img.shields.io/badge/Chrome%20Extension-v1.0-brightgreen.svg)](https://chrome.google.com/webstore/detail/your-extension-id) <!-- Replace with actual link if/when published -->
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT) <!-- Add if you have a license -->

A simple Chrome extension to quickly browse and copy the contents of selected files from any public or private (with token) GitHub repository directly to your clipboard. Perfect for grabbing code snippets, configurations, or documentation across multiple files without cloning!

![Screenshot/GIF Placeholder](https://via.placeholder.com/600x400.png?text=Add+a+GIF+or+Screenshot+Here!)
*(Suggestion: Replace the placeholder above with a GIF demonstrating the extension in action!)*

## ✨ Features

*   **Fetch Repository:** Enter a GitHub repository URL and instantly load its file structure.
*   **Interactive File Tree:** Browse the repository's directories and files easily within the popup.
*   **File Selection:** Use checkboxes to select the specific files you need. Selecting a directory selects all files within it.
*   **Copy to Clipboard:** Copies the full content of all selected files, formatted with the file path as a header for each file.
*   **GitHub Integration:** Auto-fills the repository URL if you open the extension while on a GitHub repo page.
*   **Private Repo & Rate Limit Support:** Optionally add a GitHub Personal Access Token (PAT) via the Settings page to access private repositories and avoid API rate limits.

## 🚀 How to Use

1.  **Navigate (Optional):** Go to a GitHub repository page you want to browse (e.g., `https://github.com/owner/repo`). This helps auto-fill the URL.
2.  **Open Extension:** Click the **GitHub Prompter** icon in your Chrome toolbar.
3.  **Enter URL:** If not auto-filled, paste the full GitHub repository URL into the input field.
4.  **Fetch:** Click the **"Fetch Repository"** button.
5.  **Browse & Select:** Wait for the file tree to load. Expand directories and use the checkboxes to select the files you want to copy.
    ![File Tree Example](https://via.placeholder.com/450x200.png?text=File+Tree+Selection) *(Suggestion: Replace with an actual screenshot)*
6.  **Copy:** Once you've selected your files, click the **"Copy Selected Files to Clipboard"** button at the bottom.
    ![Copy Button Example](https://via.placeholder.com/450x50.png?text=Copy+Button) *(Suggestion: Replace with an actual screenshot)*
7.  **Paste:** The content of the selected files, each prefixed with its path (e.g., `============= path/to/file.js`), is now on your clipboard!

## ⚙️ Configuration (Optional: GitHub Token)

To access **private repositories** or avoid hitting **GitHub API rate limits** (especially on large repositories or frequent use), you can add a Personal Access Token (PAT).

1.  **Open Settings:** Click the **Settings icon (⚙️)** in the top-right corner of the extension popup, or right-click the extension icon in your toolbar and choose "Options".
2.  **Generate Token:** Create a PAT from your [GitHub Developer Settings](https://github.com/settings/tokens).
    *   For accessing **public repositories** and avoiding rate limits, no specific scopes are required.
    *   For accessing **private repositories**, you'll need appropriate permissions (e.g., the `repo` scope).
3.  **Enter Token:** Paste the generated token into the "GitHub Personal Access Token" field on the settings page.
4.  **Save:** Click **"Save Token"**. The token is stored securely using Chrome's storage API.

## 🛠️ Installation

*(Choose **one** of the following methods based on how you distribute it)*

**Method 1: From Chrome Web Store (Recommended)**

1.  Install the extension from the [Chrome Web Store](your-link-here) *(Link not available yet)*.
2.  Pin the extension icon to your toolbar for easy access.

**Method 2: Manual Installation (For Development)**

1.  Download or clone this repository:
    ```bash
    git clone https://github.com/your-username/github-prompter.git # Replace with your repo URL
    ```
2.  Open Chrome and navigate to `chrome://extensions/`.
3.  Enable **"Developer mode"** using the toggle switch in the top-right corner.
4.  Click the **"Load unpacked"** button.
5.  Select the directory where you cloned or downloaded the project files (the one containing `manifest.json`).
6.  The GitHub Prompter icon should appear in your toolbar!

## 🤔 Why Use GitHub Prompter?

*   **Efficiency:** Quickly grab code/text from multiple files without cloning the whole repo.
*   **Context:** Get file contents formatted with their paths, ready for AI prompts, documentation, or local notes.
*   **Simplicity:** Easy-to-use interface focused solely on browsing and copying files.

---

Happy Prompting! ✨
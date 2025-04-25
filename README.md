# 🚀 GitHub Prompter

[![Chrome Extension](https://img.shields.io/badge/Chrome%20Extension-v1.0-brightgreen.svg)](https://chromewebstore.google.com/detail/github-prompter/ipobmlmcobblnpakddoakhiljkcfceen)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Grab code from any GitHub repo and format it perfectly for Gemini, ChatGPT, Claude, or your favorite LLM - all with just a few clicks! No more copy-paste marathons or repository cloning just to ask a question about some code. 💪


https://github.com/user-attachments/assets/eead97c0-5b94-42bb-8ea2-1893bb4148d4


## 🚀 Quick Start

1. **Click the GitHub Prompter icon** while on any GitHub repository page
2. **Browse the file tree** and select the files you want to include
3. **Click "Copy Selected Files"** to copy them in Markdown format
4. **Paste directly into Gemini, ChatGPT, Claude, or any other AI assistant**

Since Github API can hit the rate limits pretty easily, the extension allows you enter a Github Personal Access Token (PAT) in the options page. The token is stored securely in your browser's local storage and is never transmitted anywhere except directly to GitHub's API. For public repositories, you can create a token with no permissions at all. If you need to access private repositories, you'll only need to grant the token repository read access. Detailed instructions on how to generate the token can be found in the extension's option page.

> **Note:** Performance may be a bit sluggish when working with large repositories.

## ⚙️ Configuration

Need to access private repos or avoid rate limits? Add a GitHub token:

1. Click the **⚙️ icon** in the popup to open the extension options page
2. Follow the instructions there to grab a Github Token
3. Paste your token and save!

## 📦 Installation

**From Chrome Web Store:**
1. Install from the [Chrome Web Store](https://chromewebstore.google.com/detail/github-prompter/ipobmlmcobblnpakddoakhiljkcfceen)
2. Pin to your toolbar for easy access

**For Development:**
1. Clone this repo
2. Open `chrome://extensions/`
3. Enable Developer mode
4. Click "Load unpacked" and select the project folder

---

Happy prompting! 🎉

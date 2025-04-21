# 🚀 GitHub Prompter

[![Chrome Extension](https://img.shields.io/badge/Chrome%20Extension-v1.0-brightgreen.svg)](https://chrome.google.com/webstore/detail/your-extension-id)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Your AI coding assistant's best friend!** Grab code from any GitHub repo and format it perfectly for ChatGPT, Claude, or your favorite LLM - all with just a few clicks! No more copy-paste marathons or repository cloning just to ask a question about some code. 💪

![Demo GIF](https://via.placeholder.com/600x400.png?text=GitHub+Prompter+in+Action!)
*Grab this code → Format it beautifully → Paste into your favorite AI assistant!*

## ✨ What Makes GitHub Prompter Special?

- **🤖 AI-Friendly Formatting** - Code is automatically formatted with file paths as headers and proper markdown syntax, making it perfect for AI prompts
- **🌳 Interactive File Tree** - Easily browse and select exactly the files you need from any repository
- **⚡ Lightning Fast** - Get the code you need in seconds, without cloning repositories or navigating through GitHub's interface
- **🔒 Private Repos** - Access your private repositories by adding a GitHub token
- **🧠 Smart Ignoring** - Automatically skip binary files, images, and other non-code files (customizable!)

## 🎬 How It Works

When you copy files, GitHub Prompter formats them like this:

```markdown
## File: src/main.js
```
function hello() {
  console.log("Hello world!");
}
```

## File: src/styles.css
```
body {
  font-family: sans-serif;
}
```
```

This format is **perfect for AI tools** - it clearly shows file paths and preserves syntax highlighting!

## 🚀 Quick Start

1. **Click the GitHub Prompter icon** while on any GitHub repository page
2. **Browse the file tree** and select the files you want to include
3. **Click "Copy Selected Files"** to copy them in AI-friendly format
4. **Paste directly into ChatGPT, Claude, or any other AI assistant**
5. **Ask away!** Your AI now has perfect context about the code

## ⚙️ Configuration

Need to access private repos or avoid rate limits? Add a GitHub token:

1. Click the **⚙️ icon** in the extension popup
2. Generate a token from [GitHub Developer Settings](https://github.com/settings/tokens)
3. Paste your token and save!

## 📦 Installation

**From Chrome Web Store:**
1. Install from the [Chrome Web Store](your-link-here) *(Coming soon!)*
2. Pin to your toolbar for easy access

**For Development:**
1. Clone this repo
2. Open `chrome://extensions/`
3. Enable Developer mode
4. Click "Load unpacked" and select the project folder

## 💡 Why GitHub Prompter?

- **Save time** - No more manual copying of multiple files
- **Better AI responses** - Properly formatted code with file paths gives AI tools better context
- **Stay in flow** - Get answers about code without switching between multiple tabs and tools

---

Happy prompting! 🎉 Go build amazing things with AI!
import { fetchRepoInfo, fetchRepoTree, fetchFileContent } from './github-api.js';
import { parseIgnoreFile, isIgnored } from './ignore-utils.js';
import Tree from './tree.js';

const el = {
  treeContainer: document.getElementById('tree-container'),
  loadingIndicator: document.getElementById('loading-indicator'),
  spinner: document.querySelector('#loading-indicator .spinner'),
  loadingText: document.getElementById('loading-text'),
  successIcon: document.getElementById('success-icon'),
  actionContainer: document.getElementById('action-container'),
  backToTreeBtn: document.getElementById('back-to-tree-btn'),
  settingsBtn: document.getElementById('settings-btn'),
  repoInfo: document.getElementById('repo-info'),
  fileActions: document.getElementById('file-actions'),
  copyBtn: document.getElementById('copy-files-btn'),
  selectedCount: document.getElementById('selected-count'),
  ignoredCount: document.getElementById('ignored-count'),
  tokenCount: document.getElementById('token-count'),
};

const state = {
  tree: null,        // Tree.js instance
  repo: null,        // { owner, name, branch, dir? }
  ignoreRegex: [],
};

/**
 * Shows the loading indicator with configurable options
 * @param {Object} options - Configuration options
 * @param {string} options.text - Text to display
 * @param {boolean} options.overlay - Whether to show as overlay
 * @param {boolean} options.showSpinner - Whether to show the spinner
 * @param {boolean} options.showSuccess - Whether to show success icon
 */
const showLoading = (options = {}) => {
  const {
    text = 'Loading...',
    overlay = false,
    showSpinner = true,
    showSuccess = false
  } = options;

  // Configure the loading indicator based on options
  el.loadingText.textContent = text;
  el.loadingIndicator.classList.toggle('overlay', overlay);
  el.spinner.style.display = showSpinner ? '' : 'none';

  // Set success icon content and display
  if (showSuccess) {
    el.successIcon.textContent = '✓';
    el.successIcon.style.display = 'block';
  } else {
    el.successIcon.style.display = 'none';
  }

  // Show the loading indicator
  switchView('loading');

  // Hide the action container when showing loading
  el.actionContainer.style.display = 'none';
};

/**
 * Shows or hides the action container with back button
 * @param {boolean} showBackButton - Whether to show the back button
 */
const showActionContainer = (showBackButton = true) => {
  if (showBackButton) {
    el.backToTreeBtn.style.display = 'block';
    el.actionContainer.style.display = 'flex';
  } else {
    el.actionContainer.style.display = 'none';
  }
};


document.addEventListener('DOMContentLoaded', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const [clean] = tab.url.split(/[?#]/); // remove query/hash

  /* Capture: owner, repo, branch, and (optionally) directory path */
  const match = clean.match(
    /https:\/\/github\.com\/([^/]+)\/([^/]+)(?:\/tree\/([^/]+)(?:\/(.+))?)?/
  );

  if (!match) {
    return showError(
      'Not a GitHub repository URL. Please navigate to a repository page (e.g., https://github.com/owner/repo).'
    );
  }
  const [, owner, repo, branchFromUrl, dirPath] = match;

  el.settingsBtn.addEventListener('click', () => chrome.runtime.openOptionsPage());
  el.copyBtn.addEventListener('click', copySelectedFiles);
  el.backToTreeBtn.addEventListener('click', () => switchView('tree'));

  loadRepository(owner, repo, branchFromUrl, dirPath);
});

const loadRepository = async (owner, repo, branchFromUrl, dirPath) => {
  try {
    const { ignorePatterns } = await chrome.storage.sync.get('ignorePatterns');
    if (ignorePatterns) state.ignoreRegex = parseIgnoreFile(ignorePatterns);
  } catch (err) {
    console.error('Failed to load ignore patterns', err);
  }

  showLoading({
    text: 'Loading repository',
    overlay: false
  });

  el.repoInfo.textContent = `${owner}/${repo}`;

  try {
    const { default_branch } = await fetchRepoInfo(owner, repo);
    state.repo = {
      owner,
      name: repo,
      branch: branchFromUrl || default_branch,
      subDir: (dirPath || '').replace(/\/$/, '') // strip trailing slash
    };

    const rawTree = await fetchRepoTree(owner, repo, state.repo.branch);
    const treeData = buildTree(rawTree.tree);

    /* If the URL points inside a sub-directory, drill down so that
       the root of the displayed tree is exactly that directory. */
    let finalTreeData = treeData;
    if (state.repo.subDir) {
      const parts = state.repo.subDir.split('/');
      let cursor = { children: treeData };

      for (const part of parts) {
        cursor =
          cursor.children.find(
            (c) => c.text === part && c.attributes?.type === 'directory'
          ) || null;
        if (!cursor) break;
      }
      if (cursor?.children) finalTreeData = cursor.children;
    }

    renderTree(finalTreeData);

    el.repoInfo.textContent = `${owner}/${repo} (${state.repo.branch})`;
  } catch (err) {
    console.error(err);
    showError(err.message);
  }
};

const switchView = (view) => {
  const is = (v) => view === v;
  el.loadingIndicator.style.display = is('loading') ? 'flex' : 'none';
  el.treeContainer.style.display = is('tree') ? 'block' : 'none';
  el.fileActions.style.display = is('tree') ? 'flex' : 'none';
};

const showError = (message) => {
  el.treeContainer.innerHTML = `
    <div class="output-container">
      <div class="error-message">${message}</div>
    </div>`;
  switchView('tree');
};

const updateCopyBtn = (selected) => {
  const files = selected.filter((n) => n.attributes?.type === 'file');
  const validFiles = files.filter((n) => !n.ignored);
  const ignored = files.length - validFiles.length;

  // Update button state
  el.copyBtn.disabled = validFiles.length === 0;

  // Update individual stats
  el.selectedCount.textContent = validFiles.length.toLocaleString();
  el.ignoredCount.textContent = ignored.toLocaleString();

  // Update token estimation
  updateTokenEstimation(validFiles);
};

// Calculate and display token estimation based on file sizes
const updateTokenEstimation = (validFiles) => {
  // Calculate total size of valid files
  const totalSizeInBytes = validFiles.reduce((sum, file) => sum + (file.size || 0), 0);

  // Calculate estimated tokens (4 bytes = 1 token)
  const estimatedTokens = Math.ceil(totalSizeInBytes / 4);

  // Update the display
  el.tokenCount.textContent = estimatedTokens.toLocaleString();
};

const buildTree = (items = []) => {
  const root = {};

  items.sort((a, b) => a.path.localeCompare(b.path));

  items.forEach(({ path, type, size }) => {
    const parts = path.split('/');
    let node = root;

    parts.forEach((part, i) => {
      const fullPath = parts.slice(0, i + 1).join('/');
      node[part] = node[part] || {
        id: fullPath,
        text: part,
        type: 'directory',
        size: 0,
        children: {},
      };

      if (i === parts.length - 1 && type === 'blob') {
        node[part].type = 'file';
        node[part].size = size || 0;
      }
      node = node[part].children;
    });
  });

  const toTreeData = (obj) => Object.values(obj)
    .map((item) => ({
      id: item.id,
      text: item.text,
      size: item.size || 0,
      ignored: isIgnored(item.id, state.ignoreRegex),
      children: item.type === 'directory' ? toTreeData(item.children) : [],
      attributes: { type: item.type },
    }))
    .sort((a, b) => {
      if (a.attributes.type !== b.attributes.type) return a.attributes.type === 'directory' ? -1 : 1;
      return a.text.localeCompare(b.text);
    });

  return toTreeData(root);
};

const renderTree = (treeData) => {
  el.treeContainer.innerHTML = '<div id="repo-tree"></div>';

  const rootLabel = state.repo.subDir
    ? `.../${state.repo.subDir.split('/').slice(-2).join('/')}`
    : `${state.repo.name}`;

  const rootNode = {
    id: 'root',
    text: rootLabel,
    ignored: false,
    children: treeData,
    attributes: { type: 'directory' },
  };

  try {
    state.tree = new Tree('#repo-tree', {
      data: [rootNode],
      closeDepth: 1,
      loaded() {
        document.querySelectorAll('#repo-tree .tree-node').forEach((el) => {
          const data = this.getNodeById(el.dataset.id);
          if (data?.attributes?.type) el.classList.add(data.attributes.type);
        });
        updateCopyBtn(this.selectedNodes);
      },
      onChange() {
        updateCopyBtn(this.selectedNodes);
      },
    });

    switchView('tree');
  } catch (err) {
    console.error(err);
    showError(err.message);
  }
};

const copySelectedFiles = async () => {
  if (!state.tree || !state.repo) return;

  const selected = state.tree.selectedNodes.filter((n) => n.attributes?.type === 'file');
  const valid = selected.filter((n) => !isIgnored(n.id, state.ignoreRegex));
  const ignored = selected.length - valid.length;

  showLoading({
    text: `Fetching ${valid.length} file contents...`,
    overlay: true
  });

  try {
    const { includeFileTree = false } = await chrome.storage.sync.get('includeFileTree');

    const contents = await Promise.all(
      valid.map(async (n) => {
        let text = await fetchFileContent(state.repo.owner, state.repo.name, n.id, state.repo.branch);
        if (n.id.endsWith('.md')) {
          text = text.replace(/```/g, '~~~');
        }
        return `## File: ${n.id}\n\`\`\`\n${text}\n\`\`\``;
      }),
    );

    let combined = contents.join('\n\n');

    if (includeFileTree) {
      const tree = asciiTree(valid.map((n) => n.id));
      combined = `## File Tree Structure\n\n${tree}\n\n${combined}`;
    }

    await navigator.clipboard.writeText(combined);

    showProgress(`Successfully copied ${valid.length} files to clipboard!${ignored ? ` (${ignored} ignored)` : ''}`, true);
  } catch (err) {
    console.error(err);
    showProgress(err.message, false);
  }
};

const showProgress = (message, success) => {
  showLoading({
    text: message,
    showSpinner: false,
    showSuccess: success,
    overlay: true
  });
  showActionContainer(true);
};

const asciiTree = (paths) => {
  if (!paths.length) return '';
  paths.sort();
  const root = {};

  paths.forEach((p) => {
    p.split('/').reduce((node, part) => {
      node[part] = node[part] || {};
      return node[part];
    }, root);
  });

  const format = (node, prefix = '', last = true) => {
    return Object.entries(node)
      .sort(([aKey, aVal], [bKey, bVal]) => {
        const aDir = Object.keys(aVal).length;
        const bDir = Object.keys(bVal).length;
        if (aDir && !bDir) return -1;
        if (!aDir && bDir) return 1;
        return aKey.localeCompare(bKey);
      })
      .map(([key, child], i, arr) => {
        const isLast = i === arr.length - 1;
        const line = `${prefix}${last ? '    ' : '│   '}${isLast ? '└──' : '├──'} ${key}${Object.keys(child).length ? '/' : ''}\n`;
        return line + format(child, `${prefix}${last ? '    ' : '│   '}`, isLast);
      })
      .join('');
  };

  return `└── ${state.repo.name}/\n${format(root)}`;
};

import { fetchRepoInfo, fetchRepoTree, fetchFileContent } from './github-api.js';
import { parseIgnoreFile, isIgnored } from './ignore-utils.js';

const el = {
  treeContainer: document.getElementById('tree-container'),
  loadingIndicator: document.getElementById('loading-indicator'),
  settingsBtn: document.getElementById('settings-btn'),
  repoInfo: document.getElementById('repo-info'),
  fileActions: document.getElementById('file-actions'),
  copyBtn: document.getElementById('copy-files-btn'),
  fetchProgress: document.getElementById('fetch-progress'),
  progressSpinner: document.querySelector('#fetch-progress .spinner'),
  progressText: document.getElementById('fetch-progress-text'),
  successIcon: document.getElementById('success-icon'),
};

const state = {
  tree: null,        // Tree.js instance
  repo: null,        // { owner, name, branch }
  ignoreRegex: [],
};

document.addEventListener('DOMContentLoaded', async () => {
  try {
    const { ignorePatterns } = await chrome.storage.sync.get('ignorePatterns');
    if (ignorePatterns) state.ignoreRegex = parseIgnoreFile(ignorePatterns);
  } catch (err) {
    console.error('Failed to load ignore patterns', err);
  }

  el.settingsBtn.addEventListener('click', () => chrome.runtime.openOptionsPage());
  el.copyBtn.addEventListener('click', copySelectedFiles);

  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    if (tab?.url) loadRepository(tab.url);
  });
});


const loadRepository = async (url) => {
  const [clean] = url.split(/[?#]/); // remove query/hash
  const match = clean.match(/https:\/\/github\.com\/([^/]+)\/([^/]+)(?:\/tree\/([^/]+))?/);

  if (!match) {
    return showError('Not a valid GitHub repository URL. Please navigate to a repository page (e.g., https://github.com/owner/repo).');
  }

  const [, owner, repo, branchFromUrl] = match;

  switchView('loading');
  el.repoInfo.textContent = `${owner}/${repo}`;

  try {
    const { default_branch } = await fetchRepoInfo(owner, repo);
    state.repo = { owner, name: repo, branch: branchFromUrl || default_branch };

    const rawTree = await fetchRepoTree(owner, repo, state.repo.branch);
    const treeData = buildTree(rawTree.tree);

    renderTree(treeData);
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
  el.fetchProgress.style.display = is('progress') ? 'flex' : 'none';
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

  el.copyBtn.textContent = `Copy ${validFiles.length} File${validFiles.length !== 1 ? 's' : ''}${ignored ? ` (${ignored} ignored)` : ''}`;
  el.copyBtn.disabled = validFiles.length === 0;
};

const buildTree = (items = []) => {
  const root = {};

  items.sort((a, b) => a.path.localeCompare(b.path));

  items.forEach(({ path, type }) => {
    const parts = path.split('/');
    let node = root;

    parts.forEach((part, i) => {
      const fullPath = parts.slice(0, i + 1).join('/');
      node[part] = node[part] || {
        id: fullPath,
        text: part,
        type: 'directory',
        children: {},
      };

      if (i === parts.length - 1 && type === 'blob') node[part].type = 'file';
      node = node[part].children;
    });
  });

  const toTreeData = (obj) => Object.values(obj)
    .map((item) => ({
      id: item.id,
      text: item.text,
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

  const rootNode = {
    id: 'root',
    text: `${state.repo.owner}/${state.repo.name}`,
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

  switchView('progress');
  el.progressSpinner.style.display = '';
  el.successIcon.style.display = 'none';
  el.progressText.textContent = `Fetching ${valid.length} file contents...`;

  try {
    const { includeFileTree = false } = await chrome.storage.sync.get('includeFileTree');

    const contents = await Promise.all(
      valid.map(async (n) => {
        const text = await fetchFileContent(state.repo.owner, state.repo.name, n.id, state.repo.branch);
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
  el.progressSpinner.style.display = 'none';
  el.successIcon.textContent = success ? '✓' : '';
  el.successIcon.style.display = success ? 'block' : 'none';
  el.progressText.textContent = message;

  const oldBtn = el.fetchProgress.querySelector('button');
  if (oldBtn) oldBtn.remove();

  const back = document.createElement('button');
  back.textContent = 'Back to Tree';
  back.className = 'btn btn-secondary';
  back.style.marginTop = '16px';
  back.addEventListener('click', () => switchView('tree'));
  el.fetchProgress.appendChild(back);
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
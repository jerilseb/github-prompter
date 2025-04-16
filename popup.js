import { fetchRepoInfo, fetchBranchInfo, fetchRepoTree, fetchFileContent } from './githubApi.js';

document.addEventListener('DOMContentLoaded', function () {
  // --- UI Elements ---
  const treeContainer = document.getElementById('tree-container');
  const loadingIndicator = document.getElementById('loading-indicator');
  const settingsBtn = document.getElementById('settings-btn');
  const repoInfoDiv = document.getElementById('repo-info');
  const fileActionsDiv = document.getElementById('file-actions');
  const copyFilesBtn = document.getElementById('copy-files-btn');
  const fetchProgressDiv = document.getElementById('fetch-progress');
  const fetchProgressText = document.getElementById('fetch-progress-text');
  const fetchProgressSpinner = fetchProgressDiv.querySelector('.spinner');

  // --- State ---
  let currentTree = null; // Stores the Tree.js instance
  let currentRepoData = null; // Stores current repo { owner, name, branch }
  let currentTreeData = null; // Stores the processed tree data used to initialize the tree

  // --- Constants ---
  const UI_STATE = {
    INITIAL: 'initial',
    LOADING: 'loading',
    ERROR: 'error',
    TREE_VIEW: 'tree_view',
    FETCHING: 'fetching',
    COPY_SUCCESS: 'copy_success',
    COPY_ERROR: 'copy_error'
  };

  // --- Initialization ---

  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    if (tabs && tabs[0] && tabs[0].url) {
      const url = tabs[0].url;
      loadRepository(url);
    } else {
      _setUIState(UI_STATE.ERROR, 'Could not get current tab URL. Ensure the extension has permission to access the current page.');
      repoInfoDiv.textContent = 'Error';
    }
  });

  // --- Event Listeners ---

  settingsBtn.addEventListener('click', function () {
    chrome.runtime.openOptionsPage();
  });

  copyFilesBtn.addEventListener('click', handleCopyFiles);

  // --- Core Logic ---

  function _parseGitHubUrl(url) {
    const match = url.match(/https:\/\/github\.com\/([^\/]+)\/([^\/]+)(?:\/tree\/([^\/]+))?/);
    if (!match) return null;
    return { owner: match[1], repo: match[2], specifiedBranch: match[3] };
  }

  async function loadRepository(url) {
    const repoUrlData = _parseGitHubUrl(url);
    if (!repoUrlData) {
      _setUIState(UI_STATE.ERROR, 'Not a valid GitHub repository URL.');
      repoInfoDiv.textContent = 'Invalid URL';
      return;
    }
    const { owner, repo, specifiedBranch } = repoUrlData;
    _setUIState(UI_STATE.LOADING, `${owner}/${repo}`);

    try {
      const repoInfo = await fetchRepoInfo(owner, repo);
      const branch = specifiedBranch || repoInfo.default_branch;
      currentRepoData = { owner, name: repo, branch };

      const branchInfo = await fetchBranchInfo(owner, repo, branch);
      const commitSha = branchInfo.commit.sha;

      const treeInfo = await fetchRepoTree(owner, repo, commitSha);
      currentTreeData = processGitTree(treeInfo.tree); // Store processed data

      _setUIState(UI_STATE.TREE_VIEW, { tree: currentTreeData, repo: currentRepoData });
    } catch (error) {
      console.error('Error fetching repository:', error);
      const errorMessage = _formatFetchError(error, 'Error fetching repository');
      _setUIState(UI_STATE.ERROR, errorMessage);
      repoInfoDiv.textContent = 'Error';
    }
  }

  function processGitTree(items) {
    if (!Array.isArray(items)) {
      console.error('Invalid tree items received:', items);
      return [];
    }
    const root = {};
    items.sort((a, b) => { // Sort logic remains same
      const aParts = a.path.split('/');
      const bParts = b.path.split('/');
      const minLength = Math.min(aParts.length, bParts.length);
      for (let i = 0; i < minLength - 1; i++) {
        if (aParts[i] !== bParts[i]) return aParts[i].localeCompare(bParts[i]);
      }
      if (aParts.length !== bParts.length) return aParts.length - bParts.length;
      if (a.type !== b.type) return a.type === 'tree' ? -1 : 1;
      return aParts[aParts.length - 1].localeCompare(bParts[bParts.length - 1]);
    });
    items.forEach(item => {
      if (!item.path) return;
      const parts = item.path.split('/');
      let currentLevel = root;
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const isLastPart = i === parts.length - 1;
        const currentPath = parts.slice(0, i + 1).join('/');
        if (!currentLevel[part]) {
          currentLevel[part] = { id: currentPath, text: part, type: 'directory', children: {} };
        }
        if (isLastPart) {
          currentLevel[part].type = item.type === 'tree' ? 'directory' : 'file';
          if (currentLevel[part].type === 'file') delete currentLevel[part].children;
        } else {
          if (!currentLevel[part].children) currentLevel[part].children = {};
          currentLevel = currentLevel[part].children;
        }
      }
    });
    function convertToTreeFormat(node) {
      if (!node || typeof node !== 'object') return [];
      return Object.values(node).map(item => ({
        id: item.id,
        text: item.text,
        children: item.type === 'directory' && item.children ? convertToTreeFormat(item.children) : [],
        attributes: { type: item.type }
      })).sort((a, b) => {
        if (a.attributes.type === 'directory' && b.attributes.type === 'file') return -1;
        if (a.attributes.type === 'file' && b.attributes.type === 'directory') return 1;
        return a.text.localeCompare(b.text);
      });
    }
    return convertToTreeFormat(root);
  }

  function _initTreeView(treeData) {
    const repoTreeElement = document.getElementById('repo-tree');
    if (!repoTreeElement) {
      console.error("Element #repo-tree not found during init.");
      treeContainer.innerHTML = `<div class="output-container"><div class="error-message">Failed to find tree container element.</div></div>`;
      fileActionsDiv.style.display = 'none';
      return;
    }
    try {
      // Store the data used, in case we need to re-init
      currentTreeData = treeData;
      currentTree = new Tree('#repo-tree', {
        data: treeData,
        closeDepth: 0,
        loaded: function () {
          const nodes = document.querySelectorAll('#repo-tree .tree-node');
          nodes.forEach(nodeEl => {
            const nodeData = this.getNodeById(nodeEl.getAttribute('data-id'));
            if (nodeData?.attributes?.type) {
              nodeEl.classList.add(nodeData.attributes.type);
            }
          });
          _updateCopyButtonState();
        },
        onChange: function () {
          _updateCopyButtonState();
        }
      });
    } catch (error) {
      console.error('Error initializing Tree.js:', error);
      _setUIState(UI_STATE.ERROR, `Error initializing tree view: ${error.message}`);
    }
  }

  async function handleCopyFiles() {
    if (!currentTree || !currentRepoData || copyFilesBtn.disabled) return;
    const selectedFileNodes = currentTree.selectedNodes.filter(node => node.attributes?.type === 'file');
    if (selectedFileNodes.length === 0) return;

    _setUIState(UI_STATE.FETCHING, selectedFileNodes.length);
    try {
      const fileContentsPromises = selectedFileNodes.map(node =>
        fetchFileContent(currentRepoData.owner, currentRepoData.name, node.id, currentRepoData.branch)
          .then(content => ({ path: node.id, content }))
          .catch(err => ({ path: node.id, error: err }))
      );
      const results = await Promise.all(fileContentsPromises);
      const successfulFetches = results.filter(r => r.content !== undefined);
      const failedFetches = results.filter(r => r.error !== undefined);
      if (failedFetches.length > 0) console.error("Errors fetching some files:", failedFetches);
      if (successfulFetches.length === 0) throw new Error("Failed to fetch content for any selected files.");

      const combinedContent = successfulFetches
        .map(file => `## File: ${file.path}\n\`\`\`\n${file.content}\n\`\`\``)
        .join('\n\n');
      await navigator.clipboard.writeText(combinedContent);
      _setUIState(UI_STATE.COPY_SUCCESS, successfulFetches.length);
    } catch (error) {
      console.error('Error copying files:', error);
      const errorMessage = _formatFetchError(error, 'Error copying file content');
      _setUIState(UI_STATE.COPY_ERROR, errorMessage);
    }
  }

  // --- UI Update Functions ---

  function _setUIState(state, data) {
    loadingIndicator.style.display = 'none';
    treeContainer.style.display = 'none';
    if (state !== UI_STATE.COPY_SUCCESS && state !== UI_STATE.COPY_ERROR) {
      treeContainer.innerHTML = ''; // Clear only if not coming from fetch->success/error
    }
    fileActionsDiv.style.display = 'none';
    fetchProgressDiv.style.display = 'none';
    fetchProgressSpinner.style.display = 'inline-block';
    fetchProgressDiv.querySelector('button')?.remove();

    switch (state) {
      case UI_STATE.LOADING:
        loadingIndicator.style.display = 'flex';
        repoInfoDiv.textContent = data || 'Loading...';
        break;

      case UI_STATE.ERROR:
        treeContainer.innerHTML = `<div class="output-container"><div class="error-message">${data || 'An unknown error occurred.'}</div></div>`;
        treeContainer.style.display = 'flex';
        repoInfoDiv.textContent = repoInfoDiv.textContent.includes('/') ? repoInfoDiv.textContent : 'Error';
        break;

      case UI_STATE.TREE_VIEW:
        treeContainer.innerHTML = '<div id="repo-tree"></div>'; // Prepare container
        treeContainer.style.display = 'block';
        fileActionsDiv.style.display = 'flex';
        if (data && data.repo) { // Ensure repo data is passed
          repoInfoDiv.textContent = `${data.repo.owner}/${data.repo.name} (${data.repo.branch})`;
        }
        _initTreeView(data.tree); // Initialize or re-initialize the tree
        break;

      case UI_STATE.FETCHING:
        repoInfoDiv.textContent = `${currentRepoData.owner}/${currentRepoData.name} (${currentRepoData.branch})`;
        treeContainer.style.display = 'none';
        fileActionsDiv.style.display = 'none';
        fetchProgressText.textContent = `Fetching ${data} file content${data !== 1 ? 's' : ''}...`;
        fetchProgressDiv.style.display = 'flex';
        break;

      case UI_STATE.COPY_SUCCESS:
        fetchProgressDiv.style.display = 'none';
        const successDiv = document.createElement('div');
        successDiv.className = 'success-notification';
        successDiv.textContent = `Successfully copied ${data} file${data !== 1 ? 's' : ''} to clipboard!`;
        document.body.appendChild(successDiv);

        setTimeout(() => {
          successDiv.remove();
          _setUIState(UI_STATE.TREE_VIEW, { tree: currentTreeData, repo: currentRepoData });
        }, 2000); // Show success for 2 seconds
        break;

      case UI_STATE.COPY_ERROR:
        repoInfoDiv.textContent = `${currentRepoData.owner}/${currentRepoData.name} (${currentRepoData.branch})`;
        fetchProgressSpinner.style.display = 'none';
        fetchProgressText.textContent = data;
        fetchProgressDiv.style.display = 'flex';

        const backButton = document.createElement('button');
        backButton.textContent = 'Back to Tree';
        backButton.className = 'btn btn-secondary';
        backButton.style.marginTop = '10px';
        backButton.onclick = () => {
          // --- FIX: Also use _setUIState here for consistency ---
          if (currentTreeData && currentRepoData) {
            _setUIState(UI_STATE.TREE_VIEW, { tree: currentTreeData, repo: currentRepoData });
          } else {
            console.error("Cannot restore tree view: cached tree data or repo data is missing.");
            _setUIState(UI_STATE.ERROR, "Failed to restore tree view after error.");
          }
        };
        fetchProgressDiv.appendChild(backButton);
        break;

      case UI_STATE.INITIAL:
      default:
        repoInfoDiv.textContent = 'GitHub Repo Viewer';
        break;
    }
  }

  function _updateCopyButtonState() {
    if (!currentTree) {
      copyFilesBtn.textContent = 'Copy Files';
      copyFilesBtn.disabled = true;
      return;
    }
    const selectedFileNodes = (currentTree.selectedNodes || []).filter(node => node.attributes?.type === 'file');
    const count = selectedFileNodes.length;
    copyFilesBtn.textContent = `Copy ${count} File${count !== 1 ? 's' : ''}`;
    copyFilesBtn.disabled = count === 0;
  }

  function _formatFetchError(error, contextMessage = 'An error occurred') {
    let specificMessage = error.message;
    if (error.message.includes('403')) specificMessage = 'API rate limit exceeded or access denied. Check Settings (⚙️).';
    else if (error.message.includes('404')) specificMessage = 'Repository/file not found or access denied.';
    else if (error.message.includes('Failed to fetch')) specificMessage = 'Network error. Check connection.';
    return `${contextMessage}: ${specificMessage}`;
  }
});
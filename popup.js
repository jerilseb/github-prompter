import { fetchRepoInfo, fetchBranchInfo, fetchRepoTree, fetchFileContent } from './githubApi.js';

document.addEventListener('DOMContentLoaded', function () {
  const treeContainer = document.getElementById('tree-container');
  const loadingIndicator = document.getElementById('loading-indicator');
  const settingsBtn = document.getElementById('settings-btn');
  const repoInfoDiv = document.getElementById('repo-info');
  const fileActionsDiv = document.getElementById('file-actions');
  const copyFilesBtn = document.getElementById('copy-files-btn');
  const fetchProgressDiv = document.getElementById('fetch-progress');

  let currentTree = null; // Store tree instance
  let currentRepoData = null; // Store current repo { owner, name, branch }

  // Add settings button click handler
  settingsBtn.addEventListener('click', function () {
    chrome.runtime.openOptionsPage();
  });

  // Function to fetch and display the repository tree
  async function loadRepository(url) {
    const match = url.match(/https:\/\/github\.com\/([^\/]+)\/([^\/]+)(?:\/tree\/([^\/]+))?/);
    if (!match) {
      treeContainer.innerHTML = `
        <div class="output-container">
          <div class="error-message">
            Not a valid GitHub repository URL. Please navigate to a repository page (e.g., https://github.com/owner/repo).
          </div>
        </div>
      `;
      loadingIndicator.style.display = 'none';
      fileActionsDiv.style.display = 'none'; // Hide actions bar on error
      fetchProgressDiv.style.display = 'none'; // Explicitly hide fetch progress too
      return;
    }

    // Extract repository information
    const owner = match[1];
    const repo = match[2];
    const specifiedBranch = match[3]; // Might be undefined

    // Show loading indicator
    treeContainer.innerHTML = ''; // Clear previous content
    treeContainer.style.display = 'none';
    fileActionsDiv.style.display = 'none'; // Hide actions while loading
    fetchProgressDiv.style.display = 'none'; // Ensure progress is hidden
    loadingIndicator.style.display = 'flex'; // Use flex for centering
    repoInfoDiv.textContent = `${owner}/${repo}`;

    try {
      // First, get the repository info to get the default branch
      const repoData = await fetchRepoInfo(owner, repo);
      // Use specified branch from URL or fall back to default branch
      const branch = specifiedBranch || repoData.default_branch;

      currentRepoData = { owner, name: repo, branch }; // Store for later use

      // Get the commit SHA for the branch
      const branchData = await fetchBranchInfo(owner, repo, branch);
      const commitSha = branchData.commit.sha;

      // Then get the tree with recursive option
      const treeData = await fetchRepoTree(owner, repo, commitSha);

      // Convert to tree format and display
      showTreeView(processGitTree(treeData.tree), currentRepoData);
      repoInfoDiv.textContent = `${owner}/${repo} (${branch})`;

    } catch (error) {
      console.error('Error fetching repository:', error);

      treeContainer.innerHTML = `
        <div class="output-container">
          <div class="error-message">
            ${error.message}
          </div>
        </div>
      `;
      treeContainer.style.display = 'flex'; // Show error message container
      repoInfoDiv.textContent = 'Error';
      fileActionsDiv.style.display = 'none'; // Keep actions hidden on error
    } finally {
      loadingIndicator.style.display = 'none';
    }
  }

  // Check current tab URL and automatically load repository
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    const url = tabs[0].url;
    loadRepository(url); // Automatically try to load repo from current tab
  });

  // Process Git Tree data into hierarchical structure
  function processGitTree(items) {
    if (!Array.isArray(items)) {
      console.error('Invalid items:', items);
      return [];
    }

    const root = {};

    // Sort items to ensure directories come before files and alphabetically
    items.sort((a, b) => {
      const aParts = a.path.split('/');
      const bParts = b.path.split('/');

      // Compare parent directories first
      const minLength = Math.min(aParts.length, bParts.length);
      for (let i = 0; i < minLength - 1; i++) {
        if (aParts[i] !== bParts[i]) {
          return aParts[i].localeCompare(bParts[i]);
        }
      }

      // Prioritize directories ('tree') over files ('blob') at the same level
      if (a.type === 'tree' && b.type === 'blob') {
        // Check if they are in the same directory level before prioritizing type
        if (aParts.length === bParts.length) return -1;
      }
      if (a.type === 'blob' && b.type === 'tree') {
        if (aParts.length === bParts.length) return 1;
      }

      // Default to path comparison
      return a.path.localeCompare(b.path);
    });


    // Process each item into the tree structure
    items.forEach(item => {
      if (!item.path) {
        console.warn('Skipping item without path:', item);
        return;
      }

      const parts = item.path.split('/');
      let current = root;

      // Build the path one level at a time
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const isLastPart = i === parts.length - 1;
        const currentPath = parts.slice(0, i + 1).join('/');

        if (!current[part]) {
          current[part] = {
            id: currentPath, // Use full path as ID
            text: part,
            type: 'directory', // Assume directory initially
            children: {}
          };
        }

        if (isLastPart) {
          // If it's the last part, set the correct type
          current[part].type = item.type === 'tree' ? 'directory' : 'file';
          // If it's a file, it shouldn't have children object
          if (current[part].type === 'file') {
            delete current[part].children;
          }
        }

        // Move to the next level if not the last part
        if (!isLastPart) {
          // Ensure children object exists if we are traversing deeper
          if (!current[part].children) {
            current[part].children = {};
          }
          current = current[part].children;
        }
      }
    });

    // Convert the tree structure to Tree.js format
    function convertToTreeFormat(node) {
      if (!node || typeof node !== 'object') return [];

      return Object.values(node).map(item => ({
        id: item.id,
        text: item.text,
        // Ensure children is an empty array for files, otherwise convert recursively
        children: item.type === 'directory' && item.children ? convertToTreeFormat(item.children) : [],
        attributes: { type: item.type }
      })).sort((a, b) => {
        // Sort directories before files, then alphabetically
        if (a.attributes.type === 'directory' && b.attributes.type === 'file') return -1;
        if (a.attributes.type === 'file' && b.attributes.type === 'directory') return 1;
        return a.text.localeCompare(b.text);
      });
    }

    return convertToTreeFormat(root);
  }


  // Display the tree view
  function showTreeView(treeData, repository) {
    treeContainer.innerHTML = '<div id="repo-tree"></div>'; // Prepare container
    treeContainer.style.display = 'block'; // Ensure container is visible
    fileActionsDiv.style.display = 'flex'; // Show file actions bar

    // Initialize tree
    try {
      currentTree = new Tree('#repo-tree', {
        data: treeData, // Pass the processed data directly
        closeDepth: 0, // Start with top-level items expanded
        loaded: function () {
          // Add custom classes to nodes
          const nodes = document.querySelectorAll('#repo-tree .tree-node');
          nodes.forEach(node => {
            const nodeData = this.getNodeById(node.getAttribute('data-id'));
            if (nodeData && nodeData.attributes) {
              node.classList.add(nodeData.attributes.type);
            }
          });
          // Initial update of selection info
          updateCopyButton(this.selectedNodes);
        },
        onChange: function () {
          // Update selected files count and button state
          updateCopyButton(this.selectedNodes);
        }
      });

      // Removed Select All checkbox handler

    } catch (error) {
      console.error('Error initializing tree:', error);
      treeContainer.innerHTML = `
        <div class="output-container">
          <div class="error-message">
            ${error.message}
          </div>
        </div>
      `;
      treeContainer.style.display = 'flex'; // Show error message container
      fileActionsDiv.style.display = 'none';
    }
  }

  // Update copy button text and state
  function updateCopyButton(selectedNodes) {
    if (!currentTree) return;
    const selectedFileNodes = selectedNodes.filter(node =>
      node.attributes && node.attributes.type === 'file'
    );
    const count = selectedFileNodes.length;
    // Update button text
    copyFilesBtn.textContent = `Copy ${count} File${count !== 1 ? 's' : ''}`;
    // Enable/disable button
    copyFilesBtn.disabled = count === 0;

    // Removed Select All checkbox logic
  }


  // Handle copy files button click
  copyFilesBtn.onclick = async function () {
    if (!currentTree || !currentRepoData) return;

    // Get selected file nodes
    const selectedFiles = currentTree.selectedNodes.filter(node =>
      node.attributes && node.attributes.type === 'file'
    );

    if (selectedFiles.length === 0) {
      // This state shouldn't be reachable if button is disabled correctly
      return;
    }

    // Show fetching progress state
    fileActionsDiv.style.display = 'none'; // Hide actions
    treeContainer.style.display = 'none'; // Hide tree
    fetchProgressDiv.style.display = 'flex'; // Show progress indicator
    fetchProgressDiv.querySelector('.spinner').style.display = ''; // Ensure spinner is visible
    const progressText = document.getElementById('fetch-progress-text');
    progressText.textContent = `Fetching ${selectedFiles.length} file contents...`;
    // Clear any previous buttons in progress div
    const oldBackButton = fetchProgressDiv.querySelector('button');
    if (oldBackButton) oldBackButton.remove();


    try {
      // Fetch contents for each file
      const fileContents = await Promise.all(selectedFiles.map(async (node) => {
        // Ensure node.id contains the full path needed for the API call
        const content = await fetchFileContent(currentRepoData.owner, currentRepoData.name, node.id, currentRepoData.branch);
        // Use a clear separator and indicate the file path
        return `## File: ${node.id}\n\`\`\`\n${content}\n\`\`\``;
      }));

      // Combine all contents with double newline for better separation
      const combinedContent = fileContents.join('\n\n');

      // Copy to clipboard
      await navigator.clipboard.writeText(combinedContent);

      // Show success feedback as a green overlay
      fetchProgressDiv.style.display = 'none'; // Hide progress indicator
      const successDiv = document.createElement('div');
      successDiv.className = 'success-notification';
      successDiv.textContent = `Successfully copied ${selectedFiles.length} files to clipboard!`;
      document.body.appendChild(successDiv);

      // Restore view after a delay
      setTimeout(() => {
        successDiv.remove(); // Remove the green overlay
        treeContainer.style.display = 'block'; // Restore tree view
        fileActionsDiv.style.display = 'flex'; // Restore actions
        // State (selection) is preserved
      }, 2000);


    } catch (error) {
      console.error('Error fetching files:', error);
      fetchProgressDiv.querySelector('.spinner').style.display = 'none'; // Hide spinner on error
      progressText.textContent = error.message; // Display error message

      // Add a button to dismiss the error and go back
      const backButton = document.createElement('button');
      backButton.textContent = 'Back to Tree';
      backButton.className = 'btn btn-secondary';
      backButton.style.marginTop = '10px';
      backButton.onclick = () => {
        fetchProgressDiv.style.display = 'none';
        treeContainer.style.display = 'block';
        fileActionsDiv.style.display = 'flex';
        backButton.remove(); // Clean up button
      };
      fetchProgressDiv.appendChild(backButton);
    }
  };

});
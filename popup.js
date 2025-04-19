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

      // // Get the commit SHA for the branch
      // const branchData = await fetchBranchInfo(owner, repo, branch);
      // const commitSha = branchData.commit.sha;

      // Then get the tree with recursive option
      const rawTreeData = await fetchRepoTree(owner, repo, branch);
      const treeData = processGitTree(rawTreeData.tree);
      console.log(treeData);

      // Convert to tree format and display
      showTreeView(treeData, currentRepoData);
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

    // Create root node
    const rootNode = {
      id: 'root',
      text: `${repository.owner}/${repository.name}`,
      children: treeData,
      attributes: {
        type: 'directory'
      }
    };

    // Initialize tree
    try {
      currentTree = new Tree('#repo-tree', {
        data: [rootNode], // Pass the processed data directly
        closeDepth: 1, // Start with top-level items expanded
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

  // --- Helper function to convert simple glob patterns to regex ---
  // Handles patterns like *.js, /dir/file, dir/
  function globToRegex(glob) {
    // Escape special regex characters, except *, ?, and /
    let regexString = glob.replace(/([.+^$(){}|[\\]])/g, '\\$1');
    // Convert glob wildcards to regex
    regexString = regexString.replace(/\*/g, '[^/]*'); // * matches anything except /
    regexString = regexString.replace(/\?/g, '[^/]'); // ? matches any single character except /

    // Handle directory matching (e.g., 'dist/')
    if (regexString.endsWith('/')) {
      regexString += '.*'; // Match anything inside the directory
    } else {
       // If not ending with /, make sure it matches the end of the string or a /
       // regexString += '($|\\/)'; // Let's test without this first, might be too strict
    }

    // Ensure the pattern matches from the beginning of the path segment
    // or the start of the string
    // Handle cases like *.js matching file.js and dir/file.js
    // This makes it behave more like .gitignore matching
    regexString = '(^|\\/)' + regexString;

    try {
      return new RegExp(regexString);
    } catch (e) {
      console.warn(`Invalid glob pattern "${glob}":`, e);
      return null; // Return null for invalid patterns
    }
  }

  // --- Modified copy files button click handler ---
  copyFilesBtn.onclick = async function () {
    if (!currentTree || !currentRepoData) return;

    // --- Fetch Ignore Patterns ---
    let ignorePatterns = [];
    try {
      const result = await new Promise((resolve) => {
        chrome.storage.sync.get(['ignorePatterns'], resolve);
      });
      if (result.ignorePatterns) {
        ignorePatterns = result.ignorePatterns
          .split('\n') // Split by newline
          .map(p => p.trim()) // Trim whitespace
          .filter(p => p); // Remove empty lines
      }
    } catch (error) {
      console.error("Error fetching ignore patterns:", error);
      // Optionally notify the user or proceed without filtering
    }

    // --- Compile ignore patterns to Regex ---
    const ignoreRegexes = ignorePatterns.map(globToRegex).filter(Boolean); // Filter out nulls from invalid patterns

    // Get selected file nodes
    const allSelectedFiles = currentTree.selectedNodes.filter(node =>
      node.attributes && node.attributes.type === 'file'
    );

    // --- Filter selected files based on ignore patterns ---
    const selectedFiles = allSelectedFiles.filter(node => {
      const filePath = node.id; // Assuming node.id is the full path
      return !ignoreRegexes.some(regex => regex.test(filePath));
    });

    const ignoredCount = allSelectedFiles.length - selectedFiles.length;
    if (ignoredCount > 0) {
      console.log(`Ignoring ${ignoredCount} file(s) based on patterns.`);
      // Maybe show a subtle notification later?
    }

    if (selectedFiles.length === 0) {
      // If all files are ignored or none selected initially, update progress text and provide feedback
      fileActionsDiv.style.display = 'none';
      treeContainer.style.display = 'none';
      fetchProgressDiv.style.display = 'flex';
      fetchProgressDiv.querySelector('.spinner').style.display = 'none'; // Hide spinner
      const progressText = document.getElementById('fetch-progress-text');
      progressText.textContent = allSelectedFiles.length > 0 // Check if files were selected initially
        ? `All ${ignoredCount} selected file(s) were ignored.`
        : 'No files selected to copy.'; // Clarify message

      const backButton = document.createElement('button');
      backButton.textContent = 'Back to Tree';
      backButton.className = 'btn btn-secondary';
      backButton.style.marginTop = '10px';
      backButton.onclick = () => {
        fetchProgressDiv.style.display = 'none';
        treeContainer.style.display = 'block';
        fileActionsDiv.style.display = 'flex';
        backButton.remove();
      };
      // Clear any previous buttons
      const oldBackButton = fetchProgressDiv.querySelector('button');
      if (oldBackButton) oldBackButton.remove();
      fetchProgressDiv.appendChild(backButton);
      return; // Stop processing
    }

    // --- Proceed with fetching and copying the FILTERED list ---

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
      // Fetch contents for each FILTERED file
      const fileContents = await Promise.all(selectedFiles.map(async (node) => {
        const content = await fetchFileContent(currentRepoData.owner, currentRepoData.name, node.id, currentRepoData.branch);
        return `## File: ${node.id}\n\`\`\`\n${content}\n\`\`\``;
      }));

      const combinedContent = fileContents.join('\n\n');
      await navigator.clipboard.writeText(combinedContent);

      // Show success feedback
      fetchProgressDiv.style.display = 'none';
      const successDiv = document.createElement('div');
      successDiv.className = 'success-notification';
      successDiv.textContent = `Successfully copied ${selectedFiles.length} files to clipboard!${ignoredCount > 0 ? ` (${ignoredCount} ignored)` : ''}`;
      document.body.appendChild(successDiv);

      setTimeout(() => {
        successDiv.remove();
        treeContainer.style.display = 'block';
        fileActionsDiv.style.display = 'flex';
      }, 2500); // Slightly longer timeout to read ignored count

    } catch (error) {
      console.error('Error fetching files:', error);
      fetchProgressDiv.querySelector('.spinner').style.display = 'none';
      progressText.textContent = error.message;

      const backButton = document.createElement('button');
      backButton.textContent = 'Back to Tree';
      backButton.className = 'btn btn-secondary';
      backButton.style.marginTop = '10px';
      backButton.onclick = () => {
        fetchProgressDiv.style.display = 'none';
        treeContainer.style.display = 'block';
        fileActionsDiv.style.display = 'flex';
        backButton.remove();
      };
       // Clear any previous buttons
      const oldBackButton = fetchProgressDiv.querySelector('button');
      if (oldBackButton) oldBackButton.remove();
      fetchProgressDiv.appendChild(backButton);
    }
  };

});
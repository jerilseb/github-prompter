import { fetchRepoInfo, fetchBranchInfo, fetchRepoTree, fetchFileContent } from './githubApi.js';

function initializePopup() {
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

  copyFilesBtn.addEventListener('click', copyFiles);

  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    const url = tabs[0].url;
    loadRepository(url); // Automatically try to load repo from current tab
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

  // --- Helper function to display feedback and the Back button ---
  function displayProgressFeedback(message, isSuccess = false) {
    fetchProgressDiv.style.display = 'flex'; // Show progress area
    treeContainer.style.display = 'none'; // Hide tree
    fileActionsDiv.style.display = 'none'; // Hide actions
    fetchProgressDiv.querySelector('.spinner').style.display = 'none'; // Hide spinner
    const progressText = document.getElementById('fetch-progress-text');
    const successIcon = document.getElementById('success-icon'); // Get the icon element

    // Control icon visibility and content
    successIcon.textContent = isSuccess ? '✓' : '';
    successIcon.style.display = isSuccess ? 'block' : 'none';

    progressText.textContent = message;

    // Clear any previous buttons
    const oldBackButton = fetchProgressDiv.querySelector('button');
    if (oldBackButton) oldBackButton.remove();

    // Add 'Back to Tree' button
    const backButton = document.createElement('button');
    backButton.textContent = 'Back to Tree';
    backButton.className = 'btn btn-secondary';
    backButton.style.marginTop = '16px';
    backButton.onclick = () => {
      fetchProgressDiv.style.display = 'none';
      treeContainer.style.display = 'block';
      fileActionsDiv.style.display = 'flex';
      backButton.remove(); // Remove the button itself
      progressText.textContent = ''; // Clear the progress text
      document.getElementById('success-icon').style.display = 'none'; // Hide icon when going back
    };
    fetchProgressDiv.appendChild(backButton);
  }

  // --- Modified copy files button click handler ---
  async function copyFiles() {
    if (!currentTree || !currentRepoData) return;

    // --- Fetch Ignore Patterns ---
    let ignorePatterns = [];
    try {
      const result = await chrome.storage.sync.get("ignorePatterns");
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
    const selectedNodes = currentTree.selectedNodes.filter(node =>
      node.attributes && node.attributes.type === 'file'
    );

    // --- Filter selected files based on ignore patterns ---
    const filteredNodes = selectedNodes.filter(node => {
      const filePath = node.id; // Assuming node.id is the full path
      return !ignoreRegexes.some(regex => regex.test(filePath));
    });

    const ignoredCount = selectedNodes.length - filteredNodes.length;

    if (filteredNodes.length === 0) {
      // If all files are ignored or none selected initially, update progress text and provide feedback
      const message = selectedNodes.length > 0 // Check if files were selected initially
        ? `All ${ignoredCount} selected file(s) were ignored.`
        : 'No files selected to copy.';
      displayProgressFeedback(message, false); // Not a success case
      return;
    }

    // Show fetching progress state (spinner visible initially)
    fileActionsDiv.style.display = 'none'; // Hide actions
    treeContainer.style.display = 'none'; // Hide tree
    fetchProgressDiv.style.display = 'flex'; // Show progress indicator
    fetchProgressDiv.querySelector('.spinner').style.display = ''; // Ensure spinner IS visible
    const progressText = document.getElementById('fetch-progress-text');
    document.getElementById('success-icon').style.display = 'none'; // Ensure icon is hidden when fetching starts
    progressText.textContent = `Fetching ${filteredNodes.length} file contents...`;
    // Clear any previous buttons in progress div (e.g., from error state)
    const oldBackButton = fetchProgressDiv.querySelector('button');
    if (oldBackButton) oldBackButton.remove();

    try {
      // Check if file tree should be included
      const includeFileTreeResult = await chrome.storage.sync.get("includeFileTree");
      const includeFileTree = includeFileTreeResult.includeFileTree || false;

      // Generate file tree if needed
      let fileTreeContent = '';
      if (includeFileTree) {
        // Extract file paths from the selected files instead of all files
        const selectedFilePaths = filteredNodes.map(node => node.id);
        fileTreeContent = generateFileTreeStructure(currentRepoData.name, selectedFilePaths);
      }

      // Fetch contents for each FILTERED file
      const fileContents = await Promise.all(filteredNodes.map(async (node) => {
        const content = await fetchFileContent(currentRepoData.owner, currentRepoData.name, node.id, currentRepoData.branch);
        return `## File: ${node.id}\n\`\`\`\n${content}\n\`\`\``;
      }));

      // Combine file tree and file contents
      let combinedContent = '';
      if (includeFileTree && fileTreeContent) {
        combinedContent = `## File Tree Structure\n\n\`\`\`\n${fileTreeContent}\n\`\`\`\n\n${fileContents.join('\n\n')}`;
      } else {
        combinedContent = fileContents.join('\n\n');
      }

      await navigator.clipboard.writeText(combinedContent);

      // Show success feedback in the progress div using the helper
      const successMessage = `Successfully copied ${filteredNodes.length} files to clipboard!${ignoredCount > 0 ? ` (${ignoredCount} ignored)` : ''}`;
      displayProgressFeedback(successMessage, true); // Indicate success

    } catch (error) {
      console.error('Error fetching files:', error);
      displayProgressFeedback(error.message, false); // Not a success case
    }
  };

  // Function to generate file tree structure in the desired format
  function generateFileTreeStructure(repoName, filePaths) {
    if (!filePaths || filePaths.length === 0) return '';

    // Sort paths to ensure consistent order
    filePaths.sort();

    // Build tree structure
    const tree = {};
    filePaths.forEach(path => {
      // Split path into components
      const parts = path.split('/');
      let current = tree;

      // Build tree structure
      parts.forEach(part => {
        if (!current[part]) {
          current[part] = {};
        }
        current = current[part];
      });
    });

    // Generate the formatted tree string
    return formatTree(repoName, tree);
  }

  // Function to format the tree structure as a string
  function formatTree(name, node, prefix = '', isLast = true) {
    // Start with the root node
    let result = `${prefix}${isLast ? '└── ' : '├── '}${name}${Object.keys(node).length > 0 ? '/' : ''}\n`;

    // Process children
    const keys = Object.keys(node).sort((a, b) => {
      // Directories (with children) come first, then files
      const aIsDir = Object.keys(node[a]).length > 0;
      const bIsDir = Object.keys(node[b]).length > 0;

      if (aIsDir && !bIsDir) return -1;
      if (!aIsDir && bIsDir) return 1;

      // Alphabetical order within the same type
      return a.localeCompare(b);
    });

    keys.forEach((key, index) => {
      const isLastChild = index === keys.length - 1;
      const newPrefix = prefix + (isLast ? '    ' : '│   ');
      result += formatTree(key, node[key], newPrefix, isLastChild);
    });

    return result;
  }

}

document.addEventListener('DOMContentLoaded', initializePopup);
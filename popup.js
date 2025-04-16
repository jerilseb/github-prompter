// popup.js - Simplified GitHub repository tree viewer
import { fetchRepoInfo, fetchBranchInfo, fetchRepoTree, fetchFileContent } from './githubApi.js';

document.addEventListener('DOMContentLoaded', function() {
  // Get UI elements
  const repoInput = document.getElementById('repo-input');
  const cloneBtn = document.getElementById('clone-btn');
  const treeContainer = document.getElementById('tree-container');
  const loadingIndicator = document.getElementById('loading-indicator');
  const settingsBtn = document.getElementById('settings-btn');
  
  // Add settings button click handler
  settingsBtn.addEventListener('click', function() {
    chrome.runtime.openOptionsPage();
  });
  
  // Create button container
  const buttonContainer = document.createElement('div');
  buttonContainer.className = 'button-container';
  treeContainer.after(buttonContainer);
  
  // Create and add print button
  const printBtn = document.createElement('button');
  printBtn.id = 'print-btn';
  printBtn.textContent = 'Copy Files to Clipboard';
  printBtn.style.display = 'none';
  printBtn.className = 'btn btn-primary';
  buttonContainer.appendChild(printBtn);
  
  let currentTree = null; // Store tree instance
  
  // Auto-fill repository URL if on GitHub
  chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
    const url = tabs[0].url;
    if (url.match(/https:\/\/github\.com\/[^\/]+\/[^\/]+/)) {
      repoInput.value = url;
    }
  });
  
  // Handle the Clone button click
  cloneBtn.addEventListener('click', async function() {
    const repoUrl = repoInput.value.trim();
    
    // Validate the input
    if (!repoUrl || !repoUrl.match(/https:\/\/github\.com\/[^\/]+\/[^\/]+/)) {
      treeContainer.innerHTML = `
        <div class="output-container">
          <div class="error-message">
            Please enter a valid GitHub repository URL
          </div>
        </div>
      `;
      return;
    }
    
    // Extract repository information
    const urlParts = repoUrl.replace('https://github.com/', '').split('/');
    const owner = urlParts[0];
    const repo = urlParts[1];
    // Use specified branch from URL if available, otherwise we'll fetch default branch
    const specifiedBranch = urlParts.length > 3 && urlParts[2] === 'tree' ? urlParts[3] : null;
    
    // Show loading indicator
    treeContainer.style.display = 'none';
    loadingIndicator.style.display = 'block';
    
    try {
      // First, get the repository info to get the default branch
      const repoData = await fetchRepoInfo(owner, repo);
      // Use specified branch from URL or fall back to default branch
      const branch = specifiedBranch || repoData.default_branch;

      // Get the commit SHA for the branch
      const branchData = await fetchBranchInfo(owner, repo, branch);
      const commitSha = branchData.commit.sha;
      
      // Then get the tree with recursive option
      const treeData = await fetchRepoTree(owner, repo, commitSha);
      
      // Convert to tree format and display
      showTreeView(processGitTree(treeData.tree), { owner, name: repo, branch });
      
    } catch (error) {
      console.error('Error:', error);
      let errorMessage = error.message;
      if (error.message.includes('403')) {
        errorMessage = 'API rate limit exceeded. To increase the limit, add a GitHub token in the Settings (⚙️).';
      }
      treeContainer.innerHTML = `
        <div class="output-container">
          <div class="error-message">
            Error fetching repository: ${errorMessage}
          </div>
        </div>
      `;
    } finally {
      loadingIndicator.style.display = 'none';
      treeContainer.style.display = 'block';
    }
  });
  
  // Process Git Tree data into hierarchical structure
  function processGitTree(items) {
    if (!Array.isArray(items)) {
      console.error('Invalid items:', items);
      return [];
    }

    const root = {};
    
    // Sort items to ensure directories come before files
    items.sort((a, b) => {
      if (a.type === 'tree' && b.type === 'blob') return -1;
      if (a.type === 'blob' && b.type === 'tree') return 1;
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
        
        if (isLastPart) {
          // It's a file or empty directory
          current[part] = {
            id: currentPath,
            text: part,
            type: item.type === 'tree' ? 'directory' : 'file',
            children: {}
          };
        } else {
          // It's a directory
          if (!current[part]) {
            current[part] = {
              id: currentPath,
              text: part,
              type: 'directory',
              children: {}
            };
          }
          current = current[part].children;
        }
      }
    });
    
    // Convert the tree structure to Tree.js format
    function convertToTreeFormat(node) {
      if (!node) return [];
      
      return Object.entries(node).map(([key, item]) => ({
        id: item.id,
        text: item.text,
        children: item.children ? convertToTreeFormat(item.children) : [],
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
    // Clear existing tree container
    treeContainer.innerHTML = '<div id="repo-tree"></div>';
    
    // Create root node
    const rootNode = {
      id: 'root',
      text: `${repository.owner}/${repository.name} (${repository.branch})`,
      children: treeData,
      attributes: {
        type: 'directory'
      }
    };
    
    // Initialize tree
    try {
      const tree = new Tree('#repo-tree', {
        data: [rootNode],
        closeDepth: 1,
        loaded: function() {
          // Add custom classes to nodes
          const nodes = document.querySelectorAll('#repo-tree .tree-node');
          nodes.forEach(node => {
            const nodeData = this.getNodeById(node.getAttribute('data-id'));
            if (nodeData && nodeData.attributes) {
              node.classList.add(nodeData.attributes.type);
            }
          });
          
          // Show print button after tree is loaded
          printBtn.style.display = 'block';
        },
        onChange: function() {
          // Update selected files count in print button
          const selectedCount = this.selectedNodes.filter(node => 
            node.attributes && node.attributes.type === 'file'
          ).length;
          printBtn.textContent = `Copy ${selectedCount} Files to Clipboard`;
        }
      });

      // Store tree instance
      currentTree = tree;
      
      // Handle print button click
      printBtn.onclick = async function() {
        if (!currentTree) return;
        
        // Get selected file nodes
        const selectedFiles = currentTree.selectedNodes.filter(node => 
          node.attributes && node.attributes.type === 'file'
        );
        
        if (selectedFiles.length === 0) {
          treeContainer.innerHTML = `
            <div class="output-container">
              <div class="error-message">
                Please select at least one file to copy
              </div>
              <div class="button-container">
                <button id="back-btn" class="btn btn-secondary">Back to Tree View</button>
              </div>
            </div>
          `;
          
          // Handle back button
          document.getElementById('back-btn').onclick = function() {
            showTreeView(treeData, repository);
            printBtn.style.display = 'block';
          };
          return;
        }

        // Show loading state
        treeContainer.innerHTML = `
          <div class="output-container">
            <div id="loading-indicator">Fetching file contents...</div>
          </div>
        `;
        printBtn.style.display = 'none';

        try {
          // Fetch contents for each file
          const fileContents = await Promise.all(selectedFiles.map(async (node) => {
            const content = await fetchFileContent(repository.owner, repository.name, node.id, repository.branch);
            return `=============\n${node.id}\n\`\`\`\n${content}\n\`\`\``;
          }));

          // Combine all contents
          const combinedContent = fileContents.join('\n\n');

          // Copy to clipboard
          await navigator.clipboard.writeText(combinedContent);

          // Show only list of copied files
          const fileList = selectedFiles.map(node => node.id).join('\n');
          treeContainer.innerHTML = `
            <div class="output-container">
              <div class="success-message">Successfully copied these files to clipboard:</div>
              <pre class="selected-paths">${fileList}</pre>
              <div class="button-container">
                <button id="back-btn" class="btn btn-secondary">Back to Tree View</button>
              </div>
            </div>
          `;

          // Show success notification
          const notification = document.createElement('div');
          notification.className = 'success-notification';
          notification.textContent = 'Copied to clipboard!';
          document.body.appendChild(notification);
          setTimeout(() => notification.remove(), 3000);

        } catch (error) {
          console.error('Error fetching files:', error);
          let errorMessage = error.message;
          if (error.message.includes('403')) {
            errorMessage = 'API rate limit exceeded. To increase the limit, add a GitHub token in the Settings (⚙️).';
          }
          treeContainer.innerHTML = `
            <div class="output-container">
              <div class="error-message">
                Error fetching file contents: ${errorMessage}
              </div>
              <div class="button-container">
                <button id="back-btn" class="btn btn-secondary">Back to Tree View</button>
              </div>
            </div>
          `;
        }

        // Handle back button
        document.getElementById('back-btn').onclick = function() {
          // Restore tree view
          showTreeView(treeData, repository);
          printBtn.style.display = 'block';
        };
      };
      
    } catch (error) {
      console.error('Error initializing tree:', error);
      treeContainer.innerHTML = `
        <div class="output-container">
          <div class="error-message">
            Error displaying repository structure: ${error.message}
          </div>
        </div>
      `;
      printBtn.style.display = 'none';
    }
  }
});
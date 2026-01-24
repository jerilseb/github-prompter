document.addEventListener('DOMContentLoaded', function() {
  const tokenInput = document.getElementById('github-token');
  const ignorePatternsInput = document.getElementById('ignore-patterns');
  const saveButton = document.getElementById('save-settings');
  const removeButton = document.getElementById('remove-token');
  const statusMessage = document.getElementById('status-message');
  const patInstructions = document.getElementById('pat-instructions');
  const includeFileTreeCheckbox = document.getElementById('include-file-tree');
  const savedReposList = document.getElementById('saved-repos-list');
  const savedReposCount = document.getElementById('saved-repos-count');

  // Function to toggle clear button visibility
  function toggleClearButtonVisibility() {
    if (tokenInput.value.trim() === '') {
      removeButton.style.display = 'none';
    } else {
      removeButton.style.display = 'inline-block'; // Or 'block', depending on desired layout
    }
  }

  // Load existing settings
  chrome.storage.sync.get(['githubToken', 'ignorePatterns', 'includeFileTree'], function(result) {
    if (result.githubToken) {
      tokenInput.value = result.githubToken;
    }
    if (result.ignorePatterns) {
      ignorePatternsInput.value = result.ignorePatterns;
    }
    includeFileTreeCheckbox.checked = result.includeFileTree || false;
    // Set initial button visibility
    toggleClearButtonVisibility();
  });

  // Add event listener to token input
  tokenInput.addEventListener('input', toggleClearButtonVisibility);

  // Save settings
  saveButton.addEventListener('click', function() {
    const token = tokenInput.value.trim();
    const ignorePatterns = ignorePatternsInput.value.trim();
    const includeFileTree = includeFileTreeCheckbox.checked;

    // Save all settings
    chrome.storage.sync.set({ githubToken: token, ignorePatterns: ignorePatterns, includeFileTree: includeFileTree }, function() {
      // Check for errors
      if (chrome.runtime.lastError) {
        showStatus(`Error saving settings: ${chrome.runtime.lastError.message}`, 'error');
      } else {
        showStatus('Settings saved successfully!', 'success');
      }
    });
  });

  // Remove token
  removeButton.addEventListener('click', function() {
    // We only remove the token, not the ignore patterns
    chrome.storage.sync.remove('githubToken', function() {
      tokenInput.value = '';
      // Hide button after clearing
      toggleClearButtonVisibility();
    });
  });

  // Helper function to show status messages
  function showStatus(message, type) {
    statusMessage.textContent = message;
    statusMessage.className = `status-message ${type}`;
    setTimeout(() => {
      statusMessage.textContent = '';
      statusMessage.className = 'status-message';
    }, 3000);
  }

  // Add keyboard shortcut for saving (Ctrl+S or Cmd+S)
  document.addEventListener('keydown', function(event) {
    if (event.ctrlKey && event.key === 's') {
      event.preventDefault(); // Prevent the browser's default save action
      saveButton.click(); // Trigger the save button click
    }
  });

  // Load and display saved repositories
  loadSavedRepos();

  function loadSavedRepos() {
    chrome.storage.local.get(null, function(items) {
      const savedRepos = [];

      for (const key in items) {
        if (key.startsWith('selections:')) {
          const repoName = key.replace('selections:', '');
          const fileCount = Array.isArray(items[key]) ? items[key].length : 0;
          savedRepos.push({ key, repoName, fileCount });
        }
      }

      savedReposCount.textContent = savedRepos.length;

      if (savedRepos.length === 0) {
        savedReposList.innerHTML = '<p class="no-repos-message">No saved selections yet.</p>';
        return;
      }

      savedRepos.sort((a, b) => a.repoName.localeCompare(b.repoName));

      savedReposList.innerHTML = savedRepos.map(repo => `
        <div class="saved-repo-item" data-key="${repo.key}">
          <div>
            <span class="saved-repo-name">${repo.repoName}</span>
            <span class="saved-repo-files">${repo.fileCount} file${repo.fileCount !== 1 ? 's' : ''}</span>
          </div>
          <button class="delete-repo-btn" title="Delete saved selection">&times;</button>
        </div>
      `).join('');

      // Add delete handlers
      savedReposList.querySelectorAll('.delete-repo-btn').forEach(btn => {
        btn.addEventListener('click', function() {
          const item = this.closest('.saved-repo-item');
          const key = item.dataset.key;
          deleteRepo(key);
        });
      });
    });
  }

  function deleteRepo(key) {
    chrome.storage.local.remove(key, function() {
      if (chrome.runtime.lastError) {
        showStatus(`Error deleting: ${chrome.runtime.lastError.message}`, 'error');
      } else {
        loadSavedRepos();
        showStatus('Selection deleted.', 'success');
      }
    });
  }
}); 
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
  const exportSelectionsButton = document.getElementById('export-selections');
  const importSelectionsButton = document.getElementById('import-selections');
  const importFileInput = document.getElementById('import-file-input');

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

  exportSelectionsButton.addEventListener('click', exportSelections);
  importSelectionsButton.addEventListener('click', function() {
    importFileInput.click();
  });
  importFileInput.addEventListener('change', importSelections);

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
          const repoName = item.querySelector('.saved-repo-name')?.textContent || key.replace('selections:', '');
          deleteRepo(key, repoName);
        });
      });
    });
  }

  function getSelectionEntries(items) {
    const entries = {};

    for (const [key, value] of Object.entries(items)) {
      if (key.startsWith('selections:') && Array.isArray(value)) {
        entries[key] = value;
      }
    }

    return entries;
  }

  function exportSelections() {
    chrome.storage.local.get(null, function(items) {
      if (chrome.runtime.lastError) {
        showStatus(`Error exporting: ${chrome.runtime.lastError.message}`, 'error');
        return;
      }

      const selections = getSelectionEntries(items);
      const selectionCount = Object.keys(selections).length;
      const payload = {
        format: 'github-prompter-selections',
        version: 1,
        exportedAt: new Date().toISOString(),
        selections
      };

      const fileNameDate = new Date().toISOString().slice(0, 10);
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `github-prompter-selections-${fileNameDate}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      showStatus(`Exported ${selectionCount} saved selection${selectionCount !== 1 ? 's' : ''}.`, 'success');
    });
  }

  function importSelections(event) {
    const [file] = event.target.files || [];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(loadEvent) {
      try {
        const rawText = String(loadEvent.target?.result || '');
        const parsed = JSON.parse(rawText);
        const importedSelections = extractImportedSelections(parsed);
        const importedKeys = Object.keys(importedSelections);

        if (importedKeys.length === 0) {
          showStatus('No valid saved selections found in the selected file.', 'error');
          return;
        }

        mergeSelections(importedSelections);
      } catch (error) {
        showStatus(`Import failed: ${error.message}`, 'error');
      } finally {
        importFileInput.value = '';
      }
    };

    reader.onerror = function() {
      showStatus('Failed to read file.', 'error');
      importFileInput.value = '';
    };

    reader.readAsText(file);
  }

  function extractImportedSelections(payload) {
    if (!payload || typeof payload !== 'object') {
      throw new Error('File must contain a JSON object.');
    }

    let source = payload;
    if (payload.format === 'github-prompter-selections') {
      if (payload.version !== 1) {
        throw new Error('Unsupported export version.');
      }
      source = payload.selections;
    }

    if (!source || typeof source !== 'object') {
      throw new Error('File does not contain valid selections.');
    }

    const selections = {};
    for (const [key, value] of Object.entries(source)) {
      if (key.startsWith('selections:') && Array.isArray(value)) {
        selections[key] = value;
      }
    }

    return selections;
  }

  function mergeSelections(selections) {
    chrome.storage.local.set(selections, function() {
      if (chrome.runtime.lastError) {
        showStatus(`Import failed: ${chrome.runtime.lastError.message}`, 'error');
      } else {
        loadSavedRepos();
        const importedCount = Object.keys(selections).length;
        showStatus(`Imported ${importedCount} selection${importedCount !== 1 ? 's' : ''} (merge).`, 'success');
      }
    });
  }

  function deleteRepo(key, repoName) {
    const confirmed = window.confirm(
      `Delete saved selection for "${repoName}"? This cannot be undone.`
    );

    if (!confirmed) {
      return;
    }

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

document.addEventListener('DOMContentLoaded', function() {
  const tokenInput = document.getElementById('github-token');
  const ignorePatternsInput = document.getElementById('ignore-patterns');
  const saveButton = document.getElementById('save-settings');
  const removeButton = document.getElementById('remove-token');
  const statusMessage = document.getElementById('status-message');
  const patInstructions = document.getElementById('pat-instructions');

  // Function to toggle clear button visibility
  function toggleClearButtonVisibility() {
    if (tokenInput.value.trim() === '') {
      removeButton.style.display = 'none';
    } else {
      removeButton.style.display = 'inline-block'; // Or 'block', depending on desired layout
    }
  }

  // Load existing settings
  chrome.storage.sync.get(['githubToken', 'ignorePatterns'], function(result) {
    if (result.githubToken) {
      tokenInput.value = result.githubToken;
    }
    if (result.ignorePatterns) {
      ignorePatternsInput.value = result.ignorePatterns;
    }
    // Set initial button visibility
    toggleClearButtonVisibility();
  });

  // Add event listener to token input
  tokenInput.addEventListener('input', toggleClearButtonVisibility);

  // Save settings
  saveButton.addEventListener('click', function() {
    const token = tokenInput.value.trim();
    const ignorePatterns = ignorePatternsInput.value.trim();

    // Save both settings
    chrome.storage.sync.set({ githubToken: token, ignorePatterns: ignorePatterns }, function() {
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
}); 
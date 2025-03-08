document.addEventListener('DOMContentLoaded', function() {
  const tokenInput = document.getElementById('github-token');
  const saveButton = document.getElementById('save-token');
  const removeButton = document.getElementById('remove-token');
  const statusMessage = document.getElementById('status-message');

  // Load existing token if any
  chrome.storage.sync.get(['githubToken'], function(result) {
    if (result.githubToken) {
      tokenInput.value = result.githubToken;
    }
  });

  // Save token
  saveButton.addEventListener('click', function() {
    const token = tokenInput.value.trim();
    
    if (!token) {
      showStatus('Please enter a token', 'error');
      return;
    }

    chrome.storage.sync.set({ githubToken: token }, function() {
      showStatus('Token saved successfully!', 'success');
    });
  });

  // Remove token
  removeButton.addEventListener('click', function() {
    chrome.storage.sync.remove('githubToken', function() {
      tokenInput.value = '';
      showStatus('Token removed successfully!', 'success');
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
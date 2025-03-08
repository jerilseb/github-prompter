// Helper function to create fetch options with auth header if token exists
async function getFetchOptions() {
  const options = {
    headers: {
      'Accept': 'application/vnd.github.v3+json'
    }
  };
  
  return new Promise((resolve) => {
    chrome.storage.sync.get(['githubToken'], function(result) {
      if (result.githubToken) {
        options.headers['Authorization'] = `token ${result.githubToken}`;
      }
      resolve(options);
    });
  });
}

// Fetch repository information
async function fetchRepoInfo(owner, repo) {
  const options = await getFetchOptions();
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}`,
    options
  );
  
  if (!response.ok) {
    throw new Error(`Failed to fetch repository info: ${response.status}`);
  }
  
  return response.json();
}

// Fetch branch information
async function fetchBranchInfo(owner, repo, branch) {
  const options = await getFetchOptions();
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/branches/${branch}`,
    options
  );
  
  if (!response.ok) {
    throw new Error(`Failed to fetch branch info: ${response.status}`);
  }
  
  return response.json();
}

// Fetch repository tree
async function fetchRepoTree(owner, repo, commitSha) {
  const options = await getFetchOptions();
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/git/trees/${commitSha}?recursive=1`,
    options
  );
  
  if (!response.ok) {
    throw new Error(`Failed to fetch tree: ${response.status}`);
  }
  
  return response.json();
}

// Fetch file contents
async function fetchFileContent(owner, repo, path, branch) {
  const options = await getFetchOptions();
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`,
    options
  );
  
  if (!response.ok) {
    throw new Error(`Failed to fetch ${path}`);
  }
  
  const data = await response.json();
  return atob(data.content); // Decode base64 content
}

export {
  getFetchOptions,
  fetchRepoInfo,
  fetchBranchInfo,
  fetchRepoTree,
  fetchFileContent
}; 
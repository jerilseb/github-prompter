async function getFetchOptions() {
  const options = {
    headers: {
      'Accept': 'application/vnd.github.v3+json'
    }
  };

  return new Promise((resolve) => {
    chrome.storage.sync.get(['githubToken'], function (result) {
      if (result.githubToken) {
        options.headers['Authorization'] = `token ${result.githubToken}`;
      }
      resolve(options);
    });
  });
}

// Handle API response and throw appropriate errors
async function handleApiResponse(response) {
  
  if (response.status === 403) {
    const resetTimestamp = response.headers.get('x-ratelimit-reset');
    let waitMessage = '';
    if (resetTimestamp) {
      const resetTime = parseInt(resetTimestamp, 10) * 1000; // Convert to milliseconds
      const currentTime = Date.now();
      const waitSeconds = Math.max(0, Math.ceil((resetTime - currentTime) / 1000));
      const waitMinutes = Math.floor(waitSeconds / 60);
      const remainingSeconds = waitSeconds % 60;
      waitMessage = `Or, you need to wait ${waitMinutes} minutes and ${remainingSeconds} seconds for the rate limit to reset`;
    }
    throw new Error(`Github API rate limit exceeded. To get increased access to public repositories or access private ones, add a GitHub Token in the Settings (⚙️).\n\n${waitMessage}`);
  } else if (response.status === 404) {
    throw new Error('Repository not found. Check the URL or ensure you have access.');
  } else if (!response.ok) {
    throw new Error('Failed to fetch repository contents.');
  }

  return response.json();
}

// Fetch repository information
async function fetchRepoInfo(owner, repo) {
  const options = await getFetchOptions();
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}`,
    options
  );

  return handleApiResponse(response);
}

// Fetch branch information
async function fetchBranchInfo(owner, repo, branch) {
  const options = await getFetchOptions();
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/branches/${branch}`,
    options
  );

  return handleApiResponse(response);
}

// Fetch repository tree
async function fetchRepoTree(owner, repo, branchOrCommitSha) {
  const options = await getFetchOptions();
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/git/trees/${branchOrCommitSha}?recursive=1`,
    options
  );

  return handleApiResponse(response);
}

// Fetch file contents
async function fetchFileContent(owner, repo, path, branch) {
  const options = await getFetchOptions();
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`,
    options
  );

  const data = await handleApiResponse(response);
  return atob(data.content); // Decode base64 content
}

export {
  getFetchOptions,
  fetchRepoInfo,
  fetchBranchInfo,
  fetchRepoTree,
  fetchFileContent
}; 
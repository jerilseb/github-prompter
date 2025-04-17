const API_RATE_LIMIT_ERROR = 'API rate limit exceeded or private repository access denied. To increase the limit for public repositories or access private ones, add a GitHub Token in the Settings (⚙️).';
const REPO_NOT_FOUND_ERROR = 'Repository not found. Check the URL or ensure you have access.';
const GENERIC_ERROR = 'Failed to fetch repository contents.';


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
    throw new Error(API_RATE_LIMIT_ERROR);
  } else if (response.status === 404) {
    throw new Error(REPO_NOT_FOUND_ERROR);
  } else if (!response.ok) {
    throw new Error(GENERIC_ERROR);
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
async function fetchRepoTree(owner, repo, commitSha) {
  const options = await getFetchOptions();
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/git/trees/${commitSha}?recursive=1`,
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
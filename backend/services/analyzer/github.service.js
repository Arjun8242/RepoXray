const GITHUB_API_BASE = "https://api.github.com";

function trimGitSuffix(value) {
  return value.endsWith(".git") ? value.slice(0, -4) : value;
}

export function parseGitHubRepoUrl(repoUrl) {
  if (!repoUrl || typeof repoUrl !== "string") {
    throw new Error("repoUrl is required and must be a string.");
  }

  let url;
  try {
    url = new URL(repoUrl.trim());
  } catch {
    throw new Error("Invalid repository URL.");
  }

  if (url.hostname !== "github.com") {
    throw new Error("Only github.com repository URLs are supported.");
  }

  const [owner, repoRaw] = url.pathname.split("/").filter(Boolean);
  const repo = repoRaw ? trimGitSuffix(repoRaw) : "";

  if (!owner || !repo) {
    throw new Error("Repository URL must include owner and repository name.");
  }

  return { owner, repo };
}

function buildHeaders() {
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "repoxray",
  };

  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  return headers;
}

async function githubRequest(pathname) {
  const response = await fetch(`${GITHUB_API_BASE}${pathname}`, {
    headers: buildHeaders(),
  });

  if (!response.ok) {
    const text = await response.text();
    const detail = text ? ` ${text.slice(0, 200)}` : "";
    const error = new Error(`GitHub API request failed (${response.status}).${detail}`);
    error.status = response.status;
    throw error;
  }

  return response.json();
}

export async function fetchRepositorySnapshot(repoUrl, branch) {
  const { owner, repo } = parseGitHubRepoUrl(repoUrl);
  const repoInfo = await githubRequest(`/repos/${owner}/${repo}`);
  const targetBranch = branch || repoInfo.default_branch;

  const treeResponse = await githubRequest(
    `/repos/${owner}/${repo}/git/trees/${encodeURIComponent(targetBranch)}?recursive=1`
  );

  const files = (treeResponse.tree || []).filter((entry) => entry.type === "blob");

  return {
    owner,
    repo,
    repoName: repoInfo.full_name || `${owner}/${repo}`,
    branch: targetBranch,
    files,
  };
}

export async function fetchFileContent({ owner, repo, branch, filePath }) {
  const encodedPath = filePath
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");

  const contentResponse = await githubRequest(
    `/repos/${owner}/${repo}/contents/${encodedPath}?ref=${encodeURIComponent(branch)}`
  );

  if (!contentResponse || !contentResponse.content) {
    return null;
  }

  const decoded = Buffer.from(contentResponse.content, "base64").toString("utf8");
  return {
    path: filePath,
    content: decoded,
    size: contentResponse.size || decoded.length,
  };
}

export async function fetchManyFileContents({ owner, repo, branch, filePaths }) {
  const settled = await Promise.allSettled(
    filePaths.map((filePath) => fetchFileContent({ owner, repo, branch, filePath }))
  );

  const files = [];
  const errors = [];

  for (let i = 0; i < settled.length; i++) {
    const result = settled[i];
    if (result.status === "fulfilled") {
      if (result.value) {
        files.push(result.value);
      }
      continue;
    }

    errors.push({
      filePath: filePaths[i],
      message: result.reason?.message || "Failed to fetch file",
    });
  }

  return { files, errors };
}

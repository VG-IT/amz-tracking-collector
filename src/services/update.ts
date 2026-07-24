const GITHUB_REPO = "VG-IT/amz-tracking-collector";
const RELEASES_LATEST_URL = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;

export type ExtensionUpdate = {
  version: string;
  zipUrl: string | null;
  htmlUrl: string;
  notes: string;
};

type GithubRelease = {
  tag_name?: string;
  html_url?: string;
  body?: string | null;
  assets?: Array<{
    name?: string;
    browser_download_url?: string;
  }>;
};

function parseVersion(raw: string): number[] | null {
  const cleaned = raw.trim().replace(/^v/i, "");
  if (!/^\d+\.\d+\.\d+$/.test(cleaned)) return null;
  return cleaned.split(".").map((part) => Number(part));
}

/** Returns true if `remote` is strictly newer than `local`. */
export function isNewerVersion(local: string, remote: string): boolean {
  const a = parseVersion(local);
  const b = parseVersion(remote);
  if (!a || !b) return false;
  for (let i = 0; i < 3; i++) {
    if (b[i] > a[i]) return true;
    if (b[i] < a[i]) return false;
  }
  return false;
}

export function getInstalledVersion(): string {
  try {
    return chrome.runtime.getManifest().version;
  } catch {
    return "0.0.0";
  }
}

export async function checkForUpdate(): Promise<ExtensionUpdate | null> {
  const localVersion = getInstalledVersion();

  const response = await fetch(RELEASES_LATEST_URL, {
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  if (!response.ok) {
    throw new Error(`GitHub release check failed: HTTP ${response.status}`);
  }

  const release = (await response.json()) as GithubRelease;
  const remoteVersion = (release.tag_name || "").replace(/^v/i, "");
  if (!isNewerVersion(localVersion, remoteVersion)) return null;

  const zipAsset =
    (release.assets || []).find((asset) =>
      (asset.name || "").endsWith(`amz-tracking-collector-${remoteVersion}.zip`),
    ) ||
    (release.assets || []).find((asset) => (asset.name || "").endsWith(".zip"));

  return {
    version: remoteVersion,
    zipUrl: zipAsset?.browser_download_url || null,
    htmlUrl:
      release.html_url ||
      `https://github.com/${GITHUB_REPO}/releases/latest`,
    notes: (release.body || "").trim(),
  };
}

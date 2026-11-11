export const APK_NAME = "VietLingo-HU-Android.apk";
export const UPDATE_INTERVAL = 24 * 60 * 60 * 1000;
export type Repository = { owner: string; repo: string };
export type UpdateResult =
  | { status: "available"; version: string; url: string }
  | { status: "latest" }
  | {
      status:
        | "offline"
        | "rateLimit"
        | "invalidConfiguration"
        | "unavailable"
        | "unauthorized";
    };

export function parseRepository(input: string): Repository | null {
  const match =
    /^(?:https:\/\/github\.com\/)?([A-Za-z0-9](?:[A-Za-z0-9-]{0,38}))\/([A-Za-z0-9_.-]{1,100})\/?$/.exec(
      input.trim(),
    );
  if (!match || match[2] === "." || match[2] === "..") return null;
  return { owner: match[1], repo: match[2] };
}

export function parseVersion(value: string): number[] | null {
  const match = /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(value);
  if (!match) return null;
  const parts = match.slice(1).map(Number);
  return parts.every(Number.isSafeInteger) ? parts : null;
}

export function isNewerVersion(candidate: string, current: string): boolean {
  const next = parseVersion(candidate);
  const previous = parseVersion(current);
  if (!next || !previous) return false;
  for (let i = 0; i < 3; i++) {
    if (next[i] !== previous[i]) return next[i] > previous[i];
  }
  return false;
}

export function verifiedApkUrl(
  value: unknown,
  repository: Repository,
  tag: string,
): string | null {
  if (typeof value !== "string" || !parseVersion(tag)) return null;
  const expected = `https://github.com/${repository.owner}/${repository.repo}/releases/download/${tag}/${APK_NAME}`;
  // Exact matching also excludes credentials, alternate hosts, queries and encoded traversal.
  return value === expected ? value : null;
}

export async function checkForUpdate(
  repositoryInput: string,
  currentVersion: string,
  fetchImpl: typeof fetch = fetch,
  signal?: AbortSignal,
  token = "",
): Promise<UpdateResult> {
  const repository = parseRepository(repositoryInput);
  if (!repository || !parseVersion(currentVersion))
    return { status: "invalidConfiguration" };
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort, { once: true });
  if (signal?.aborted) controller.abort();
  const timeout = setTimeout(abort, 8000);
  try {
    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json",
    };
    if (token.trim()) headers.Authorization = `Bearer ${token.trim()}`;
    const response = await fetchImpl(
      `https://api.github.com/repos/${repository.owner}/${repository.repo}/releases/latest`,
      {
        headers,
        signal: controller.signal,
        credentials: "omit",
        redirect: "error",
      },
    );
    if (response.status === 401) return { status: "unauthorized" };
    if (
      response.status === 429 ||
      (response.status === 403 &&
        (response.headers.get("x-ratelimit-remaining") === "0" ||
          response.headers.has("retry-after")))
    )
      return { status: "rateLimit" };
    if (response.status === 403) return { status: "unauthorized" };
    if (response.status === 404) return { status: "invalidConfiguration" };
    if (!response.ok) return { status: "unavailable" };
    let release: unknown;
    try {
      release = await response.json();
    } catch {
      return { status: "unavailable" };
    }
    if (!release || typeof release !== "object")
      return { status: "unavailable" };
    const data = release as Record<string, unknown>;
    if (
      data.draft !== false ||
      data.prerelease !== false ||
      typeof data.tag_name !== "string" ||
      !parseVersion(data.tag_name)
    ) {
      return { status: "unavailable" };
    }
    if (!isNewerVersion(data.tag_name, currentVersion))
      return { status: "latest" };
    const asset = Array.isArray(data.assets)
      ? data.assets.find(
          (item: unknown) =>
            item &&
            typeof item === "object" &&
            (item as Record<string, unknown>).name === APK_NAME,
        )
      : undefined;
    const url = verifiedApkUrl(
      asset?.browser_download_url,
      repository,
      data.tag_name,
    );
    return url
      ? { status: "available", version: data.tag_name.replace(/^v/, ""), url }
      : { status: "unavailable" };
  } catch {
    return { status: "offline" };
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", abort);
  }
}

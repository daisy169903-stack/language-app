import test from "node:test";
import assert from "node:assert/strict";
import {
  APK_NAME,
  checkForUpdate,
  isNewerVersion,
  parseRepository,
  parseVersion,
  verifiedApkUrl,
} from "../src/updates";

const repository = { owner: "example", repo: "vietlingo" };
const apk = `https://github.com/example/vietlingo/releases/download/v0.3.0/${APK_NAME}`;
const release = {
  tag_name: "v0.3.0",
  draft: false,
  prerelease: false,
  assets: [{ name: APK_NAME, browser_download_url: apk }],
};
function mockFetch(body: unknown, status = 200): typeof fetch {
  return (async () =>
    new Response(JSON.stringify(body), { status })) as typeof fetch;
}

test("repository accepts owner/repo and HTTPS GitHub URL only", () => {
  assert.deepEqual(parseRepository(" example/vietlingo "), repository);
  assert.deepEqual(
    parseRepository("https://github.com/example/vietlingo/"),
    repository,
  );
  for (const value of [
    "http://github.com/example/vietlingo",
    "https://evil.test/example/vietlingo",
    "example/..",
    "example/vietlingo?x=y",
    "https://github.com@example.test/a/b",
    "example/vietlingo/releases",
    "example/",
  ]) {
    assert.equal(parseRepository(value), null, value);
  }
});

test("versions compare numerically and reject pre-releases or malformed tags", () => {
  assert.equal(isNewerVersion("v0.10.0", "0.9.9"), true);
  assert.equal(isNewerVersion("1.0.0", "0.99.99"), true);
  assert.equal(isNewerVersion("0.3.0", "0.3.0"), false);
  assert.equal(isNewerVersion("0.2.99", "0.3.0"), false);
  for (const value of [
    "0.3",
    "v0.3.0-beta.1",
    "01.2.3",
    "0.3.0+meta",
    "9007199254740992.0.0",
  ])
    assert.equal(parseVersion(value), null);
});

test("only exact repository release APK download links are accepted", () => {
  assert.equal(verifiedApkUrl(apk, repository, "v0.3.0"), apk);
  for (const value of [
    "javascript:alert(1)",
    apk.replace("github.com", "evil.test"),
    apk.replace("/example/", "/other/"),
    `${apk}?redirect=evil`,
    apk.replace("v0.3.0", "v0.4.0"),
    apk.replace("https://", "http://"),
    apk.replace("github.com/", "github.com@evil.test/"),
  ]) {
    assert.equal(verifiedApkUrl(value, repository, "v0.3.0"), null);
  }
});

test("stable newer release returns verified APK without sending credentials", async () => {
  let requested = "";
  const fetchImpl = (async (url, options) => {
    requested = String(url);
    assert.equal(options?.credentials, "omit");
    assert.equal(options?.redirect, "error");
    assert.equal(new Headers(options?.headers).has("Authorization"), false);
    return new Response(JSON.stringify(release));
  }) as typeof fetch;
  assert.deepEqual(
    await checkForUpdate("example/vietlingo", "0.2.0", fetchImpl),
    { status: "available", version: "0.3.0", url: apk },
  );
  assert.equal(
    requested,
    "https://api.github.com/repos/example/vietlingo/releases/latest",
  );
  assert.deepEqual(
    await checkForUpdate("example/vietlingo", "0.3.0", mockFetch(release)),
    { status: "latest" },
  );
});

test("private token is sent only to fixed GitHub API and invalid input makes no request", async () => {
  let calls = 0;
  const fetchImpl = (async (url, options) => {
    calls++;
    assert.equal(
      String(url),
      "https://api.github.com/repos/example/vietlingo/releases/latest",
    );
    assert.equal(
      new Headers(options?.headers).get("Authorization"),
      "Bearer private-read-token",
    );
    assert.equal(options?.redirect, "error");
    return new Response(JSON.stringify(release));
  }) as typeof fetch;
  assert.equal(
    (
      await checkForUpdate(
        "example/vietlingo",
        "0.2.0",
        fetchImpl,
        undefined,
        "private-read-token",
      )
    ).status,
    "available",
  );
  assert.equal(
    (
      await checkForUpdate(
        "https://evil.test/example/vietlingo",
        "0.2.0",
        fetchImpl,
        undefined,
        "private-read-token",
      )
    ).status,
    "invalidConfiguration",
  );
  assert.equal(calls, 1);
  assert.deepEqual(
    await checkForUpdate(
      "example/vietlingo",
      "0.2.0",
      mockFetch({}, 401),
      undefined,
      "expired",
    ),
    { status: "unauthorized" },
  );
});

test("draft, prerelease, missing asset and untrusted download are unavailable", async () => {
  for (const body of [
    { ...release, draft: true },
    { ...release, prerelease: true },
    { ...release, tag_name: "v0.4.0-beta" },
    { ...release, assets: [] },
    {
      ...release,
      assets: [
        { name: APK_NAME, browser_download_url: "https://evil.test/app.apk" },
      ],
    },
    null,
  ]) {
    assert.deepEqual(
      await checkForUpdate("example/vietlingo", "0.2.0", mockFetch(body)),
      { status: "unavailable" },
    );
  }
});

test("configuration, API failures, offline and malformed JSON have explicit outcomes", async () => {
  let calls = 0;
  const unreachable = (async () => {
    calls++;
    throw new TypeError("offline");
  }) as typeof fetch;
  assert.deepEqual(await checkForUpdate("invalid", "0.2.0", unreachable), {
    status: "invalidConfiguration",
  });
  assert.equal(calls, 0);
  assert.deepEqual(
    await checkForUpdate("example/vietlingo", "0.2.0", unreachable),
    { status: "offline" },
  );
  assert.deepEqual(
    await checkForUpdate("example/vietlingo", "0.2.0", mockFetch({}, 429)),
    { status: "rateLimit" },
  );
  assert.deepEqual(
    await checkForUpdate(
      "example/vietlingo",
      "0.2.0",
      (async () =>
        new Response("{}", {
          status: 403,
          headers: { "x-ratelimit-remaining": "0" },
        })) as typeof fetch,
    ),
    { status: "rateLimit" },
  );
  assert.deepEqual(
    await checkForUpdate("example/vietlingo", "0.2.0", mockFetch({}, 403)),
    { status: "unauthorized" },
  );
  assert.deepEqual(
    await checkForUpdate("example/vietlingo", "0.2.0", mockFetch({}, 404)),
    { status: "invalidConfiguration" },
  );
  assert.deepEqual(
    await checkForUpdate("example/vietlingo", "0.2.0", mockFetch({}, 503)),
    { status: "unavailable" },
  );
  assert.deepEqual(
    await checkForUpdate(
      "example/vietlingo",
      "0.2.0",
      (async () => new Response("bad json")) as typeof fetch,
    ),
    { status: "unavailable" },
  );
});

test("caller cancellation reaches fetch and does not leave an active timer", async () => {
  const controller = new AbortController();
  const fetchImpl = (async (_url, options) =>
    new Promise<Response>((_resolve, reject) => {
      options?.signal?.addEventListener(
        "abort",
        () => reject(new DOMException("Aborted", "AbortError")),
        { once: true },
      );
    })) as typeof fetch;
  const pending = checkForUpdate(
    "example/vietlingo",
    "0.2.0",
    fetchImpl,
    controller.signal,
  );
  controller.abort();
  assert.deepEqual(await pending, { status: "offline" });
});

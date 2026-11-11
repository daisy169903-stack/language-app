import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE || "playwright"
);
const browser = await chromium.launch({ channel: "msedge", headless: true });
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  reducedMotion: "reduce",
});
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
let auth = "";
let calls = 0;
await ctx.route("https://api.github.com/**", (route) => {
  calls++;
  auth = route.request().headers().authorization || "";
  return route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      draft: false,
      prerelease: false,
      tag_name: "v0.4.0",
      assets: [
        {
          name: "VietLingo-HU-Android.apk",
          browser_download_url:
            "https://github.com/daisy169903-stack/language-app/releases/download/v0.4.0/VietLingo-HU-Android.apk",
        },
      ],
    }),
  });
});
const wav = Buffer.alloc(8044);
wav.write("RIFF");
wav.writeUInt32LE(8036, 4);
wav.write("WAVE", 8);
wav.write("fmt ", 12);
wav.writeUInt32LE(16, 16);
wav.writeUInt16LE(1, 20);
wav.writeUInt16LE(1, 22);
wav.writeUInt32LE(16000, 24);
wav.writeUInt32LE(32000, 28);
wav.writeUInt16LE(2, 32);
wav.writeUInt16LE(16, 34);
wav.write("data", 36);
wav.writeUInt32LE(8000, 40);
for (let i = 0; i < 4000; i++)
  wav.writeInt16LE(
    Math.round(Math.sin((2 * Math.PI * 440 * i) / 16000) * 1200),
    44 + 2 * i,
  );
const clip = {
  id: "greeting.chao",
  candidateId: "test-1",
  text: "chào",
  mimeType: "audio/wav",
  sha256: createHash("sha256").update(wav).digest("hex"),
  dataBase64: wav.toString("base64"),
  source: {
    title: "Synthetic QA tone – NOT Vietnamese speech",
    url: "",
    license: "private-study",
    accent: "unknown",
  },
  review: { status: "pending" },
  confidence: 0.6,
  flags: ["manual-listening-required"],
};
const pack = {
  version: 1,
  kind: "vietlingo-audio-review",
  audience: "private",
  clips: [clip],
};
const file = (obj) => ({
  name: "synthetic-review.vlaudio.json",
  mimeType: "application/json",
  buffer: Buffer.from(JSON.stringify(obj)),
});
const nav = async (name) =>
  page
    .locator(".bottom-nav")
    .getByRole("button", { name, exact: true })
    .click();
try {
  await page.goto(process.env.APP_URL || "http://127.0.0.1:4173/");
  await page.getByRole("heading", { name: "Vietnámi tanulás" }).waitFor();
  await page
    .getByRole("status")
    .filter({ hasText: "Új verzió érhető el (0.4.0)" })
    .waitFor();
  assert.equal(calls, 1);
  assert.equal(auth, "");
  await nav("Profil");
  await page.getByRole("heading", { name: "Alkalmazásfrissítés" }).waitFor();
  await page.getByText("Új verzió érhető el: 0.4.0", { exact: true }).waitFor();
  await page
    .getByLabel("GitHub olvasási token (nem kötelező)")
    .fill("TEST_ONLY_NOT_A_REAL_CREDENTIAL");
  await page
    .getByRole("button", { name: "Token biztonságos mentése", exact: true })
    .click();
  await page
    .getByRole("status")
    .filter({ hasText: "Token elmentve." })
    .waitFor();
  await page.getByText("Új verzió érhető el: 0.4.0", { exact: true }).waitFor();
  assert.equal(auth, "Bearer TEST_ONLY_NOT_A_REAL_CREDENTIAL");
  assert.equal(
    await page.evaluate(() =>
      JSON.stringify(localStorage).includes("TEST_ONLY_NOT_A_REAL_CREDENTIAL"),
    ),
    false,
  );
  const uploader = page.locator(".audio-settings input[type=file]");
  await uploader.setInputFiles(file(pack));
  await page
    .getByRole("heading", { name: "Ellenőrzésre váró jelöltek" })
    .waitFor();
  const approve = page.getByRole("button", {
    name: "Ezt használom",
    exact: true,
  });
  assert.equal(await approve.isDisabled(), true);
  await page.locator(".review-confirm input").check();
  assert.equal(await approve.isDisabled(), true);
  await page.locator(".audio-candidate audio").evaluate(async (a) => {
    await a.play();
  });
  await approve.click();
  await page
    .getByRole("status")
    .filter({ hasText: "Elmentve: chào." })
    .waitFor();
  await nav("Kezdőlap");
  await page
    .getByRole("button", { name: "Az első szavam", exact: true })
    .click();
  await page.getByRole("heading", { name: "chào", exact: true }).waitFor();
  const player = page.locator(".lesson-audio audio");
  await player.evaluate(
    (a) =>
      new Promise((resolve, reject) => {
        a.onloadedmetadata = () => resolve();
        a.onerror = () => reject(Error("decode"));
        a.load();
      }),
  );
  assert.ok((await player.evaluate((a) => a.duration)) > 0);
  await player.evaluate((a) => a.play());
  await page.screenshot({ path: "qa/audio-player-synthetic.png" });
  await page
    .getByRole("button", { name: "Lecke bezárása", exact: true })
    .click();
  await nav("Profil");
  await uploader.setInputFiles(
    file({ ...pack, clips: [{ ...clip, sha256: "0".repeat(64) }] }),
  );
  await page
    .getByRole("status")
    .filter({ hasText: "ellenőrzőösszege nem egyezik" })
    .waitFor();
  assert.equal(await page.locator(".audio-saved-list>div").count(), 1);
  // The supplied free episode is tested as pending data only; never auto-approved.
  await uploader.setInputFiles("private-audio/vietlingo-review.vlaudio.json");
  await page.locator(".audio-candidate").first().waitFor();
  assert.equal(await page.locator(".audio-candidate").count(), 49);
  assert.equal(
    await page
      .getByRole("button", { name: "Ezt használom", exact: true })
      .first()
      .isDisabled(),
    true,
  );
  await page.locator(".audio-candidate").first().scrollIntoViewIfNeeded();
  await page.screenshot({ path: "qa/audio-review-real-pending.png" });
  await page.reload();
  await nav("Profil");
  await page.getByText("1 jóváhagyott felvétel.", { exact: false }).waitFor();
  await page
    .getByLabel("GitHub olvasási token (nem kötelező)")
    .getAttribute("placeholder")
    .then((p) => assert.notEqual(p, "Token már mentve"));
  assert.deepEqual(errors, []);
  console.log(
    "PASS: app-start update notification/private auth mocked, no browser token persistence, imported real49pendingclips withoutapproval, review gate requires playback+confirmation, WAV playback/IndexedDB persistence/corrupt pack protection. Approval/playback test used explicitly synthetic QA tone only.",
  );
} finally {
  await browser.close();
}

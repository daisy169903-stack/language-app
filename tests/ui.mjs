// Browser QA for the phone app UI; Android runtime checks are separate.
import assert from "node:assert/strict";
import { mkdir, readFile } from "node:fs/promises";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE || "playwright"
);
const browser = await chromium.launch({ channel: "msedge", headless: true });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  reducedMotion: "reduce",
});
let page = await context.newPage();
await context.route("https://api.github.com/**", (route) =>
  route.fulfill({ status: 404, contentType: "application/json", body: "{}" }),
);
const errors = [];
const remote = [];
const url = process.env.APP_URL || "http://127.0.0.1:4173/";
page.on("pageerror", (e) => errors.push(e.message));
page.on("request", (r) => {
  if (
    /^https?:/.test(r.url()) &&
    !r.url().startsWith(url) &&
    !r.url().startsWith("https://api.github.com/")
  )
    remote.push(r.url());
});
await mkdir("qa", { recursive: true });
const click = async (name) =>
  page.getByRole("button", { name, exact: true }).click();
const check = async () => {
  await click("Ellenőrzés");
  await page.getByRole("status").filter({ hasText: "Így van!" }).waitFor();
};
const next = async () => click("Következő");
const overflow = async () =>
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
    true,
    "horizontal overflow",
  );
const nav = async (name) =>
  page
    .locator(".bottom-nav")
    .getByRole("button", { name, exact: true })
    .click();
try {
  await page.goto(url);
  await page.getByRole("heading", { name: "Vietnámi tanulás" }).waitFor();
  await page.evaluate(() => document.fonts.ready);
  await overflow();
  await page.screenshot({ path: "qa/android-home.png", fullPage: true });
  await page.getByRole("button", { name: /1\. FEJEZET Ismerkedés/ }).click();
  await page
    .getByRole("heading", { name: "Először csak három kifejezés." })
    .waitFor();
  await page.screenshot({ path: "qa/android-chapter.png", fullPage: true });
  await page.getByRole("button", { name: /Az első három szavad/ }).click();
  await page.getByRole("heading", { name: "chào", exact: true }).waitFor();
  assert.equal(
    await page.getByRole("button", { name: "Ellenőrzés", exact: true }).count(),
    0,
    "no quiz before teaching",
  );
  assert.equal(
    await page.getByRole("textbox").count(),
    0,
    "no typing at the start",
  );
  await page.screenshot({ path: "qa/android-teaching.png", fullPage: true });
  await click("Kipróbálom");
  await click("szia");
  await check();
  await next();
  await page.reload();
  await click("Lecke folytatása");
  await page.getByRole("heading", { name: "cảm ơn", exact: true }).waitFor();
  await click("Kipróbálom");
  await click("köszönöm");
  await check();
  await next();
  await page.getByRole("heading", { name: "tạm biệt", exact: true }).waitFor();
  await click("Kipróbálom");
  await click("viszlát");
  await check();
  await next();
  for (const [vi, hu] of [
    ["chào", "szia"],
    ["cảm ơn", "köszönöm"],
    ["tạm biệt", "viszlát"],
  ]) {
    await click(vi);
    await click(hu);
  }
  await check();
  await next();
  const input = page.getByLabel("A válaszod vietnámiul");
  assert.equal(await input.getAttribute("inputmode"), "text");
  assert.equal(await input.getAttribute("enterkeyhint"), "done");
  assert.equal(
    await page.locator(".diacritic-help").count(),
    0,
    "no in-app character keyboard",
  );
  await input.fill("chao");
  await page.screenshot({ path: "qa/android-typing.png", fullPage: true });
  await check();
  await next();
  await click("chào");
  await check();
  await page.reload();
  await click("Lecke folytatása");
  await page
    .getByRole("heading", { name: "Megvan az első három szavad!" })
    .waitFor();
  assert.match(await page.locator(".result-grid").innerText(), /60 XP/);
  await page.screenshot({ path: "qa/android-completion.png", fullPage: true });
  await click("Vissza a kezdőlapra");
  await page.reload();
  await page.getByText("1 / 1 lecke · Szép munka!", { exact: true }).waitFor();
  await nav("Haladás");
  assert.match(await page.locator(".goal-ring").innerText(), /60/);
  await overflow();
  await page.screenshot({ path: "qa/android-progress.png", fullPage: true });
  await nav("Szókincs");
  assert.equal(await page.locator(".word-entry").count(), 3);
  await page.getByLabel("Vietnámiul", { exact: true }).fill("xin chào");
  await page.getByLabel("Magyarul", { exact: true }).fill("üdvözlöm");
  await click("Mentés");
  await page
    .getByRole("status")
    .filter({ hasText: "Kifejezés elmentve." })
    .waitFor();
  await page.reload();
  await nav("Szókincs");
  await page.getByText("xin chào", { exact: true }).waitFor();
  await nav("Profil");
  const downloadPromise = page.waitForEvent("download");
  await click("Haladás exportálása");
  const download = await downloadPromise;
  await download.saveAs("qa/phone-progress.json");
  const saved = JSON.parse(await readFile("qa/phone-progress.json", "utf8"));
  assert.equal(saved.xp, 60);
  assert.equal(saved.lessonBest["first-words-01"], 100);
  await page.locator(".standard-screen input[type=file]").setInputFiles({
    name: "invalid.json",
    mimeType: "application/json",
    buffer: Buffer.from("{}"),
  });
  await page
    .getByRole("status")
    .filter({ hasText: "Érvénytelen mentés" })
    .waitFor();
  await page
    .locator(".standard-screen input[type=file]")
    .setInputFiles("qa/phone-progress.json");
  await page
    .getByRole("status")
    .filter({ hasText: "A haladás importálva." })
    .waitFor();
  await nav("Kezdőlap");
  for (const width of [320, 412, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await overflow();
  }
  await page.screenshot({
    path: "qa/phone-desktop-preview.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await nav("Gyakorlás");
  await click("Átismétlem");
  await click("Kipróbálom");
  await click("viszlát");
  await click("Ellenőrzés");
  await page
    .getByRole("status")
    .filter({ hasText: "Ezt most tanultad meg." })
    .waitFor();
  assert.equal(await page.locator(".incorrect").count(), 1);
  await page
    .getByRole("button", { name: "Lecke bezárása", exact: true })
    .click();
  await nav("Profil");
  const replayDownload = page.waitForEvent("download");
  await click("Haladás exportálása");
  const replay = await replayDownload;
  await replay.saveAs("qa/phone-replay.json");
  assert.equal(
    JSON.parse(await readFile("qa/phone-replay.json", "utf8")).xp,
    60,
    "replay gives no XP",
  );
  assert.deepEqual(errors, []);
  assert.deepEqual(remote, []);
  const fresh = await browser.newContext({
    viewport: { width: 320, height: 740 },
    isMobile: true,
    hasTouch: true,
  });
  page = await fresh.newPage();
  await page.addInitScript(() =>
    Object.defineProperty(window, "indexedDB", {
      get() {
        throw Error("storage unavailable");
      },
    }),
  );
  await page.goto(url);
  await page
    .getByRole("heading", { name: "A mentés nem tölthető be." })
    .waitFor();
  assert.equal(
    await page
      .getByRole("button", { name: "Az első szavam", exact: true })
      .count(),
    0,
  );
  await fresh.close();
  console.log(
    "PASS: phone layouts 320/390/412px plus desktop, teach-before-test, 3 words only, native-input markup/no keypad, beginner accent tolerance, six exercises, restart persistence and final-answer recovery, XP/mastery, vocabulary, export/import, replay farming protection, storage failure protection; no browser errors or remote requests. Native Android keyboard requires device verification.",
  );
} finally {
  await browser.close();
}

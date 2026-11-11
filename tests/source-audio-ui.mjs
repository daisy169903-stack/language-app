import assert from "node:assert/strict";
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
await context.route("https://api.github.com/**", (route) =>
  route.fulfill({ status: 404, contentType: "application/json", body: "{}" }),
);
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const clipBounds = async (start, end) => {
  await page.waitForFunction(
    ({ start, end }) => {
      const a = document.querySelector(".source-audio audio");
      return (
        !!a &&
        a.paused &&
        a.played.length > 0 &&
        a.currentTime >= end &&
        a.currentTime < end + 0.3
      );
    },
    { start, end },
    { timeout: 30000 },
  );
  const result = await page.locator(".source-audio audio").evaluate((a) => ({
    start: a.played.start(0),
    end: a.played.end(a.played.length - 1),
    error: a.error?.code,
    duration: a.duration,
  }));
  assert.equal(result.error, undefined);
  assert.ok(result.start >= start - 0.1, JSON.stringify(result));
  assert.ok(result.end <= end + 0.3, JSON.stringify(result));
  return result;
};
try {
  await page.goto(process.env.APP_URL || "http://127.0.0.1:4173/");
  await page
    .getByRole("button", { name: "Az első szavam", exact: true })
    .click();
  await page.getByRole("heading", { name: "chào", exact: true }).waitFor();
  assert.equal(
    await page
      .getByText("Ehhez még nincs ellenőrzött hang.", { exact: true })
      .count(),
    0,
  );
  await page
    .getByRole("button", { name: "chào meghallgatása", exact: true })
    .click();
  const first = await clipBounds(461.33, 462.08);
  await page.screenshot({ path: "qa/chao-working-online.png" });
  await page
    .getByRole("button", { name: "chào meghallgatása", exact: true })
    .click();
  await page.waitForFunction(
    () =>
      document.querySelector(".source-play")?.getAttribute("aria-pressed") ===
      "true",
  );
  await clipBounds(461.33, 462.08);
  await page.getByRole("button", { name: "Kipróbálom", exact: true }).click();
  await page.getByRole("button", { name: "szia", exact: true }).click();
  await page.getByRole("button", { name: "Ellenőrzés", exact: true }).click();
  await page.getByRole("button", { name: "Következő", exact: true }).click();
  await page.getByRole("heading", { name: "cảm ơn", exact: true }).waitFor();
  await page
    .getByRole("button", { name: "cảm ơn meghallgatása", exact: true })
    .click();
  const second = await clipBounds(246.64, 247.4);
  const count = await page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const req = indexedDB.open("vietlingo-audio", 1);
        req.onsuccess = () => {
          const db = req.result;
          const q = db.transaction("clips").objectStore("clips").count();
          q.onsuccess = () => {
            resolve(q.result);
            db.close();
          };
          q.onerror = () => reject(q.error);
        };
      }),
  );
  assert.equal(
    count,
    0,
    "source playback must not approve or import private clips",
  );
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      result:
        "PASS: first-lesson original podcast audio actually decodes, seeks, stops and replays without importing or approving clips",
      chao: first,
      camOn: second,
      realPhoneVerified: false,
    }),
  );
} finally {
  await browser.close();
}

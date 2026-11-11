import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { assertPublicAssets } from "../scripts/public-assets";
test("public build rejects private packs and unlicensed audio while allowing reviewed distributable audio", () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "vietlingo-build-"));
  mkdirSync(path.join(root, "public"));
  try {
    assert.doesNotThrow(() => assertPublicAssets(root));
    const file = path.join(root, "public", "voice.wav");
    writeFileSync(file, "synthetic");
    assert.throws(() => assertPublicAssets(root), /engedélyezése/);
    writeFileSync(
      `${file}.license.json`,
      JSON.stringify({
        license: "private-study",
        review: { status: "approved" },
        accent: "northern",
      }),
    );
    assert.throws(() => assertPublicAssets(root), /Nem publikálható/);
    writeFileSync(
      `${file}.license.json`,
      JSON.stringify({
        license: "publishable",
        review: { status: "approved" },
        accent: "northern",
      }),
    );
    assert.doesNotThrow(() => assertPublicAssets(root));
    writeFileSync(path.join(root, "public", "review.vlaudio.json"), "{}");
    assert.throws(() => assertPublicAssets(root), /Privát/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

import test from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";
import {
  parseAudioPack,
  approveCandidate,
  saveApprovedAudio,
  loadAudioLibrary,
} from "../src/audioLibrary";
async function fixture() {
  const wav = Buffer.alloc(364);
  wav.write("RIFF");
  wav.writeUInt32LE(356, 4);
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
  wav.writeUInt32LE(320, 40);
  return {
    version: 1,
    kind: "vietlingo-audio-pack",
    audience: "private",
    clips: [
      {
        id: "test.greeting",
        text: "chào",
        mimeType: "audio/wav",
        dataBase64: wav.toString("base64"),
        sha256: Buffer.from(
          await crypto.subtle.digest("SHA-256", wav),
        ).toString("hex"),
        source: {
          title: "Synthetic test only, not Vietnamese speech",
          url: "",
          license: "private-study",
          accent: "northern",
        },
        review: {
          status: "approved",
          reviewer: "Fixture",
          reviewedAt: "2026-11-11T12:00:00Z",
        },
      },
    ],
  };
}
test("verified approved packs persist actual WAV blobs and logical IDs replace recordings", async () => {
  const pack = await parseAudioPack(await fixture());
  await saveApprovedAudio(
    pack.clips as Parameters<typeof saveApprovedAudio>[0],
  );
  let saved = await loadAudioLibrary();
  assert.equal(saved.length, 1);
  assert.equal(saved[0].blob.type, "audio/wav");
  assert.equal(saved[0].blob.size, 364);
  const replacement = approveCandidate(
    { ...pack.clips[0], text: "Chào!" },
    true,
  );
  await saveApprovedAudio([replacement]);
  saved = await loadAudioLibrary();
  assert.equal(saved.length, 1);
  assert.equal(saved[0].text, "Chào!");
});
test("pending candidates require explicit confirmation and cannot masquerade as an approved pack", async () => {
  const raw = await fixture();
  raw.clips[0].review.status = "pending";
  await assert.rejects(() => parseAudioPack(raw));
  raw.kind = "vietlingo-audio-review";
  const pack = await parseAudioPack(raw);
  assert.throws(() => approveCandidate(pack.clips[0], false));
  await assert.rejects(() =>
    saveApprovedAudio(pack.clips as Parameters<typeof saveApprovedAudio>[0]),
  );
  assert.equal(approveCandidate(pack.clips[0], true).review.status, "approved");
});
test("private podcast cannot appear in public packs, and corrupt bytes are rejected", async () => {
  let raw = await fixture();
  raw.audience = "public";
  await assert.rejects(() => parseAudioPack(raw), /Privát/);
  raw = await fixture();
  raw.clips[0].sha256 = "0".repeat(64);
  await assert.rejects(() => parseAudioPack(raw), /ellenőrzőösszege/);
  raw = await fixture();
  raw.clips[0].dataBase64 = Buffer.from("<script>evil</script>").toString(
    "base64",
  );
  await assert.rejects(() => parseAudioPack(raw));
});
test("untrusted IDs, credentials in source URLs and duplicate approved IDs are rejected", async () => {
  let raw = await fixture();
  raw.clips[0].id = "../private";
  await assert.rejects(() => parseAudioPack(raw));
  raw = await fixture();
  raw.clips[0].source.url = "https://secret@example.com/audio";
  await assert.rejects(() => parseAudioPack(raw));
  raw = await fixture();
  raw.clips.push(raw.clips[0]);
  await assert.rejects(() => parseAudioPack(raw));
});

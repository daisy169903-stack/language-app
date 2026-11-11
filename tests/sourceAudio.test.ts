import test from "node:test";
import assert from "node:assert/strict";
import { sourceAudioFor } from "../src/sourceAudio";
test("starter words have direct cues into only the freely published Northern episode", () => {
  for (const id of ["greeting.chao", "politeness.cam-on"]) {
    const source = sourceAudioFor(id);
    assert.ok(source);
    assert.equal(
      source.url,
      "https://media.vietlingo.com/podcasts/northern/beginners/ep01-chao-hoi.mp3",
    );
    assert.equal(source.accentBasis, "publisher-labelled-northern");
    assert.ok(
      source.start > 0 &&
        source.end > source.start &&
        source.end - source.start < 2,
    );
    assert.equal("dataBase64" in source, false);
    assert.equal("review" in source, false);
  }
  assert.equal(sourceAudioFor("farewell.tam-biet"), undefined);
  assert.equal(sourceAudioFor("__proto__"), undefined);
});

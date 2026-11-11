import test from "node:test";
import assert from "node:assert/strict";
import { sourceAudioFor } from "../src/sourceAudio";
import lesson from "../src/data/beginner.json";
test("greeting cues use only the freely published Northern episode", () => {
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
  assert.equal(sourceAudioFor("__proto__"), undefined);
});

test("every beginner lesson audio ID resolves, including the public Northern farewell recording", () => {
  for (const exercise of lesson.exercises) {
    if (exercise.audioId)
      assert.ok(sourceAudioFor(exercise.audioId), exercise.audioId);
  }
  const farewell = sourceAudioFor("farewell.tam-biet")!;
  assert.equal(
    farewell.url,
    "https://d1pra95f92lrn3.cloudfront.net/audio/174745.mp3",
  );
  assert.equal(farewell.kind, "word-recording");
  assert.equal(farewell.start, 0);
  assert.equal(farewell.end, 1.071);
  assert.equal(farewell.accentBasis, "publisher-labelled-northern");
  assert.ok(
    farewell.accentEvidenceUrl?.startsWith("https://www.vietnamesepod101.com/"),
  );
  assert.equal("dataBase64" in farewell, false);
  assert.equal("review" in farewell, false);
});

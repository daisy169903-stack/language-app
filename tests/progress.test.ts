import test from "node:test";
import assert from "node:assert/strict";
import { IDBFactory } from "fake-indexeddb";
import { initialProgress, lesson, recordAnswer } from "../src/domain";
import { loadProgress, saveProgress } from "../src/progress";

test("IndexedDB loads defaults and roundtrips actual progress, including a resumable session", async () => {
  globalThis.indexedDB = new IDBFactory();
  assert.deepEqual(await loadProgress(), initialProgress());
  const exercise = lesson.exercises[0];
  const progress = recordAnswer(
    initialProgress(),
    exercise,
    exercise.acceptedAnswers[0],
    "2026-11-11",
  );
  progress.lastSession = {
    lessonId: lesson.id,
    index: 1,
    answers: [
      {
        exerciseId: exercise.id,
        answer: exercise.acceptedAnswers[0],
        correct: true,
      },
    ],
  };
  await saveProgress(progress);
  assert.deepEqual(await loadProgress(), progress);
  progress.xp = 200;
  assert.equal((await loadProgress()).xp, 10);
});

test("a failed write rejects instead of reporting success", async () => {
  const factory = new IDBFactory();
  globalThis.indexedDB = factory;
  // Open the same database so the test can intercept its real write transaction.
  await saveProgress({ ...initialProgress(), xp: 10 });
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = factory.open("vietlingo-hu", 1);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  const prototype = Object.getPrototypeOf(db) as IDBDatabase;
  const original = prototype.transaction;
  prototype.transaction = function (
    ...args: Parameters<IDBDatabase["transaction"]>
  ) {
    const transaction = original.apply(this, args);
    if (args[1] === "readwrite") queueMicrotask(() => transaction.abort());
    return transaction;
  };
  try {
    await assert.rejects(saveProgress({ ...initialProgress(), xp: 20 }));
    assert.equal((await loadProgress()).xp, 10);
  } finally {
    prototype.transaction = original;
    db.close();
  }
});

test("invalid imports cannot overwrite stored progress", async () => {
  globalThis.indexedDB = new IDBFactory();
  const progress = { ...initialProgress(), xp: 20 };
  await saveProgress(progress);
  await assert.rejects(saveProgress({ ...progress, xp: -1 }));
  assert.deepEqual(await loadProgress(), progress);
});

test("IndexedDB migrates a stored legacy lesson without losing rewards or vocabulary", async () => {
  globalThis.indexedDB = new IDBFactory();
  const legacy = {
    ...initialProgress(),
    xp: 10,
    awardedExerciseIds: ["greetings-choice"],
    vocabulary: [{ id: "greetings-choice", vi: "Chào anh", hu: "Üdvözöllek" }],
    lastSession: {
      lessonId: "greetings-01",
      index: 1,
      answers: [
        { exerciseId: "greetings-choice", answer: "Üdvözöllek", correct: true },
      ],
    },
  };
  // Seed the old schema directly; saveProgress already validates/migrates it.
  await saveProgress(initialProgress());
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("vietlingo-hu", 1);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("progress", "readwrite");
    tx.objectStore("progress").put(legacy, "learner");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
  const { lastSession: _, ...expected } = legacy;
  assert.deepEqual(await loadProgress(), expected);
});

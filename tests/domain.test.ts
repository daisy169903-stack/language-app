import test from "node:test";
import assert from "node:assert/strict";
import {
  completeLesson,
  evaluateAnswer,
  initialProgress,
  lesson,
  levelForXp,
  localDay,
  normalizeAnswer,
  recordAnswer,
  validateProgress,
  type Exercise,
} from "../src/domain";

test("normalization preserves Vietnamese marks and canonical Unicode", () => {
  assert.equal(normalizeAnswer("  CẢM   ƠN!!! "), "cảm ơn");
  assert.equal(normalizeAnswer("Cảm ơn".normalize("NFD")), "cảm ơn");
  const synthetic: Exercise = {
    ...lesson.exercises[0],
    type: "tone",
    acceptedAnswers: ["mả"],
  };
  assert.equal(evaluateAnswer(synthetic, "má"), false);
  assert.equal(evaluateAnswer(synthetic, "mả".normalize("NFD")), true);
  assert.equal(evaluateAnswer(synthetic, "ma"), false);
  assert.equal(evaluateAnswer(synthetic, ""), false);
  const translation: Exercise = {
    ...synthetic,
    type: "translation",
    acceptedAnswers: ["Tôi tên là Anna.", "Tên tôi là Anna."],
  };
  assert.equal(evaluateAnswer(translation, "Tên tôi là Anna!"), true);
  assert.equal(evaluateAnswer(translation, "Ten toi la Anna"), false);
});

test("first lesson teaches three expressions before recognition, then reuses only those expressions", () => {
  assert.equal(lesson.id, "first-words-01");
  assert.equal(lesson.exercises.length, 6);
  const taught = new Map<string, string>();
  for (const ex of lesson.exercises.slice(0, 3)) {
    assert.equal(ex.type, "choice");
    assert.ok(ex.teaching);
    assert.equal(ex.vietnamese, ex.teaching.vi);
    assert.equal(ex.acceptedAnswers[0], ex.teaching.hu);
    assert.ok(ex.teaching.note && ex.teaching.emoji);
    taught.set(ex.teaching.vi, ex.teaching.hu);
  }
  assert.deepEqual(
    [...taught],
    [
      ["chào", "szia"],
      ["cảm ơn", "köszönöm"],
      ["tạm biệt", "viszlát"],
    ],
  );
  const matching = lesson.exercises[3];
  assert.equal(matching.type, "matching");
  assert.deepEqual(
    matching.pairs?.map((p) => [p.vi, p.hu]),
    [...taught],
  );
  const recall = lesson.exercises[4];
  assert.equal(recall.type, "recall");
  assert.equal(recall.vietnamese, undefined);
  assert.deepEqual(recall.acceptedAnswers, ["chào", "chao"]);
  assert.equal(evaluateAnswer(recall, "CHAO!"), true);
  assert.equal(evaluateAnswer(recall, "chào".normalize("NFD")), true);
  assert.equal(
    evaluateAnswer({ ...recall, acceptedAnswers: ["chào"] }, "chao"),
    false,
  );
  assert.equal(lesson.exercises[5].type, "choice");
  assert.ok(lesson.exercises[5].options?.every((o) => taught.has(o)));
  for (const ex of lesson.exercises) {
    assert.equal(evaluateAnswer(ex, ex.acceptedAnswers[0]), true);
    assert.equal(ex.id.startsWith("greetings-"), false);
    assert.equal(ex.skill === "listening", false);
  }
  assert.equal(new Set(lesson.exercises.map((ex) => ex.id)).size, 6);
  assert.equal(lesson.reviewStatus, "draft");
  assert.equal(lesson.audio?.status, "placeholder");
});

test("daily activity stores earned XP and retains zero-XP replay days", () => {
  const exercise = lesson.exercises[0];
  const first = recordAnswer(
    initialProgress(),
    exercise,
    exercise.acceptedAnswers[0],
    "2026-11-11",
  );
  assert.equal(first.activity["2026-11-11"], 10);
  const replay = recordAnswer(
    first,
    exercise,
    exercise.acceptedAnswers[0],
    "2026-11-12",
  );
  assert.equal(replay.activity["2026-11-12"], 0);
  assert.equal(replay.xp, 10);
  const wrong = recordAnswer(
    replay,
    lesson.exercises[1],
    "rossz",
    "2026-11-12",
  );
  assert.equal(wrong.activity["2026-11-12"], 2);
  assert.equal(wrong.xp, 12);
});

test("XP is awarded only on first attempt, stats count attempts, and inputs are immutable", () => {
  const initial = initialProgress();
  const exercise = lesson.exercises[0];
  const wrong = recordAnswer(initial, exercise, "rossz", "2026-11-11");
  const retry = recordAnswer(
    wrong,
    exercise,
    exercise.acceptedAnswers[0],
    "2026-11-11",
  );
  assert.equal(initial.xp, 0);
  assert.equal(wrong.xp, 2);
  assert.equal(retry.xp, 2);
  assert.deepEqual(retry.skills.vocabulary, { correct: 1, total: 2 });
  assert.equal(retry.activity["2026-11-11"], 2);
  assert.equal(retry.vocabulary.length, 1);
  const correctFirst = recordAnswer(
    initial,
    exercise,
    exercise.acceptedAnswers[0],
  );
  assert.equal(
    recordAnswer(correctFirst, exercise, exercise.acceptedAnswers[0]).xp,
    10,
  );
});

test("resumable imports require the current lesson and its ordered answer prefix", () => {
  const answers = lesson.exercises.map((exercise) => ({
    exerciseId: exercise.id,
    answer: exercise.acceptedAnswers[0],
    correct: true,
  }));
  const valid = {
    ...initialProgress(),
    lastSession: {
      lessonId: lesson.id,
      index: 1,
      answers: answers.slice(0, 1),
    },
  };
  assert.deepEqual(validateProgress(valid), valid);
  assert.doesNotThrow(() =>
    validateProgress({
      ...valid,
      lastSession: { lessonId: lesson.id, index: answers.length, answers },
    }),
  );
  for (const session of [
    { lessonId: lesson.id, index: 100, answers: [] },
    { lessonId: lesson.id, index: 2, answers: answers.slice(0, 1) },
    { lessonId: lesson.id, index: 1, answers: [answers[1]] },
    { lessonId: lesson.id, index: 2, answers: [answers[1], answers[0]] },
    { lessonId: "ismeretlen", index: 1, answers: answers.slice(0, 1) },
    {
      lessonId: lesson.id,
      index: answers.length + 1,
      answers: [...answers, answers[0]],
    },
  ])
    assert.throws(() => validateProgress({ ...valid, lastSession: session }));
});

test("completion needs 80 percent, retains best result, and rejects impossible scores", () => {
  const low = completeLesson(initialProgress(), lesson, 4);
  assert.deepEqual(low.completedLessonIds, []);
  assert.equal(low.lessonBest[lesson.id], 67);
  const passed = completeLesson(low, lesson, 5);
  assert.deepEqual(passed.completedLessonIds, [lesson.id]);
  const repeated = completeLesson(passed, lesson, 2);
  assert.equal(repeated.lessonBest[lesson.id], 83);
  assert.deepEqual(repeated.completedLessonIds, [lesson.id]);
  assert.equal(repeated.xp, 0);
  assert.throws(() => completeLesson(low, lesson, 7));
  assert.throws(() => completeLesson(low, lesson, 1.5));
  const fiveExercises = { ...lesson, exercises: lesson.exercises.slice(0, 5) };
  assert.deepEqual(
    completeLesson(initialProgress(), fiveExercises, 4).completedLessonIds,
    [lesson.id],
  );
});

test("level and local date use deterministic boundaries", () => {
  assert.equal(levelForXp(99), 1);
  assert.equal(levelForXp(100), 2);
  assert.equal(localDay(new Date(2026, 0, 2, 23, 59)), "2026-01-02");
});

test("legacy session migration drops only the obsolete session and preserves earned progress", () => {
  const legacyIds = [
    "greetings-choice",
    "greetings-matching",
    "greetings-construction",
    "greetings-translation",
    "greetings-recall",
    "greetings-tone",
  ];
  const legacy = {
    ...initialProgress(),
    xp: 60,
    completedLessonIds: ["greetings-01"],
    lessonBest: { "greetings-01": 100 },
    awardedExerciseIds: legacyIds,
    vocabulary: [{ id: legacyIds[0], vi: "Chào anh", hu: "Üdvözöllek" }],
    lastSession: {
      lessonId: "greetings-01",
      index: 6,
      answers: legacyIds.map((exerciseId) => ({
        exerciseId,
        answer: "régi válasz",
        correct: true,
      })),
    },
  };
  const migrated = validateProgress(legacy);
  const { lastSession: _, ...preserved } = legacy;
  assert.deepEqual(migrated, preserved);
  assert.equal(legacy.lastSession.answers.length, 6);
  migrated.vocabulary[0].hu = "módosítva";
  assert.equal(legacy.vocabulary[0].hu, "Üdvözöllek");
  assert.equal(
    recordAnswer(
      validateProgress(legacy),
      lesson.exercises[0],
      lesson.exercises[0].acceptedAnswers[0],
    ).xp,
    70,
  );
  assert.throws(() =>
    validateProgress({
      ...legacy,
      lastSession: { ...legacy.lastSession, index: 5 },
    }),
  );
  assert.throws(() =>
    validateProgress({
      ...legacy,
      lastSession: {
        ...legacy.lastSession,
        answers: [...legacy.lastSession.answers].reverse(),
      },
    }),
  );
});

test("imports validate structure, values and calendar dates and return an isolated copy", () => {
  const valid = initialProgress();
  const copy = validateProgress(valid);
  copy.xp = 100;
  assert.equal(valid.xp, 0);
  for (const invalid of [
    null,
    {},
    { ...valid, version: 2 },
    { ...valid, xp: -1 },
    { ...valid, xp: Infinity },
    { ...valid, skills: {} },
    { ...valid, completedLessonIds: ["one", "one"] },
    { ...valid, activity: { "2026-02-30": 1 } },
    { ...valid, lessonBest: { lesson: 101 } },
    {
      ...valid,
      skills: { ...valid.skills, reading: { correct: 2, total: 1 } },
    },
    { ...valid, extra: true },
    { ...valid, vocabulary: [{ id: "x", vi: "xin" }] },
    {
      ...valid,
      lastSession: {
        lessonId: lesson.id,
        index: 0,
        answers: [{ exerciseId: "x", answer: "", correct: false }],
      },
    },
  ])
    assert.throws(() => validateProgress(invalid));
});

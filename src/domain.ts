import beginner from "./data/beginner.json";

export type Skill = "vocabulary" | "reading" | "listening" | "construction";
export interface Exercise {
  id: string;
  type:
    | "choice"
    | "matching"
    | "construction"
    | "translation"
    | "recall"
    | "tone";
  skill: Skill;
  prompt: string;
  context: string;
  vietnamese?: string;
  translation?: string;
  options?: string[];
  acceptedAnswers: string[];
  explanation: string;
  pairs?: { vi: string; hu: string }[];
  tokens?: string[];
  difficulty: number;
  audioId?: string;
  teaching?: { vi: string; hu: string; note: string; emoji: string };
}
export interface Lesson {
  id: string;
  title: string;
  subtitle: string;
  durationMinutes: number;
  reviewStatus: "draft";
  contentNote?: string;
  audio?: { status: "placeholder"; targetAccent: "northern"; note: string };
  objectives: string[];
  exercises: Exercise[];
}
export const lesson = beginner as Lesson;

/** Normalize typography, never remove Vietnamese vowel or tone marks. */
export function normalizeAnswer(answer: string): string {
  return answer
    .normalize("NFC")
    .toLocaleLowerCase("hu-HU")
    .replace(/[\p{P}\p{S}]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

export function evaluateAnswer(exercise: Exercise, answer: string): boolean {
  const normalized = normalizeAnswer(answer);
  return (
    normalized.length > 0 &&
    exercise.acceptedAnswers.some(
      (value) => normalizeAnswer(value) === normalized,
    )
  );
}

export interface Progress {
  version: 1;
  xp: number;
  completedLessonIds: string[];
  lessonBest: Record<string, number>;
  skills: Record<Skill, { correct: number; total: number }>;
  activity: Record<string, number>;
  awardedExerciseIds: string[];
  lastSession?: {
    lessonId: string;
    index: number;
    answers: { exerciseId: string; answer: string; correct: boolean }[];
  };
  vocabulary: { id: string; vi: string; hu: string }[];
}
const skills: Skill[] = ["vocabulary", "reading", "listening", "construction"];

export function initialProgress(): Progress {
  return {
    version: 1,
    xp: 0,
    completedLessonIds: [],
    lessonBest: {},
    skills: {
      vocabulary: { correct: 0, total: 0 },
      reading: { correct: 0, total: 0 },
      listening: { correct: 0, total: 0 },
      construction: { correct: 0, total: 0 },
    },
    activity: {},
    awardedExerciseIds: [],
    vocabulary: [],
  };
}

export function localDay(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function levelForXp(xp: number): number {
  return Math.floor(Math.max(0, xp) / 100) + 1;
}

export function recordAnswer(
  progress: Progress,
  exercise: Exercise,
  answer: string,
  day = localDay(),
): Progress {
  const next = structuredClone(progress);
  const correct = evaluateAnswer(exercise, answer);
  next.skills[exercise.skill].total += 1;
  if (correct) next.skills[exercise.skill].correct += 1;
  let earnedXp = 0;
  if (!next.awardedExerciseIds.includes(exercise.id)) {
    earnedXp = correct ? 10 : 2;
    next.xp += earnedXp;
    next.awardedExerciseIds.push(exercise.id);
  }
  next.activity[day] = (next.activity[day] ?? 0) + earnedXp;
  if (
    correct &&
    exercise.vietnamese &&
    exercise.translation &&
    !next.vocabulary.some((entry) => entry.id === exercise.id)
  ) {
    next.vocabulary.push({
      id: exercise.id,
      vi: exercise.vietnamese,
      hu: exercise.translation,
    });
  }
  return next;
}

export function completeLesson(
  progress: Progress,
  currentLesson: Lesson,
  correctCount: number,
): Progress {
  if (
    !Number.isInteger(correctCount) ||
    correctCount < 0 ||
    correctCount > currentLesson.exercises.length ||
    currentLesson.exercises.length === 0
  ) {
    throw new Error("Érvénytelen leckepontszám.");
  }
  const next = structuredClone(progress);
  const score = Math.round(
    (correctCount / currentLesson.exercises.length) * 100,
  );
  next.lessonBest[currentLesson.id] = Math.max(
    next.lessonBest[currentLesson.id] ?? 0,
    score,
  );
  if (
    correctCount / currentLesson.exercises.length >= 0.8 &&
    !next.completedLessonIds.includes(currentLesson.id)
  )
    next.completedLessonIds.push(currentLesson.id);
  delete next.lastSession;
  return next;
}

/** Reject malformed imports rather than silently resetting the learner's data. */
export function validateProgress(value: unknown): Progress {
  const fail = (): never => {
    throw new Error("Érvénytelen vagy nem támogatott haladásfájl.");
  };
  const obj = (v: unknown): v is Record<string, unknown> =>
    !!v &&
    typeof v === "object" &&
    !Array.isArray(v) &&
    Object.getPrototypeOf(v) === Object.prototype;
  const count = (v: unknown): v is number =>
    typeof v === "number" && Number.isSafeInteger(v) && v >= 0;
  const str = (v: unknown): v is string =>
    typeof v === "string" && v.length > 0 && v.length <= 10000;
  const ids = (v: unknown): v is string[] =>
    Array.isArray(v) && v.every(str) && new Set(v).size === v.length;
  const allowed = (v: Record<string, unknown>, keys: string[]) =>
    Object.keys(v).every((key) => keys.includes(key));
  if (
    !obj(value) ||
    !allowed(value, [
      "version",
      "xp",
      "completedLessonIds",
      "lessonBest",
      "skills",
      "activity",
      "awardedExerciseIds",
      "lastSession",
      "vocabulary",
    ])
  )
    return fail();
  if (
    value.version !== 1 ||
    !count(value.xp) ||
    !ids(value.completedLessonIds) ||
    !ids(value.awardedExerciseIds)
  )
    return fail();
  if (
    !obj(value.lessonBest) ||
    !Object.entries(value.lessonBest).every(
      ([key, score]) => str(key) && count(score) && score <= 100,
    )
  )
    return fail();
  if (!obj(value.skills) || !allowed(value.skills, skills)) return fail();
  for (const skill of skills) {
    const stat = value.skills[skill];
    if (
      !obj(stat) ||
      !allowed(stat, ["correct", "total"]) ||
      !count(stat.correct) ||
      !count(stat.total) ||
      stat.correct > stat.total
    )
      return fail();
  }
  if (
    !obj(value.activity) ||
    !Object.entries(value.activity).every(
      ([day, n]) =>
        /^\d{4}-\d{2}-\d{2}$/.test(day) &&
        !Number.isNaN(Date.parse(`${day}T00:00:00Z`)) &&
        new Date(`${day}T00:00:00Z`).toISOString().startsWith(day) &&
        count(n),
    )
  )
    return fail();
  if (
    !Array.isArray(value.vocabulary) ||
    !value.vocabulary.every(
      (entry) =>
        obj(entry) &&
        allowed(entry, ["id", "vi", "hu"]) &&
        str(entry.id) &&
        str(entry.vi) &&
        str(entry.hu),
    ) ||
    new Set(value.vocabulary.map((entry) => entry.id)).size !==
      value.vocabulary.length
  )
    return fail();
  if (value.lastSession !== undefined) {
    const session = value.lastSession;
    if (
      !obj(session) ||
      !allowed(session, ["lessonId", "index", "answers"]) ||
      !str(session.lessonId) ||
      !count(session.index) ||
      !Array.isArray(session.answers)
    )
      return fail();
    if (
      !session.answers.every(
        (answer) =>
          obj(answer) &&
          allowed(answer, ["exerciseId", "answer", "correct"]) &&
          str(answer.exerciseId) &&
          typeof answer.answer === "string" &&
          answer.answer.length <= 10000 &&
          typeof answer.correct === "boolean",
      )
    )
      return fail();
    // Retire only the known old lesson's valid ordered session, preserving
    // earned rewards, vocabulary and every other progress field.
    const legacyIds = [
      "greetings-choice",
      "greetings-matching",
      "greetings-construction",
      "greetings-translation",
      "greetings-recall",
      "greetings-tone",
    ];
    if (session.lessonId === "greetings-01") {
      if (
        session.index !== session.answers.length ||
        session.index > legacyIds.length ||
        !session.answers.every(
          (answer, index) => answer.exerciseId === legacyIds[index],
        )
      )
        return fail();
      const migrated = structuredClone(value) as unknown as Progress;
      delete migrated.lastSession;
      return migrated;
    }
    if (
      session.lessonId !== lesson.id ||
      session.index !== session.answers.length ||
      session.index > lesson.exercises.length
    )
      return fail();
    if (
      !session.answers.every(
        (answer, index) => answer.exerciseId === lesson.exercises[index]?.id,
      )
    )
      return fail();
  }
  return structuredClone(value) as unknown as Progress;
}

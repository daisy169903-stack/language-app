import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  ChartNoAxesColumnIncreasing,
  Check,
  ChevronRight,
  CircleHelp,
  Download,
  Flame,
  Home,
  LockKeyhole,
  MessageCircle,
  Plus,
  Settings2,
  ShieldCheck,
  Sparkles,
  Sprout,
  Trophy,
  Upload,
  UserRound,
  X,
  Zap,
} from "lucide-react";
import {
  lesson,
  initialProgress,
  recordAnswer,
  completeLesson,
  levelForXp,
  localDay,
  validateProgress,
  type Progress,
  type Skill,
} from "./domain";
import { loadProgress, saveProgress } from "./progress";
import { exportBackup } from "./backup";
import ExerciseCard from "./components/ExerciseCard";
import { Meter, DraftNote } from "./components/ui";
import AudioSettings from "./components/AudioSettings";
import UpdateSettings from "./components/UpdateSettings";
import { version as appVersion } from "../package.json";

type Page = "home" | "practice" | "vocabulary" | "progress" | "profile";
type Answer = { exerciseId: string; answer: string; correct: boolean };
const tabs = [
  { id: "home", label: "Kezdőlap", icon: Home },
  { id: "practice", label: "Gyakorlás", icon: BookOpen },
  { id: "vocabulary", label: "Szókincs", icon: MessageCircle },
  { id: "progress", label: "Haladás", icon: ChartNoAxesColumnIncreasing },
  { id: "profile", label: "Profil", icon: UserRound },
] as const;
const skillNames: Record<Skill, string> = {
  vocabulary: "Szókincs",
  reading: "Szövegértés",
  listening: "Hallásértés",
  construction: "Mondatalkotás",
};

export default function App() {
  const [page, setPage] = useState<Page>("home");
  const [chapter, setChapter] = useState(false);
  const [inLesson, setInLesson] = useState(false);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [finished, setFinished] = useState(false);
  const [progress, setProgress] = useState<Progress>(initialProgress);
  const [ready, setReady] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [vi, setVi] = useState("");
  const [hu, setHu] = useState("");
  const importRef = useRef<HTMLInputElement>(null);
  const saveQueue = useRef(Promise.resolve());
  const revision = useRef(0);
  useEffect(() => {
    loadProgress()
      .then((p) => {
        setProgress(p);
        setReady(true);
      })
      .catch(() => {
        setLoadFailed(true);
        setReady(true);
      });
  }, []);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 4500);
    return () => clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    const available = (event: Event) => {
      const version = (event as CustomEvent<{ version: string }>).detail
        .version;
      setNotice(
        `Új verzió érhető el (${version}). Megnyitás: Profil → Alkalmazásfrissítés.`,
      );
    };
    window.addEventListener("vietlingo-update-available", available);
    return () =>
      window.removeEventListener("vietlingo-update-available", available);
  }, []);
  const persist = (next: Progress) => {
    setProgress(next);
    setSaving(true);
    const current = ++revision.current;
    const result = saveQueue.current
      .catch(() => {})
      .then(() => saveProgress(next))
      .then(() => {
        if (current === revision.current) {
          setSaving(false);
          setError("");
        }
        return true;
      })
      .catch(() => {
        if (current === revision.current) {
          setSaving(false);
          setError(
            "A mentés nem sikerült. Próbáld újra, vagy exportáld a haladásodat.",
          );
        }
        return false;
      });
    saveQueue.current = result.then(() => {});
    return result;
  };
  const navigate = (target: Page) => {
    setPage(target);
    setInLesson(false);
    setChapter(false);
    window.scrollTo(0, 0);
  };
  const start = (fresh = false) => {
    const session = progress.lastSession;
    setFinished(false);
    if (!fresh && session?.lessonId === lesson.id) {
      setAnswers(session.answers);
      if (session.index === lesson.exercises.length) {
        setIndex(lesson.exercises.length - 1);
        persist(
          completeLesson(
            progress,
            lesson,
            session.answers.filter((a) => a.correct).length,
          ),
        );
        setFinished(true);
      } else setIndex(session.index);
    } else {
      setIndex(0);
      setAnswers([]);
    }
    setInLesson(true);
    setChapter(false);
    window.scrollTo(0, 0);
  };
  const answer = (text: string, correct: boolean) => {
    const ex = lesson.exercises[index];
    const nextAnswers = [
      ...answers,
      { exerciseId: ex.id, answer: text, correct },
    ];
    setAnswers(nextAnswers);
    const next = recordAnswer(progress, ex, text);
    next.lastSession = {
      lessonId: lesson.id,
      index: index + 1,
      answers: nextAnswers,
    };
    persist(next);
  };
  const next = () => {
    if (index + 1 === lesson.exercises.length) {
      persist(
        completeLesson(
          progress,
          lesson,
          answers.filter((a) => a.correct).length,
        ),
      );
      setFinished(true);
    } else setIndex(index + 1);
    window.scrollTo(0, 0);
  };
  const mastered = progress.completedLessonIds.includes(lesson.id);
  const best = progress.lessonBest[lesson.id] || 0;
  const correctCount = answers.filter((a) => a.correct).length;
  const today = progress.activity[localDay()] || 0;
  const hasSession = progress.lastSession?.lessonId === lesson.id;
  const exportData = async () => {
    try {
      await exportBackup(
        JSON.stringify(progress, null, 2),
        `vietlingo-${localDay()}.json`,
      );
      setNotice("A biztonsági másolat elkészült.");
    } catch {
      setNotice("A megosztás nem fejeződött be. Bármikor újra próbálhatod.");
    }
  };
  const importData = async (file?: File) => {
    if (!file) return;
    try {
      if (file.size > 2_000_000) throw Error();
      const data = validateProgress(JSON.parse(await file.text()));
      if (await persist(data)) setNotice("A haladás importálva.");
    } catch {
      setNotice("Érvénytelen mentés. Az adataid nem változtak.");
    }
    if (importRef.current) importRef.current.value = "";
  };
  if (!ready)
    return (
      <div className="loading">
        <Sprout size={42} />
        <p>Egy pillanat…</p>
      </div>
    );
  if (loadFailed)
    return (
      <div className="loading">
        <ShieldCheck size={36} />
        <h1>A mentés nem tölthető be.</h1>
        <p>
          Az adataid megőrzéséhez nem indítunk új profilt. Próbáld újra
          megnyitni az alkalmazást.
        </p>
        <button className="primary" onClick={() => window.location.reload()}>
          Újrapróbálás
        </button>
      </div>
    );
  return (
    <div className={"phone-shell " + (inLesson ? "learning" : "")}>
      {!inLesson && !chapter && (
        <header className="app-header">
          <span className="learner-avatar">
            <Sprout size={26} />
          </span>
          <div className="level-info">
            <b>{levelForXp(progress.xp)}. szint</b>
            <span>{progress.xp % 100} / 100 XP</span>
            <Meter
              value={progress.xp % 100}
              label="Haladás a következő szintig"
            />
          </div>
          <div className="active-days" title="Aktív tanulási napok">
            <Flame size={24} />
            <b>{Object.keys(progress.activity).length}</b>
            <span>tanulási nap</span>
          </div>
        </header>
      )}
      {error && (
        <div className="error-banner" role="alert">
          {error}
          <button onClick={() => persist(progress)}>Mentés újra</button>
        </div>
      )}
      {inLesson ? (
        <main className="lesson-screen">
          {finished ? (
            <section className="completion paper">
              <div className="completion-art">
                <Sparkles size={24} />
                <span>
                  <Trophy size={54} />
                </span>
                <Sparkles size={24} />
              </div>
              <span className="eyebrow">APRÓ LÉPÉS. VALÓDI HALADÁS.</span>
              <h1>
                {correctCount / lesson.exercises.length >= 0.8
                  ? "Megvan az első három szavad!"
                  : "Már megtetted az első lépést!"}
              </h1>
              <p>
                {correctCount / lesson.exercises.length >= 0.8
                  ? "Szia, köszönöm, viszlát. Három kis kifejezés, amivel már kapcsolódhatsz."
                  : "Semmi sietség. Nézd át újra a három kifejezést, aztán próbáld meg még egyszer."}
              </p>
              <div className="result-grid">
                <div>
                  <b>
                    {correctCount}/{lesson.exercises.length}
                  </b>
                  <span>helyes válasz</span>
                </div>
                <div>
                  <b>{progress.xp} XP</b>
                  <span>összes pont</span>
                </div>
                <div>
                  <b>
                    {Math.round((correctCount / lesson.exercises.length) * 100)}
                    %
                  </b>
                  <span>eredmény</span>
                </div>
              </div>
              <div className="learned-phrases">
                <span lang="vi">
                  chào <small>szia</small>
                </span>
                <span lang="vi">
                  cảm ơn <small>köszönöm</small>
                </span>
                <span lang="vi">
                  tạm biệt <small>viszlát</small>
                </span>
              </div>
              <button className="primary" onClick={() => navigate("home")}>
                Vissza a kezdőlapra <ArrowRight size={20} />
              </button>
              <button className="text-button" onClick={() => start(true)}>
                Újra átveszem
              </button>
              <DraftNote />
              <span className="save-state">
                {saving
                  ? "Mentés…"
                  : error
                    ? "Ellenőrizd a mentést."
                    : "Haladás elmentve."}
              </span>
            </section>
          ) : (
            <>
              <header className="lesson-toolbar">
                <button
                  className="icon-button"
                  aria-label="Lecke bezárása"
                  onClick={() => {
                    setInLesson(false);
                    setChapter(true);
                  }}
                >
                  <X size={24} />
                </button>
                <Meter
                  value={(index / lesson.exercises.length) * 100}
                  label="Lecke haladása"
                />
                <span>
                  {index + 1} / {lesson.exercises.length}
                </span>
              </header>
              <div className="lesson-label">
                1. lecke · Első szavak <span>KEZDŐ</span>
              </div>
              <ExerciseCard
                key={index}
                exercise={lesson.exercises[index]}
                onAnswer={answer}
                onNext={next}
                isLast={index === lesson.exercises.length - 1}
              />
              <div className="lesson-disclosure">
                <ShieldCheck size={13} />
                <span>
                  Saját hanganyag a Profilon · <DraftNote />
                </span>
              </div>
            </>
          )}
        </main>
      ) : chapter ? (
        <main className="chapter-screen">
          <header className="screen-toolbar">
            <button
              className="icon-button"
              aria-label="Vissza a kezdőlapra"
              onClick={() => setChapter(false)}
            >
              <ArrowLeft />
            </button>
            <h1>
              1. fejezet <span>Ismerkedés</span>
            </h1>
            <span className="chapter-icon">👋</span>
          </header>
          <img
            className="chapter-art"
            src="/hanoi-hero.png"
            alt="Színes illusztráció Hanoiról, a tóval és a Teknőstoronnyal"
          />
          <section className="chapter-content paper">
            <span className="eyebrow">TÉNYLEG A NULLÁRÓL</span>
            <h2>Először csak három kifejezés.</h2>
            <p>
              Nem kell még mondatokat tudnod. Előbb megmutatjuk a szavakat és a
              jelentésüket, aztán együtt gyakorolunk.
            </p>
            <div className="chapter-summary">
              <b>{mastered ? "1" : "0"} / 1 lecke</b>
              <span>kb. 3 perc</span>
            </div>
            <Meter value={mastered ? 100 : 0} label="Fejezet haladása" />
            <button className="chapter-lesson" onClick={() => start()}>
              <span className="step-number">
                {mastered ? <Check size={20} /> : "1"}
              </span>
              <span>
                <b>{lesson.title}</b>
                <small>{lesson.subtitle}</small>
              </span>
              <span className="start-circle">
                <ArrowRight size={19} />
              </span>
            </button>
            <div className="coming-lesson">
              <LockKeyhole size={18} />
              <span>
                Bemutatkozás<small>Később érkezik, az alapok után.</small>
              </span>
            </div>
            <div className="tiny-note">
              <CircleHelp size={17} />
              <p>
                Először felismerés, majd párosítás. Csak ezután kérünk egyetlen
                rövid szót leírni.
              </p>
            </div>
            <DraftNote />
          </section>
        </main>
      ) : (
        <main className="app-main">
          {page === "home" && (
            <>
              <section className="home-hero">
                <img
                  src="/hanoi-hero.png"
                  alt="Hanoi tava, árnyas fákkal és a Teknőstoronnyal"
                />
                <div className="hero-overlay" />
                <span className="hero-badge">
                  VIETLINGO HU <span>★</span> HANOI
                </span>
                <div>
                  <h1>Vietnámi tanulás</h1>
                  <p>Kis lépésekből valódi beszélgetések.</p>
                </div>
              </section>
              <section className="chapter-list">
                <div className="list-heading">
                  <h2>Kezdjük az elején!</h2>
                  <span>Északi vietnámi</span>
                </div>
                <button
                  className="chapter-card unlocked"
                  onClick={() => {
                    setChapter(true);
                    window.scrollTo(0, 0);
                  }}
                >
                  <span className="chapter-emoji">👋</span>
                  <span className="chapter-copy">
                    <small>1. FEJEZET</small>
                    <b>Ismerkedés</b>
                    <span>
                      {mastered
                        ? "1 / 1 lecke · Szép munka!"
                        : hasSession
                          ? "Folytasd ott, ahol abbahagytad"
                          : "Nulláról indulunk · 3 perc"}
                    </span>
                  </span>
                  <span className="chapter-end">
                    {mastered ? (
                      <Check size={23} />
                    ) : (
                      <ChevronRight size={25} />
                    )}
                  </span>
                </button>
                <button className="chapter-card locked" disabled>
                  <span className="chapter-emoji">🍜</span>
                  <span className="chapter-copy">
                    <small>2. FEJEZET</small>
                    <b>Evés és ivás</b>
                    <span>Később érkezik</span>
                  </span>
                  <LockKeyhole size={20} />
                </button>
                <button className="chapter-card locked" disabled>
                  <span className="chapter-emoji">🛍️</span>
                  <span className="chapter-copy">
                    <small>3. FEJEZET</small>
                    <b>Vásárlás</b>
                    <span>Később érkezik</span>
                  </span>
                  <LockKeyhole size={20} />
                </button>
                <button className="quick-start" onClick={() => start()}>
                  {hasSession
                    ? "Lecke folytatása"
                    : mastered
                      ? "Gyakorolj egy kicsit"
                      : "Az első szavam"}
                  <ArrowRight size={19} />
                </button>
                <div className="home-note">
                  <Sprout size={19} />
                  <p>
                    Nincsenek elvárások. Először tanulunk,
                    <br />
                    és csak utána kérdezünk.
                  </p>
                </div>
              </section>
            </>
          )}
          {page === "practice" && (
            <section className="standard-screen">
              <span className="eyebrow">EGY KIS ISMÉTLÉS</span>
              <h1>Gyakorlás</h1>
              <p className="screen-intro">
                Ugyanaz a három kifejezés, egyre ismerősebben.
              </p>
              <div className="practice-card paper">
                <span className="practice-emoji">👋</span>
                <h2>{lesson.title}</h2>
                <p>{lesson.subtitle}</p>
                <div className="phrase-preview">
                  <span>chào</span>
                  <span>cảm ơn</span>
                  <span>tạm biệt</span>
                </div>
                <button className="primary" onClick={() => start(true)}>
                  Átismétlem <ArrowRight size={20} />
                </button>
                <small>3 perc · nincs további XP az ismétlésért</small>
              </div>
              <div className="info-card">
                <CircleHelp size={21} />
                <p>
                  Az ismétlések automatikus ütemezése még készül. Addig bármikor
                  újra átveheted a leckét.
                </p>
              </div>
            </section>
          )}
          {page === "vocabulary" && (
            <section className="standard-screen">
              <span className="eyebrow">AMIT MÁR ISMERSZ</span>
              <h1>A szókincsed</h1>
              <p className="screen-intro">
                A tanult kifejezéseid és a saját felfedezéseid.
              </p>
              <div className="vocabulary-list">
                {progress.vocabulary.length ? (
                  progress.vocabulary.map((v) => (
                    <article className="word-entry" key={v.id}>
                      <span>
                        <b lang="vi">{v.vi}</b>
                        <small>{v.hu}</small>
                      </span>
                      <span className="word-tag">
                        {lesson.exercises.some((ex) => ex.id === v.id)
                          ? "Tanult"
                          : "Saját"}
                      </span>
                    </article>
                  ))
                ) : (
                  <div className="empty-state">
                    <MessageCircle size={34} />
                    <p>
                      Az első leckében megtanult szavaid
                      <br />
                      automatikusan ide kerülnek.
                    </p>
                  </div>
                )}
              </div>
              <form
                className="vocab-form paper"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!vi.trim() || !hu.trim()) return;
                  const saved = await persist({
                    ...progress,
                    vocabulary: [
                      ...progress.vocabulary,
                      { id: crypto.randomUUID(), vi: vi.trim(), hu: hu.trim() },
                    ],
                  });
                  if (saved) {
                    setVi("");
                    setHu("");
                    if (document.activeElement instanceof HTMLElement)
                      document.activeElement.blur();
                    setNotice("Kifejezés elmentve.");
                  }
                }}
              >
                <h2>Saját kifejezés</h2>
                <label>
                  Vietnámiul
                  <input
                    lang="vi"
                    inputMode="text"
                    autoComplete="off"
                    value={vi}
                    onChange={(e) => setVi(e.target.value)}
                    placeholder="Például: chào"
                    maxLength={250}
                    required
                  />
                </label>
                <label>
                  Magyarul
                  <input
                    inputMode="text"
                    value={hu}
                    onChange={(e) => setHu(e.target.value)}
                    placeholder="Például: szia"
                    maxLength={250}
                    required
                  />
                </label>
                <button className="primary" type="submit" disabled={saving}>
                  <Plus size={18} />
                  Mentés
                </button>
                <small>A telefon saját billentyűzetét használhatod.</small>
              </form>
            </section>
          )}
          {page === "progress" && (
            <section className="standard-screen">
              <span className="eyebrow">MINDEN LÉPÉS SZÁMÍT</span>
              <h1>A haladásod</h1>
              <section className="goal-card">
                <div
                  className="goal-ring"
                  style={{
                    background: `conic-gradient(#72dd83 ${Math.min(100, (today / 30) * 100)}%,#2c3b50 0)`,
                  }}
                >
                  <span>
                    <Zap size={25} />
                    <b>
                      {today}
                      <small> / 30 XP</small>
                    </b>
                  </span>
                </div>
                <div>
                  <h2>Napi cél</h2>
                  <p>
                    {today >= 30
                      ? "A mai kis lépés megvan!"
                      : "Egy kis tanulás minden nap."}
                  </p>
                </div>
              </section>
              <div className="progress-stats">
                <div>
                  <b>{progress.xp}</b>
                  <small>összes XP</small>
                </div>
                <div>
                  <b>{Object.keys(progress.activity).length}</b>
                  <small>tanulási nap</small>
                </div>
                <div>
                  <b>{best}%</b>
                  <small>legjobb eredmény</small>
                </div>
              </div>
              <h2 className="section-title">Eredményeid</h2>
              <div className="achievement-grid">
                <div className={mastered ? "earned" : ""}>
                  <span className="achievement-medal gold">
                    <MessageCircle size={29} />
                  </span>
                  <b>Első szavak</b>
                  <small>
                    {mastered ? "Megszerezted!" : "Legalább 80% a leckében"}
                  </small>
                </div>
                <div className={today >= 30 ? "earned" : ""}>
                  <span className="achievement-medal coral">
                    <Flame size={29} />
                  </span>
                  <b>Egy kis lendület</b>
                  <small>
                    {today >= 30
                      ? "Mai cél teljesítve"
                      : "Teljesítsd a napi célt"}
                  </small>
                </div>
              </div>
              <h2 className="section-title">Készségek</h2>
              <div className="skills-card">
                {(Object.keys(skillNames) as Skill[]).map((s) => {
                  const stat = progress.skills[s];
                  return (
                    <div key={s}>
                      <div>
                        <b>{skillNames[s]}</b>
                        <span>
                          {stat.total
                            ? `${Math.round((stat.correct / stat.total) * 100)}%`
                            : "Még nincs adat"}
                        </span>
                      </div>
                      <Meter
                        value={
                          stat.total ? (stat.correct / stat.total) * 100 : 0
                        }
                        label={skillNames[s]}
                      />
                      {!stat.total && (
                        <small>
                          {s === "listening"
                            ? "Jóváhagyott hanganyagra vár"
                            : s === "construction"
                              ? "Az első szavak után következik"
                              : "Az első leckében kezdheted"}
                        </small>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="info-card">
                <Sprout size={20} />
                <p>
                  A kihagyott napok nem törlik a haladásod. Az aktív napok
                  számát látod, nem megszakítás nélküli sorozatot.
                </p>
              </div>
            </section>
          )}
          {page === "profile" && (
            <section className="standard-screen">
              <div className="profile-heading">
                <span className="learner-avatar large">
                  <Sprout size={35} />
                </span>
                <h1>A te tempódban.</h1>
                <p>VietLingo HU · {levelForXp(progress.xp)}. szint</p>
              </div>
              <section className="settings-card">
                <h2>
                  <Settings2 size={20} />A tanulásod a tiéd
                </h2>
                <p>
                  A haladásod ezen az eszközön marad. Költözés előtt készíts
                  biztonsági másolatot.
                </p>
                <button
                  className="settings-action"
                  onClick={() => void exportData()}
                >
                  <Download size={20} />
                  <span>Haladás exportálása</span>
                  <ChevronRight size={18} />
                </button>
                <button
                  className="settings-action"
                  onClick={() => importRef.current?.click()}
                >
                  <Upload size={20} />
                  <span>Mentés importálása</span>
                  <ChevronRight size={18} />
                </button>
                <input
                  hidden
                  ref={importRef}
                  type="file"
                  accept="application/json,.json"
                  onChange={(e) => void importData(e.target.files?.[0])}
                />
                <small>
                  Az import felülírja az itt tárolt haladást és saját szavakat.
                </small>
              </section>
              <section className="settings-card">
                <h2>
                  <ShieldCheck size={20} />
                  Őszintén a tananyagról
                </h2>
                <p>
                  A vietnámi tartalom ellenőrzésre váró vázlat. Anyanyelvi
                  beszélő még nem hagyta jóvá.
                </p>
                <p>
                  Az első leckében nem kérünk mondatokat vagy tónusfelismerést.
                  A saját hangcsomagból jóváhagyott felvételek a tanulókártyákon
                  hallgathatók meg.
                </p>
                <DraftNote />
              </section>
              <p className="app-version">
                VietLingo HU · {appVersion} · Az első lépésektől.
              </p>
            </section>
          )}
        </main>
      )}
      <div
        className="persistent-profile"
        hidden={page !== "profile" || inLesson || chapter}
      >
        <AudioSettings />
        <UpdateSettings />
      </div>
      {!inLesson && (
        <nav className="bottom-nav" aria-label="Fő navigáció">
          {tabs.map((t) => (
            <button
              key={t.id}
              className={page === t.id && !chapter ? "active" : ""}
              onClick={() => navigate(t.id)}
              aria-current={page === t.id && !chapter ? "page" : undefined}
            >
              <t.icon size={22} />
              <span>{t.label}</span>
            </button>
          ))}
        </nav>
      )}
      {notice && (
        <div className="toast" role="status">
          {notice}
        </div>
      )}
    </div>
  );
}

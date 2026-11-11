import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  CircleHelp,
  Headphones,
  MessageCircle,
  VolumeX,
  X,
} from "lucide-react";
import { evaluateAnswer, normalizeAnswer, type Exercise } from "../domain";
import AudioPlayer from "./AudioPlayer";
const typeLabels = {
  choice: "Értsd meg a helyzetet",
  matching: "Találd meg a párját",
  construction: "Építs mondatot",
  translation: "Fordíts vietnámira",
  recall: "Idézd fel",
  tone: "Figyeld az ékezetet",
};
export default function ExerciseCard({
  exercise: ex,
  onAnswer,
  onNext,
  isLast,
}: {
  exercise: Exercise;
  onAnswer: (answer: string, correct: boolean) => void;
  onNext: () => void;
  isLast: boolean;
}) {
  const [answer, setAnswer] = useState("");
  const [checked, setChecked] = useState(false);
  const [correct, setCorrect] = useState(false);
  const [selectedTokens, setSelectedTokens] = useState<number[]>([]);
  const [matches, setMatches] = useState<Record<string, string>>({});
  const [activeVi, setActiveVi] = useState("");
  const [teachingSeen, setTeachingSeen] = useState(!ex.teaching);
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => headingRef.current?.focus(), [teachingSeen]);
  const check = () => {
    if (checked || !teachingSeen || !answer.trim()) return;
    const ok = evaluateAnswer(ex, answer);
    setCorrect(ok);
    setChecked(true);
    onAnswer(answer, ok);
  };
  const construct = (ids: number[]) => {
    setSelectedTokens(ids);
    setAnswer(ids.map((i) => ex.tokens![i]).join(" "));
  };
  if (ex.teaching && !teachingSeen)
    return (
      <section className="exercise-card card teaching-card">
        <span className="exercise-label">Új kifejezés</span>
        <span className="teaching-emoji" aria-hidden="true">
          {ex.teaching.emoji}
        </span>
        <h1 ref={headingRef} tabIndex={-1} lang="vi">
          {ex.teaching.vi}
        </h1>
        <p className="teaching-meaning">{ex.teaching.hu}</p>
        <p className="exercise-context">{ex.teaching.note}</p>
        {ex.audioId && <AudioPlayer audioId={ex.audioId} />}
        <div className="exercise-actions">
          <span>Először ismerd meg, aztán próbáld ki.</span>
          <button className="primary" onClick={() => setTeachingSeen(true)}>
            Kipróbálom <ArrowRight size={18} />
          </button>
        </div>
      </section>
    );
  return (
    <section className="exercise-card card">
      <span className="exercise-label">
        <span className="icon-square">
          {ex.type === "tone" ? (
            <Headphones size={20} />
          ) : (
            <MessageCircle size={20} />
          )}
        </span>
        {typeLabels[ex.type]}
      </span>
      <h1 ref={headingRef} tabIndex={-1}>
        {ex.prompt}
      </h1>
      <p className="exercise-context">{ex.context}</p>
      {ex.vietnamese && (
        <div className="quote" lang="vi">
          {ex.vietnamese}
        </div>
      )}
      {ex.audioId && !ex.teaching && <AudioPlayer audioId={ex.audioId} />}
      {ex.type === "tone" && (
        <div className="audio-placeholder">
          <VolumeX size={16} />
          Írott felismerés · hangfelvétel nélkül
        </div>
      )}
      {(ex.type === "choice" || ex.type === "tone") && (
        <div className="answer-options">
          {ex.options?.map((o) => (
            <button
              key={o}
              disabled={checked}
              className={
                "answer-option " +
                (answer === o ? "selected " : "") +
                (checked && ex.acceptedAnswers.includes(o) ? "correct " : "") +
                (checked && answer === o && !correct ? "incorrect" : "")
              }
              onClick={() => setAnswer(o)}
              aria-pressed={answer === o}
            >
              <b>{o}</b>
              {answer === o &&
                (checked && !correct ? <X size={18} /> : <Check size={18} />)}
            </button>
          ))}
        </div>
      )}
      {ex.type === "construction" && (
        <>
          <div className="sentence-builder" aria-label="Összeállított mondat">
            {selectedTokens.length ? (
              selectedTokens.map((id, i) => (
                <button
                  disabled={checked}
                  key={id}
                  onClick={() =>
                    construct(selectedTokens.filter((_, j) => j !== i))
                  }
                >
                  {ex.tokens![id]}
                  <X size={12} />
                </button>
              ))
            ) : (
              <span>Koppints a szavakra a megfelelő sorrendben.</span>
            )}
          </div>
          <div className="token-bank">
            {ex.tokens?.map((t, i) => (
              <button
                key={i}
                disabled={checked || selectedTokens.includes(i)}
                onClick={() => construct([...selectedTokens, i])}
              >
                {t}
              </button>
            ))}
          </div>
        </>
      )}
      {ex.type === "matching" && (
        <>
          <p className="matching-hint">
            Válassz egy vietnámi kifejezést, majd koppints a magyar párjára.
          </p>
          <div className="matching-grid">
            <div>
              {ex.pairs?.map((p) => (
                <button
                  key={p.vi}
                  disabled={checked}
                  className={
                    (activeVi === p.vi ? "selected " : "") +
                    (matches[p.vi] ? "matched" : "")
                  }
                  onClick={() => setActiveVi(p.vi)}
                  lang="vi"
                >
                  {p.vi}
                  {matches[p.vi] && <small>{matches[p.vi]}</small>}
                </button>
              ))}
            </div>
            <div>
              {[...(ex.pairs || [])].reverse().map((p) => (
                <button
                  key={p.hu}
                  disabled={checked || !activeVi}
                  className={
                    Object.values(matches).includes(p.hu) ? "matched" : ""
                  }
                  onClick={() => {
                    const next = { ...matches };
                    for (const key of Object.keys(next))
                      if (next[key] === p.hu) delete next[key];
                    next[activeVi] = p.hu;
                    setMatches(next);
                    setActiveVi("");
                    setAnswer(
                      ex.pairs!.every((q) => next[q.vi])
                        ? ex
                            .pairs!.map((q) => `${q.vi}=${next[q.vi]}`)
                            .join("|")
                        : "",
                    );
                  }}
                >
                  {p.hu}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
      {(ex.type === "translation" || ex.type === "recall") && (
        <>
          <label className="answer-input-label">
            A válaszod vietnámiul
            <input
              inputMode="text"
              enterKeyHint="done"
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              disabled={checked}
              lang="vi"
              placeholder="Írd ide a válaszod…"
              onKeyDown={(e) => {
                if (
                  e.key === "Enter" &&
                  !e.nativeEvent.isComposing &&
                  answer.trim() &&
                  !checked
                )
                  check();
              }}
            />
          </label>
        </>
      )}
      {checked && (
        <div
          className={"feedback " + (correct ? "success" : "retry")}
          role="status"
        >
          <div className="feedback-title">
            {correct ? <Check size={22} /> : <CircleHelp size={22} />}
            <h2>{correct ? "Így van!" : "Ezt most tanultad meg."}</h2>
          </div>
          {
            <p>
              <b>Helyes válasz:</b>{" "}
              <span lang="vi">
                {ex.type === "matching"
                  ? ex.pairs?.map((p) => `${p.vi} → ${p.hu}`).join("; ")
                  : ex.acceptedAnswers[0]}
              </span>
            </p>
          }
          {correct &&
            ex.type === "recall" &&
            normalizeAnswer(answer) !==
              normalizeAnswer(ex.acceptedAnswers[0]) && (
              <p>
                Az ékezet nélküli alakot ebben az első leckében elfogadtuk.
                Jegyezd meg a helyes írásmódot:{" "}
                <b lang="vi">{ex.acceptedAnswers[0]}</b>.
              </p>
            )}
          <p>{ex.explanation}</p>
          {ex.translation && (
            <p className="feedback-translation">{ex.translation}</p>
          )}
        </div>
      )}
      <div className="exercise-actions">
        <span>{checked ? "Válasz rögzítve." : "Nyugodtan gondold végig."}</span>
        {checked ? (
          <button className="primary" onClick={onNext}>
            {isLast ? "Lecke befejezése" : "Következő"}
            <ArrowRight size={18} />
          </button>
        ) : (
          <button className="primary" onClick={check} disabled={!answer.trim()}>
            Ellenőrzés
            <Check size={18} />
          </button>
        )}
      </div>
    </section>
  );
}

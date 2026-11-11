import { useEffect, useRef, useState } from "react";
import { Check, Headphones, Upload } from "lucide-react";
import {
  approveCandidate,
  loadAudioLibrary,
  parseAudioPack,
  saveApprovedAudio,
  type AudioCandidate,
  type SavedAudio,
} from "../audioLibrary";
const flagLabels: Record<string, string> = {
  "manual-listening-required": "Meghallgatás szükséges",
  "zero-duration-alignment": "Bizonytalan szóhatár",
  "ambiguous-multiple-matches": "Több lehetséges felvétel",
  "fuzzy-text-mismatch": "A gépi szöveg eltérhet",
  "unknown-or-low-model-probability": "Bizonytalan beszédfelismerés",
  "accent-unverified": "A nyelvjárás még nincs ellenőrizve",
  "long-gap-between-words": "Hosszú szünet lehet a kifejezésben",
};
function Preview({ clip }: { clip: AudioCandidate }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    const u = URL.createObjectURL(clip.blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [clip]);
  return (
    <audio
      controls
      preload="none"
      src={url}
      aria-label={`Ellenőrzendő felvétel: ${clip.text}`}
    />
  );
}
export default function AudioSettings() {
  const input = useRef<HTMLInputElement>(null);
  const [library, setLibrary] = useState<SavedAudio[]>([]);
  const [pending, setPending] = useState<AudioCandidate[]>([]);
  const [confirmed, setConfirmed] = useState<Record<string, boolean>>({});
  const [played, setPlayed] = useState<Record<string, boolean>>({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const refresh = () =>
    loadAudioLibrary()
      .then(setLibrary)
      .catch(() => setMessage("A hangtár nem olvasható."));
  useEffect(() => {
    void refresh();
  }, []);
  const importPack = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    setMessage("");
    try {
      if (file.size > 45_000_000)
        throw Error("A hangcsomag túl nagy. Legfeljebb 45 MB tölthető be.");
      const pack = await parseAudioPack(JSON.parse(await file.text()));
      if (pack.kind === "vietlingo-audio-review") {
        setPending(pack.clips);
        setConfirmed({});
        setPlayed({});
        setMessage(
          "A felvételek még ellenőrzésre várnak. Hallgasd meg őket, és csak az egyező, északi felvételt hagyd jóvá.",
        );
      } else {
        await saveApprovedAudio(pack.clips as SavedAudio[]);
        await refresh();
        setMessage(
          "Az ellenőrzött hangok elmentve. A megfelelő leckékben már lejátszhatók.",
        );
      }
    } catch (e) {
      setMessage(
        e instanceof Error
          ? e.message
          : "A hangcsomag importálása nem sikerült.",
      );
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };
  const approve = async (clip: AudioCandidate, key: string) => {
    setBusy(true);
    try {
      await saveApprovedAudio([
        approveCandidate(clip, !!confirmed[key] && !!played[key]),
      ]);
      setPending((items) => items.filter((c) => c.id !== clip.id));
      await refresh();
      setMessage(`Elmentve: ${clip.text}. A leckében már meghallgatható.`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "A mentés nem sikerült.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="settings-card audio-settings">
      <h2>
        <Headphones size={20} />
        Saját hanganyag
      </h2>
      <p>
        A podcastból kivágott hangok külön, ezen a telefonon maradnak. Csak
        jóváhagyott felvételt használunk a leckében.
      </p>
      <button
        className="settings-action"
        disabled={busy}
        onClick={() => input.current?.click()}
      >
        <Upload size={20} />
        <span>Hangcsomag importálása</span>
      </button>
      <input
        type="file"
        accept=".json,application/json"
        hidden
        ref={input}
        onChange={(e) => void importPack(e.target.files?.[0])}
      />
      <small>
        {library.length} jóváhagyott felvétel. Azonos hangazonosítóval egy új
        felvétel lecseréli a régit.
      </small>
      {message && (
        <p className="audio-import-status" role="status">
          {message}
        </p>
      )}
      {pending.length > 0 && (
        <div className="audio-review-list">
          <h3>Ellenőrzésre váró jelöltek</h3>
          <p>
            Az automatikus átirat és vágás tévedhet. Egy kifejezéshez egy
            megfelelő jelöltet válassz.
          </p>
          {pending.map((clip, i) => {
            const key = `${clip.id}:${clip.candidateId || i}`;
            return (
              <article key={key} className="audio-candidate">
                <b lang="vi">{clip.text}</b>
                <small>{clip.source.title}</small>
                <div
                  onPlayCapture={() =>
                    setPlayed((v) => ({ ...v, [key]: true }))
                  }
                >
                  <Preview clip={clip} />
                </div>
                {!!clip.flags?.length && (
                  <small className="review-warning">
                    Kézi ellenőrzést igényel ·{" "}
                    {clip.flags
                      .map(
                        (flag) =>
                          flagLabels[flag] || "További ellenőrzés szükséges",
                      )
                      .join(", ")}
                  </small>
                )}
                <label className="review-confirm">
                  <input
                    type="checkbox"
                    checked={!!confirmed[key]}
                    onChange={(e) =>
                      setConfirmed((v) => ({ ...v, [key]: e.target.checked }))
                    }
                  />
                  Meghallgattam. A szöveg egyezik, a kiejtés északi, a szó eleje
                  és vége nem vágódik le.
                </label>
                <button
                  className="primary"
                  disabled={busy || !confirmed[key] || !played[key]}
                  onClick={() => void approve(clip, key)}
                >
                  <Check size={18} />
                  Ezt használom
                </button>
              </article>
            );
          })}
        </div>
      )}
      {library.length > 0 && (
        <div className="audio-saved-list">
          {library.map((clip) => (
            <div key={clip.id}>
              <Check size={15} />
              <span lang="vi">{clip.text}</span>
              <small>{clip.id}</small>
            </div>
          ))}
        </div>
      )}
      <small>
        A jóváhagyás saját ellenőrzést jelent, nem anyanyelvi szaklektorálást.
      </small>
    </section>
  );
}

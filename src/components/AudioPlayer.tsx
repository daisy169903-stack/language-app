import { useEffect, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { loadAudioLibrary, type SavedAudio } from "../audioLibrary";
export default function AudioPlayer({ audioId }: { audioId: string }) {
  const [clip, setClip] = useState<SavedAudio>();
  const [url, setUrl] = useState("");
  useEffect(() => {
    let active = true;
    const load = () =>
      loadAudioLibrary()
        .then((items) => {
          if (active) setClip(items.find((c) => c.id === audioId));
        })
        .catch(() => {
          if (active) setClip(undefined);
        });
    void load();
    window.addEventListener("vietlingo-audio-changed", load);
    return () => {
      active = false;
      window.removeEventListener("vietlingo-audio-changed", load);
    };
  }, [audioId]);
  useEffect(() => {
    if (!clip) {
      setUrl("");
      return;
    }
    const next = URL.createObjectURL(clip.blob);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [clip]);
  if (!clip || !url)
    return (
      <div className="audio-unavailable">
        <VolumeX size={16} />
        <span>
          Ehhez még nincs ellenőrzött hang.
          <small>Hangcsomag importálása a Profil képernyőn.</small>
        </span>
      </div>
    );
  return (
    <div className="lesson-audio">
      <span>
        <Volume2 size={18} />
        Hallgasd meg!
      </span>
      <audio
        controls
        preload="metadata"
        src={url}
        aria-label={`Északi vietnámi: ${clip.text}`}
      />
      <small lang="vi">A felvételen: {clip.text}</small>
      <small>
        {clip.source.title} ·{" "}
        {clip.source.license === "private-study"
          ? "csak magántanulásra"
          : "megosztható felvétel"}
      </small>
    </div>
  );
}

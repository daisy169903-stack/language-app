import { useEffect, useRef, useState } from "react";
import { LoaderCircle, Pause, Volume2 } from "lucide-react";
import type { SourceAudio } from "../sourceAudio";

function waitForMedia(
  element: HTMLAudioElement,
  event: "loadedmetadata" | "seeked",
  action: () => void,
  signal: AbortSignal,
) {
  return new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timeout);
      element.removeEventListener(event, done);
      element.removeEventListener("error", failed);
      signal.removeEventListener("abort", aborted);
    };
    const done = () => {
      cleanup();
      resolve();
    };
    const failed = () => {
      cleanup();
      reject(new Error("Audio unavailable"));
    };
    const aborted = () => {
      cleanup();
      reject(new DOMException("Cancelled", "AbortError"));
    };
    const timeout = setTimeout(failed, 20000);
    element.addEventListener(event, done, { once: true });
    element.addEventListener("error", failed, { once: true });
    signal.addEventListener("abort", aborted, { once: true });
    if (signal.aborted) aborted();
    else {
      try {
        action();
      } catch {
        failed();
      }
    }
  });
}

export default function SourceAudioPlayer({ source }: { source: SourceAudio }) {
  const media = useRef<HTMLAudioElement>(null);
  const pending = useRef<AbortController | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "playing" | "error">(
    "idle",
  );
  useEffect(() => {
    const element = media.current;
    const pause = () => {
      if (element && !element.paused) element.pause();
    };
    const timer = setInterval(() => {
      if (element && !element.paused && element.currentTime >= source.end)
        pause();
    }, 30);
    const hidden = () => {
      if (document.hidden) {
        pending.current?.abort();
        pause();
        setState("idle");
      }
    };
    document.addEventListener("visibilitychange", hidden);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", hidden);
      pending.current?.abort();
      pause();
    };
  }, [source]);
  const play = async () => {
    const element = media.current;
    if (!element) return;
    if (!element.paused) {
      element.pause();
      return;
    }
    setState("loading");
    const controller = new AbortController();
    pending.current?.abort();
    pending.current = controller;
    try {
      if (element.readyState === 0 || element.error)
        await waitForMedia(
          element,
          "loadedmetadata",
          () => element.load(),
          controller.signal,
        );
      if (Math.abs(element.currentTime - source.start) > 0.01)
        await waitForMedia(
          element,
          "seeked",
          () => {
            element.currentTime = source.start;
          },
          controller.signal,
        );
      if (controller.signal.aborted) return;
      await element.play();
      if (controller.signal.aborted) element.pause();
    } catch {
      if (!controller.signal.aborted) setState("error");
    }
  };
  return (
    <div className="lesson-audio source-audio">
      <button
        className="source-play"
        onClick={() => void play()}
        disabled={state === "loading"}
        aria-label={`${source.text} meghallgatása`}
        aria-pressed={state === "playing"}
      >
        <span>
          {state === "loading" ? (
            <LoaderCircle size={23} />
          ) : state === "playing" ? (
            <Pause size={23} />
          ) : (
            <Volume2 size={23} />
          )}
        </span>
        <b>
          {state === "loading"
            ? "Hang betöltése…"
            : state === "playing"
              ? "Lejátszás…"
              : "Hallgasd meg!"}
        </b>
      </button>
      <audio
        ref={media}
        preload="none"
        src={source.url}
        data-source-id={source.id}
        onPlaying={() => setState("playing")}
        onPause={() => setState((s) => (s === "error" ? "error" : "idle"))}
        onError={() => setState("error")}
        onEnded={() => setState("idle")}
        onTimeUpdate={() => {
          const element = media.current;
          if (element && element.currentTime >= source.end) element.pause();
        }}
      />
      {state === "error" && (
        <p className="source-error" role="status">
          A hang nem indult el. Ellenőrizd az internetkapcsolatot, majd próbáld
          újra.
        </p>
      )}
      <small>Eredeti északi podcast · internet szükséges</small>
      <small>
        <a href={source.pageUrl} target="_blank" rel="noopener noreferrer">
          {source.publisher}
        </a>
      </small>
      <small className="source-timing-note">
        Automatikusan kijelölt részlet; nem anyanyelvi lektorálás.
      </small>
    </div>
  );
}

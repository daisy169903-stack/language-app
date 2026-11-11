import { useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { Browser } from "@capacitor/browser";
import { version } from "../../package.json";
import {
  checkForUpdate,
  parseRepository,
  UPDATE_INTERVAL,
  type UpdateResult,
} from "../updates";

const SETTINGS_KEY = "vietlingo.updateSettings.v1";
type Settings = { repository: string; automatic: boolean; lastCheck: number };
const initialSettings: Settings = {
  repository: "daisy169903-stack/language-app",
  automatic: true,
  lastCheck: 0,
};
function readSettings(): Settings {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "null");
    if (
      saved &&
      typeof saved.repository === "string" &&
      typeof saved.automatic === "boolean"
    ) {
      return {
        repository: saved.repository,
        automatic: saved.automatic,
        lastCheck: Number(saved.lastCheck) || 0,
      };
    }
  } catch {
    /* Settings remain usable when storage is unavailable. */
  }
  return initialSettings;
}
const messages: Record<string, string> = {
  checking: "Frissítések keresése…",
  latest: "A legújabb verziót használod.",
  offline:
    "Nem sikerült kapcsolódni. Ellenőrizd az internetkapcsolatot, majd próbáld újra.",
  rateLimit: "A GitHub lekérési korlátja elérve. Próbáld újra később.",
  invalidConfiguration:
    "Ellenőrizd a GitHub-tároló címét. Nyilvános tároló és legalább egy közzétett kiadás szükséges.",
  unauthorized:
    "A GitHub nem engedélyezte a lekérést. Ellenőrizd, hogy a tároló nyilvános-e, majd próbáld újra később.",
  unavailable:
    "Jelenleg nincs letölthető, támogatott Android-kiadás. Próbáld újra később.",
};

export default function UpdateSettings() {
  const [settings, setSettings] = useState(readSettings);
  const [input, setInput] = useState(settings.repository);
  const [result, setResult] = useState<
    UpdateResult | { status: "idle" | "checking" }
  >({ status: "idle" });
  const [storageError, setStorageError] = useState(false);
  const [openError, setOpenError] = useState(false);
  const active = useRef<AbortController | null>(null);
  function persist(next: Settings) {
    setSettings(next);
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
      setStorageError(false);
    } catch {
      setStorageError(true);
    }
  }
  async function check(current: Settings) {
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    setResult({ status: "checking" });
    persist({ ...current, lastCheck: Date.now() });
    try {
      const next = await checkForUpdate(
        current.repository,
        version,
        fetch,
        controller.signal,
      );
      if (!controller.signal.aborted) {
        setResult(next);
        if (next.status === "available")
          window.dispatchEvent(
            new CustomEvent("vietlingo-update-available", {
              detail: { version: next.version },
            }),
          );
      }
    } catch {
      if (!controller.signal.aborted) {
        setResult({ status: "unavailable" });
      }
    }
  }
  useEffect(() => {
    if (
      settings.automatic &&
      parseRepository(settings.repository) &&
      Date.now() - settings.lastCheck >= UPDATE_INTERVAL
    ) {
      void check(settings);
    }
    return () => {
      active.current?.abort();
    };
    // Check once on mount; explicit actions control subsequent checks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  function save() {
    const repository = parseRepository(input);
    active.current?.abort();
    if (!repository) {
      setResult({ status: "invalidConfiguration" });
      return;
    }
    const next = {
      ...settings,
      repository: `${repository.owner}/${repository.repo}`,
      lastCheck: 0,
    };
    setInput(next.repository);
    persist(next);
    setResult({ status: "idle" });
    if (next.automatic) void check(next);
  }
  async function openUpdate(url: string) {
    setOpenError(false);
    try {
      if (Capacitor.isNativePlatform()) await Browser.open({ url });
      else window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      setOpenError(true);
    }
  }
  return (
    <section
      className="update-settings settings-card"
      aria-labelledby="updates-heading"
    >
      <h2 id="updates-heading">Alkalmazásfrissítés</h2>
      <p>
        Telepített verzió: {version}. A frissítések nyilvános GitHub-kiadásokból
        érkeznek, bejelentkezés és hozzáférési kulcs nélkül.
      </p>
      <label htmlFor="update-repository">GitHub-tároló címe</label>
      <input
        id="update-repository"
        type="text"
        inputMode="url"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        placeholder="tulajdonos/tároló"
        value={input}
        onChange={(event) => setInput(event.target.value)}
      />
      <button type="button" onClick={save}>
        Tároló mentése
      </button>
      <label>
        <input
          type="checkbox"
          checked={settings.automatic}
          onChange={(event) => {
            const next = { ...settings, automatic: event.target.checked };
            persist(next);
            if (
              next.automatic &&
              parseRepository(next.repository) &&
              Date.now() - next.lastCheck >= UPDATE_INTERVAL
            )
              void check(next);
          }}
        />{" "}
        Automatikus ellenőrzés naponta, az alkalmazás megnyitásakor
      </label>
      <button
        type="button"
        disabled={result.status === "checking"}
        onClick={() => void check(settings)}
      >
        Frissítések keresése
      </button>
      <div role="status" aria-live="polite">
        {result.status === "available" ? (
          <>
            <p>Új verzió érhető el: {result.version}</p>
            <button type="button" onClick={() => void openUpdate(result.url)}>
              Android-frissítés letöltése
            </button>
            <p>
              A telepítést az Android rendszerben kell jóváhagynod. Az adatok
              megőrzéséhez ne távolítsd el az alkalmazást.
            </p>
          </>
        ) : (
          messages[result.status] && <p>{messages[result.status]}</p>
        )}
        {storageError && (
          <p>A beállításokat nem sikerült elmenteni ezen az eszközön.</p>
        )}
        {openError && <p>A letöltést nem sikerült megnyitni. Próbáld újra.</p>}
      </div>
    </section>
  );
}

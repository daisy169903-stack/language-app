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
import {
  getUpdateToken,
  setUpdateToken,
  clearUpdateToken,
} from "../secureStore";

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
    "Ellenőrizd a GitHub-tároló címét és a hozzáférést. Legalább egy közzétett kiadás szükséges; privát tárolóhoz olvasási token kell.",
  unauthorized:
    "Nincs GitHub-hozzáférés. Ellenőrizd a token érvényességét és a tároló olvasási jogosultságát.",
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
  const [tokenInput, setTokenInput] = useState("");
  const [hasToken, setHasToken] = useState(false);
  const [tokenMessage, setTokenMessage] = useState("");
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
      const token = await getUpdateToken();
      if (controller.signal.aborted) return;
      const next = await checkForUpdate(
        current.repository,
        version,
        fetch,
        controller.signal,
        token,
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
        setTokenMessage("A biztonságos tokentároló nem érhető el.");
      }
    }
  }
  useEffect(() => {
    void getUpdateToken()
      .then((token) => setHasToken(Boolean(token)))
      .catch(() => setTokenMessage("A biztonságos tokentároló nem érhető el."));
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
  async function saveToken() {
    try {
      await setUpdateToken(tokenInput.trim());
      setHasToken(Boolean(tokenInput.trim()));
      setTokenInput("");
      setTokenMessage("Token elmentve.");
      active.current?.abort();
      setResult({ status: "idle" });
      if (settings.automatic && parseRepository(settings.repository)) {
        void check({ ...settings, lastCheck: 0 });
      }
    } catch {
      setTokenMessage("A tokent nem sikerült biztonságosan elmenteni.");
    }
  }
  async function deleteToken() {
    try {
      active.current?.abort();
      await clearUpdateToken();
      setHasToken(false);
      setTokenInput("");
      setTokenMessage("Token törölve.");
      setResult({ status: "idle" });
    } catch {
      setTokenMessage("A tokent nem sikerült törölni.");
    }
  }
  return (
    <section
      className="update-settings settings-card"
      aria-labelledby="updates-heading"
    >
      <h2 id="updates-heading">Alkalmazásfrissítés</h2>
      <p>
        Telepített verzió: {version}. A frissítések GitHub-kiadásokból érkeznek.
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
      <p>
        Privát tárolóhoz hozz létre egy kizárólag ehhez a tárolóhoz tartozó,
        „Contents: Read-only” jogosultságú GitHub fine-grained tokent. Ide írd
        be, ne a csevegésbe. Androidon titkosítva tároljuk; böngészőben csak az
        aktuális munkamenetben marad meg.
      </p>
      <label htmlFor="update-token">GitHub olvasási token (nem kötelező)</label>
      <input
        id="update-token"
        type="password"
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        value={tokenInput}
        onChange={(event) => setTokenInput(event.target.value)}
        placeholder={hasToken ? "Token már mentve" : "github_pat_…"}
      />
      <button
        type="button"
        disabled={!tokenInput.trim()}
        onClick={() => void saveToken()}
      >
        Token biztonságos mentése
      </button>
      <button
        type="button"
        disabled={!hasToken}
        onClick={() => void deleteToken()}
      >
        Token törlése
      </button>
      <p role="status">
        {tokenMessage ||
          (hasToken ? "Olvasási token elmentve." : "Nincs mentett token.")}
      </p>
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
              Privát tárolónál a böngészőben is be kell jelentkezned a GitHubra.
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

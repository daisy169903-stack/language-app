export interface AudioSource {
  title: string;
  url: string;
  license: "private-study" | "publishable";
  accent: "northern" | "unknown";
}
export interface AudioCandidate {
  id: string;
  text: string;
  mimeType: "audio/wav";
  sha256: string;
  source: AudioSource;
  review: {
    status: "pending" | "approved";
    reviewer?: string;
    reviewedAt?: string;
  };
  candidateId?: string;
  confidence?: number | null;
  flags?: string[];
  blob: Blob;
}
export type SavedAudio = AudioCandidate & {
  review: { status: "approved"; reviewer: string; reviewedAt: string };
};
export interface AudioPack {
  kind: "vietlingo-audio-pack" | "vietlingo-audio-review";
  audience: "private" | "public";
  clips: AudioCandidate[];
}
const fail: () => never = () => {
  throw new Error("Érvénytelen vagy nem támogatott hangcsomag.");
};
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const text = (v: unknown, max = 1000): v is string =>
  typeof v === "string" && v.trim().length > 0 && v.length <= max;

/** Decode and verify every clip before exposing a preview or committing anything. */
export async function parseAudioPack(value: unknown): Promise<AudioPack> {
  if (
    !object(value) ||
    value.version !== 1 ||
    !["vietlingo-audio-pack", "vietlingo-audio-review"].includes(
      String(value.kind),
    ) ||
    !["private", "public"].includes(String(value.audience)) ||
    !Array.isArray(value.clips) ||
    !value.clips.length ||
    value.clips.length > 200
  )
    fail();
  const pack = value as Record<string, unknown> & { clips: unknown[] };
  const clips: AudioCandidate[] = [];
  let bytesTotal = 0;
  const keys = new Set<string>();
  for (const raw of pack.clips) {
    if (
      !object(raw) ||
      !text(raw.id, 100) ||
      !/^[a-zA-Z0-9._-]+$/.test(raw.id) ||
      !text(raw.text, 500) ||
      raw.mimeType !== "audio/wav" ||
      typeof raw.dataBase64 !== "string" ||
      raw.dataBase64.length > 4_000_000 ||
      !text(raw.sha256, 64) ||
      !/^[a-fA-F0-9]{64}$/.test(raw.sha256) ||
      !object(raw.source) ||
      !object(raw.review)
    )
      fail();
    const c = raw as Record<string, unknown> & {
      id: string;
      text: string;
      sha256: string;
      dataBase64: string;
      source: Record<string, unknown>;
      review: Record<string, unknown>;
    };
    const source = c.source;
    const review = c.review;
    if (
      !text(source.title, 500) ||
      typeof source.url !== "string" ||
      source.url.length > 2000 ||
      !["private-study", "publishable"].includes(String(source.license)) ||
      !["northern", "unknown"].includes(String(source.accent))
    )
      fail();
    if (source.url) {
      try {
        const u = new URL(source.url);
        if (
          !["https:", "http:"].includes(u.protocol) ||
          u.username ||
          u.password
        )
          fail();
      } catch {
        fail();
      }
    }
    if (pack.audience === "public" && source.license !== "publishable")
      throw new Error(
        "Privát podcastfelvétel nem kerülhet nyilvános hangcsomagba.",
      );
    if (!["pending", "approved"].includes(String(review.status))) fail();
    if (pack.kind === "vietlingo-audio-pack" && review.status !== "approved")
      throw new Error("A hangcsomag nem jóváhagyott felvételt tartalmaz.");
    if (pack.kind === "vietlingo-audio-review" && pack.audience !== "private")
      fail();
    if (
      review.status === "approved" &&
      (!text(review.reviewer, 120) ||
        typeof review.reviewedAt !== "string" ||
        !Number.isFinite(Date.parse(review.reviewedAt)) ||
        source.accent !== "northern")
    )
      fail();
    const candidateId =
      typeof c.candidateId === "string" ? c.candidateId : undefined;
    if (candidateId && !/^[a-zA-Z0-9._-]{1,150}$/.test(candidateId)) fail();
    const key =
      pack.kind === "vietlingo-audio-review"
        ? `${c.id}:${candidateId || c.sha256}`
        : c.id;
    if (keys.has(key)) fail();
    keys.add(key);
    if (
      c.flags !== undefined &&
      (!Array.isArray(c.flags) ||
        c.flags.length > 30 ||
        !c.flags.every((f) => text(f, 300)))
    )
      fail();
    if (
      c.confidence !== undefined &&
      c.confidence !== null &&
      (typeof c.confidence !== "number" ||
        !Number.isFinite(c.confidence) ||
        c.confidence < 0 ||
        c.confidence > 1)
    )
      fail();
    let data: Uint8Array<ArrayBuffer>;
    try {
      const decoded = atob(c.dataBase64);
      data = Uint8Array.from(decoded, (ch) => ch.charCodeAt(0));
    } catch {
      fail();
    }
    bytesTotal += data.byteLength;
    if (
      data.byteLength < 44 ||
      bytesTotal > 32_000_000 ||
      new TextDecoder().decode(data.slice(0, 4)) !== "RIFF" ||
      new TextDecoder().decode(data.slice(8, 12)) !== "WAVE"
    )
      fail();
    const hash = Array.from(
      new Uint8Array(await crypto.subtle.digest("SHA-256", data)),
      (b) => b.toString(16).padStart(2, "0"),
    ).join("");
    if (hash !== c.sha256.toLowerCase())
      throw new Error(
        "A hangfájl ellenőrzőösszege nem egyezik. A csomag sérült lehet.",
      );
    clips.push({
      id: c.id,
      text: c.text,
      mimeType: "audio/wav",
      sha256: hash,
      source: {
        title: source.title as string,
        url: source.url as string,
        license: source.license as AudioSource["license"],
        accent: source.accent as AudioSource["accent"],
      },
      review: {
        status: review.status as "pending" | "approved",
        reviewer: review.reviewer as string | undefined,
        reviewedAt: review.reviewedAt as string | undefined,
      },
      candidateId,
      confidence: c.confidence as number | null | undefined,
      flags: c.flags as string[] | undefined,
      blob: new Blob([data], { type: "audio/wav" }),
    });
  }
  return {
    kind: pack.kind as AudioPack["kind"],
    audience: pack.audience as AudioPack["audience"],
    clips,
  };
}
export function approveCandidate(
  clip: AudioCandidate,
  confirmed: boolean,
  reviewer = "Saját ellenőrzés",
): SavedAudio {
  if (!confirmed || !reviewer.trim())
    throw new Error(
      "Előbb hallgasd meg, és ellenőrizd a szöveget és az északi kiejtést.",
    );
  return {
    ...clip,
    source: { ...clip.source, accent: "northern" },
    review: {
      status: "approved",
      reviewer: reviewer.trim(),
      reviewedAt: new Date().toISOString(),
    },
  };
}
function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("vietlingo-audio", 1);
    req.onupgradeneeded = () =>
      req.result.createObjectStore("clips", { keyPath: "id" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () =>
      reject(new Error("A hangtárat egy másik ablak blokkolja."));
  });
}
export async function saveApprovedAudio(clips: SavedAudio[]): Promise<void> {
  if (
    !clips.length ||
    clips.some(
      (c) =>
        c.review.status !== "approved" ||
        c.source.accent !== "northern" ||
        !c.review.reviewer,
    )
  )
    throw new Error("Csak ellenőrzött hangfelvétel menthető.");
  const db = await database();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("clips", "readwrite");
      for (const clip of clips) tx.objectStore("clips").put(clip);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () =>
        reject(tx.error || new Error("A hangmentés megszakadt."));
    });
  } finally {
    db.close();
  }
  if (typeof window !== "undefined")
    window.dispatchEvent(new Event("vietlingo-audio-changed"));
}
export async function loadAudioLibrary(): Promise<SavedAudio[]> {
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction("clips");
      const req = tx.objectStore("clips").getAll();
      let data: SavedAudio[] = [];
      req.onsuccess = () => {
        data = req.result;
      };
      tx.oncomplete = () => resolve(data);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () =>
        reject(tx.error || new Error("A hangtár nem olvasható."));
    });
  } finally {
    db.close();
  }
}

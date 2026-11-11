import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
/** A public build must never pick up a local podcast pack or unreviewed recording. */
export function assertPublicAssets(root: string): void {
  const publicDir = path.join(root, "public");
  if (!existsSync(publicDir)) return;
  const walk = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
      entry.isDirectory()
        ? walk(path.join(dir, entry.name))
        : [path.join(dir, entry.name)],
    );
  for (const file of walk(publicDir)) {
    const relative = path.relative(publicDir, file).replaceAll("\\", "/");
    if (
      /(^|\/)(private-audio|private|podcasts?)(\/|$)|\.vlaudio\.json$/i.test(
        relative,
      )
    )
      throw new Error(`Privát hanganyag nem kerülhet buildbe: ${relative}`);
    if (/\.(wav|mp3|m4a|ogg|opus|flac|aac)$/i.test(file)) {
      const sidecar = `${file}.license.json`;
      if (!existsSync(sidecar))
        throw new Error(`A publikus hang engedélyezése hiányzik: ${relative}`);
      const info = JSON.parse(readFileSync(sidecar, "utf8"));
      if (
        info.license !== "publishable" ||
        info.review?.status !== "approved" ||
        info.accent !== "northern"
      )
        throw new Error(
          `Nem publikálható vagy nem ellenőrzött hang: ${relative}`,
        );
    }
    if (/\.json$/i.test(file)) {
      const info = JSON.parse(readFileSync(file, "utf8"));
      if (
        info.kind === "vietlingo-audio-review" ||
        (Array.isArray(info.clips) &&
          info.clips.some(
            (clip: { source?: { license?: string } }) =>
              clip.source?.license === "private-study",
          ))
      )
        throw new Error(`Privát hangcsomag nem publikálható: ${relative}`);
    }
  }
}

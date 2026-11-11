import { Capacitor } from "@capacitor/core";

/** Use Android's share sheet for a real file; keep browser downloads for previews. */
export async function exportBackup(json: string, name: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    const [{ Filesystem, Directory, Encoding }, { Share }] = await Promise.all([
      import("@capacitor/filesystem"),
      import("@capacitor/share"),
    ]);
    const file = await Filesystem.writeFile({
      path: name,
      data: json,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
    });
    await Share.share({
      title: "VietLingo HU – biztonsági másolat",
      url: file.uri,
      dialogTitle: "Haladás mentése vagy megosztása",
    });
    return;
  }
  const url = URL.createObjectURL(
    new Blob([json], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

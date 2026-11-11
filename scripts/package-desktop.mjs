import { cp, mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
if (process.platform !== 'win32' || process.arch !== 'x64') {
  throw new Error('Ez a csomagoló Windows x64 környezetet igényel.');
}
const runtime = path.join(path.dirname(require.resolve('electron/package.json')), 'dist');
await stat(path.join(runtime, 'electron.exe'));
await stat(path.join(root, 'dist', 'index.html'));
await stat(path.join(root, 'dist', 'icon.png'));
const releaseRoot = path.join(root, 'release');
await mkdir(releaseRoot, { recursive: true });
let output = path.join(releaseRoot, `VietLingo-HU-${pkg.version}-win-x64`);
try {
  await stat(output);
  // Keep existing packages intact, including a copy that might be running.
  output += `-${Date.now()}`;
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
await cp(runtime, output, {
  recursive: true,
  filter: (source) => path.basename(source) !== 'default_app.asar',
});
const appRoot = path.join(output, 'resources', 'app');
await mkdir(appRoot, { recursive: true });
await cp(path.join(root, 'dist'), path.join(appRoot, 'dist'), { recursive: true });
await cp(path.join(root, 'desktop'), path.join(appRoot, 'desktop'), { recursive: true });
await writeFile(path.join(appRoot, 'package.json'), JSON.stringify({
  name: 'vietlingo-hu', productName: 'VietLingo HU', version: pkg.version,
  private: true, main: 'desktop/main.cjs',
}, null, 2));
await rename(path.join(output, 'electron.exe'), path.join(output, 'VietLingo HU.exe'));
try {
  await rename(path.join(output, 'electron_wer.dll'), path.join(output, 'VietLingo HU_wer.dll'));
} catch (error) { if (error.code !== 'ENOENT') throw error; }
await cp(path.join(root, 'public', 'icon.ico'), path.join(output, 'VietLingo.ico'));
await writeFile(path.join(output, 'OLVASS_EL.txt'), `VietLingo HU ${pkg.version}\r\n\r\nIndítás: kattints kétszer a VietLingo HU.exe fájlra.\r\nNincs szükség Node.js-re, PowerShellre, szerverre vagy internetkapcsolatra.\r\nAz egész mappát tartsd együtt; önmagában az EXE nem másolható.\r\n\r\nHaladás: %APPDATA%\\VietLingo HU\\\r\nBiztonsági másolat: az alkalmazás Beállítások képernyőjén exportálható.\r\nA korábbi böngészős verzió mentése ugyanitt importálható.\r\n\r\nEgy teljes kezdőlecke érhető el. A vietnámi tartalom ellenőrzésre váró vázlat.\r\nJóváhagyott hanganyag és időzített ismétlés még nincs.\r\n`, 'utf8');
await writeFile(path.join(releaseRoot, 'latest.json'), JSON.stringify({
  directory: output, executable: path.join(output, 'VietLingo HU.exe'), version: pkg.version,
}, null, 2));
console.log(`Desktop app: ${path.join(output, 'VietLingo HU.exe')}`);

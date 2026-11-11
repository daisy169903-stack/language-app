'use strict';

const path = require('node:path');

const EXTENSIONS = new Set([
  '.html', '.js', '.css', '.svg', '.png', '.ico', '.woff2', '.ttf', '.txt', '.json',
]);
const PRIVATE_SEGMENTS = new Set(['node_modules', 'desktop', 'src', 'tests', 'qa']);
const PRIVATE_FILES = new Set(['package.json', 'package-lock.json', 'tsconfig.json']);

/** Resolve an untrusted app URL without touching the filesystem. */
function resolveAsset(input, root) {
  if (typeof input !== 'string' || /[\\\s\u0000-\u001f\u007f]/u.test(input)) {
    throw new Error('Invalid asset URL');
  }
  // Inspect the original path: URL() removes dot segments before callers can check them.
  const match = /^vietlingo:\/\/([^/?#]*)([^?#]*)(?:[?#].*)?$/iu.exec(input);
  if (!match || match[1].toLowerCase() !== 'app') throw new Error('Invalid asset origin');
  const url = new URL(input);
  if (url.protocol !== 'vietlingo:' || url.hostname.toLowerCase() !== 'app' ||
      url.username || url.password || url.port) throw new Error('Invalid asset origin');
  if (/%(?:2f|5c)/iu.test(match[2])) throw new Error('Encoded path separator');
  const pathname = decodeURIComponent(match[2]);
  if (/[\\%:\u0000-\u001f\u007f]/u.test(pathname)) throw new Error('Invalid asset path');
  const segments = pathname.split('/').slice(1);
  if (segments.some((segment) => !segment || segment.startsWith('.') ||
      /[. ]$/u.test(segment) || PRIVATE_SEGMENTS.has(segment.toLowerCase()) ||
      /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/iu.test(segment))) {
    if (pathname !== '/' && pathname !== '') throw new Error('Private or invalid asset path');
  }
  const relative = pathname === '/' || pathname === '' ? 'index.html' : pathname.slice(1);
  if (!EXTENSIONS.has(path.extname(relative).toLowerCase()) ||
      PRIVATE_FILES.has(path.basename(relative).toLowerCase())) throw new Error('Unsupported asset');
  const absoluteRoot = path.resolve(root);
  const target = path.resolve(absoluteRoot, relative);
  const confined = path.relative(absoluteRoot, target);
  if (!confined || confined === '..' || confined.startsWith(`..${path.sep}`) || path.isAbsolute(confined)) {
    throw new Error('Asset escapes root');
  }
  return target;
}

module.exports = { resolveAsset };

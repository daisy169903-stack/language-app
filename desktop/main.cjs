'use strict';

const { app, BrowserWindow, dialog, Menu, net, protocol, session } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');
const { pathToFileURL } = require('node:url');
const { resolveAsset } = require('./protocol.cjs');

const TITLE = 'VietLingo HU';
const ENTRY = 'vietlingo://app/index.html';
const DIST = path.resolve(__dirname, '../dist');
const CSP = "default-src 'self';script-src 'self';style-src 'self' 'unsafe-inline';img-src 'self' data: blob:;font-src 'self';connect-src 'self';object-src 'none';base-uri 'none';frame-ancestors 'none'";

app.name = TITLE;
app.setPath('userData', process.env.VIETLINGO_DESKTOP_TEST === '1' && process.env.VIETLINGO_TEST_PROFILE
  ? path.resolve(process.env.VIETLINGO_TEST_PROFILE)
  : path.join(app.getPath('appData'), TITLE));
protocol.registerSchemesAsPrivileged([{
  scheme: 'vietlingo',
  privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true },
}]);

let mainWindow;
let reportingFailure = false;

function fail(error) {
  if (reportingFailure) return;
  reportingFailure = true;
  console.error('VietLingo HU startup failure:', error);
  dialog.showErrorBox('A VietLingo HU nem indítható',
    'Az alkalmazás betöltése nem sikerült. Kérjük, indítsd újra a VietLingo HU alkalmazást. Ha a hiba megmarad, telepítsd újra az alkalmazást.');
  app.exit(1);
}

function isAppNavigation(url) {
  try {
    const target = resolveAsset(url, DIST);
    return target === path.join(DIST, 'index.html');
  } catch { return false; }
}

app.on('web-contents-created', (_event, contents) => {
  contents.setWindowOpenHandler(() => ({ action: 'deny' }));
  contents.on('will-attach-webview', (event) => event.preventDefault());
  contents.on('will-navigate', (event, url) => {
    if (!isAppNavigation(url)) event.preventDefault();
  });
  contents.on('will-redirect', (event, url) => {
    if (!isAppNavigation(url)) event.preventDefault();
  });
});

async function createWindow() {
  mainWindow = new BrowserWindow({
    title: TITLE, width: 1280, height: 900, minWidth: 360, minHeight: 600,
    backgroundColor: '#0c1729', show: false, autoHideMenuBar: true,
    icon: path.join(DIST, 'icon.png'),
    webPreferences: {
      contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true,
      webviewTag: false,
    },
  });
  mainWindow.setMenu(null);
  mainWindow.on('page-title-updated', (event) => { event.preventDefault(); });
  mainWindow.once('ready-to-show', () => mainWindow?.show());
  mainWindow.on('closed', () => { mainWindow = null; });
  mainWindow.webContents.on('did-fail-load', (_event, code, description, _url, isMainFrame) => {
    if (isMainFrame && code !== -3) fail(new Error(description));
  });
  await mainWindow.loadURL(ENTRY);
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });
  app.on('window-all-closed', () => app.quit());
  app.whenReady().then(async () => {
    Menu.setApplicationMenu(null);
    session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
    session.defaultSession.setPermissionCheckHandler(() => false);
    const realRoot = await fs.realpath(DIST);
    protocol.handle('vietlingo', async (request) => {
      try {
        if (request.method !== 'GET' && request.method !== 'HEAD') {
          return new Response('Method not allowed', { status: 405, headers: { 'Content-Security-Policy': CSP } });
        }
        const target = await fs.realpath(resolveAsset(request.url, DIST));
        const relative = path.relative(realRoot, target);
        if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative) ||
            !(await fs.stat(target)).isFile()) throw new Error('Invalid asset file');
        const response = await net.fetch(pathToFileURL(target).href, { method: request.method });
        const headers = new Headers(response.headers);
        headers.set('Content-Security-Policy', CSP);
        headers.set('X-Content-Type-Options', 'nosniff');
        return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
      } catch {
        return new Response('Asset not found', { status: 404, headers: { 'Content-Security-Policy': CSP } });
      }
    });
    await createWindow();
  }).catch(fail);
}

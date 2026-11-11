import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile } from 'node:fs/promises';
import path from 'node:path';
const { _electron } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const release = JSON.parse(await readFile('release/latest.json', 'utf8'));
await mkdir('qa', { recursive: true });
const profile = await mkdtemp(path.resolve('qa/desktop-profile-'));
const backup = path.resolve('qa/desktop-progress-export.json');
const env = { ...process.env, VIETLINGO_DESKTOP_TEST:'1', VIETLINGO_TEST_PROFILE:profile };
delete env.ELECTRON_RUN_AS_NODE;
let app;
const errors = [];
const remote = [];
try {
  app = await _electron.launch({ executablePath:release.executable, env, timeout:30000 });
  let page = await app.firstWindow();
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>{if(/^https?:/.test(r.url()))remote.push(r.url())});
  await page.getByRole('heading',{name:/Egy kicsit közelebb/}).waitFor();
  assert.equal(page.url(),'vietlingo://app/index.html');
  assert.equal(await page.evaluate(()=>typeof window.require),'undefined');
  // File-backed app and IndexedDB remain functional with network disabled.
  await app.context().setOffline(true);
  await page.reload();
  await page.getByRole('heading',{name:/Egy kicsit közelebb/}).waitFor();
  const preferences = await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences());
  assert.equal(preferences.nodeIntegration,false);
  assert.equal(preferences.contextIsolation,true);
  assert.equal(preferences.sandbox,true);
  const click=async(name)=>page.getByRole('button',{name,exact:true}).click();
  const check=async()=>{await click('Ellenőrzés');await page.getByRole('status').filter({hasText:'Így van!'}).waitFor()};
  const next=async()=>click('Következő');
  await click('Kezdjük a tanulást');
  await page.getByRole('button',{name:/A Üdvözöllek, Linh vagyok/}).click();await check();await next();
  for(const [vi,hu]of [['Xin chào','Üdvözlöm'],['Cảm ơn','Köszönöm'],['Tạm biệt','Viszontlátásra']]){await click(vi);await click(hu)}await check();await next();
  for(const t of ['Tôi','tên','là','Anna'])await click(t);await check();await next();
  await page.getByLabel('A válaszod vietnámiul').fill('Tôi là Anna.');await check();await next();
  await page.getByLabel('A válaszod vietnámiul').fill('Cảm ơn!');await check();await next();
  await page.getByRole('button',{name:/C mả/}).click();await check();await click('Lecke befejezése');
  await page.getByRole('heading',{name:'Megérkezett az első „szia”!'}).waitFor();
  assert.match(await page.locator('.completion-stats').innerText(),/60 XP/);
  await page.getByText('Haladás elmentve ezen az eszközön.',{exact:true}).waitFor();
  await page.screenshot({path:'qa/desktop-app-completion.png'});
  await app.close();app=undefined;
  // Reopen the packaged EXE with the same persistent app profile, no server.
  app=await _electron.launch({executablePath:release.executable,env,timeout:30000});
  page=await app.firstWindow();
  page.on('pageerror',e=>errors.push(e.message));
  await page.getByText('Elsajátítva',{exact:true}).waitFor();
  assert.match(await page.locator('.xp-pill').innerText(),/60 XP/);
  await app.context().setOffline(true);
  await page.getByRole('button',{name:'Beállítások',exact:true}).click();
  // Avoid the native save picker only in this isolated automated test.
  await app.evaluate(({session},filename)=>{
    globalThis.__testDownload = new Promise(resolve=>{
      session.defaultSession.once('will-download',(_event,item)=>{
        item.setSavePath(filename);
        item.once('done',(_done,state)=>resolve(state));
      });
    });
  },backup);
  await page.getByRole('button',{name:'Haladás exportálása',exact:true}).click();
  assert.equal(await app.evaluate(()=>globalThis.__testDownload),'completed');
  const saved=JSON.parse(await readFile(backup,'utf8'));assert.equal(saved.xp,60);
  await page.locator('input[type=file]').setInputFiles(backup);
  await page.getByRole('status').filter({hasText:'A haladás importálva'}).waitFor();
  await page.getByRole('button',{name:'Tanulás',exact:true}).click();
  await page.screenshot({path:'qa/desktop-app.png'});
  assert.deepEqual(errors,[]);assert.deepEqual(remote,[]);
  const dataPath=await app.evaluate(({app})=>app.getPath('userData'));
  assert.equal(path.resolve(dataPath),profile);
  console.log('PASS: packaged Windows EXE, offline lesson completion, all six exercise types, restart persistence, export/import, local fonts/assets, isolated renderer and no remote page requests.');
}finally{if(app)await app.close()}

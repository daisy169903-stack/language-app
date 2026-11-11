# VietLingo HU — Android, 0.3

Magyar nyelvű, északi vietnámit célzó tanulóalkalmazás. Az első lecke teljesen kezdőknek készült: három kifejezést **előbb megtanít**, és csak ezután kérdez. Nem kell még mondatokat alkotni vagy vietnámi tónusokat ismerni.

## Használat Androidon

A telefonra telepíthető fájl: **`release/VietLingo-HU-Android.apk`**. A projekt privát GitHub-tárolója: [daisy169903-stack/language-app](https://github.com/daisy169903-stack/language-app). A kiadások az APK-t tartalmazzák; a podcast-hangcsomag külön privát fájl.

1. Töltsd le az APK-t a telefonodra a saját Google Drive-odból.
2. Nyisd meg a letöltött fájlt, és kövesd az Android telepítőjének lépéseit.
3. Indítsd el a **VietLingo HU** alkalmazást.

Android 7.0 vagy újabb rendszer kell. Ez személyes használatra készült, helyi fejlesztői kulccsal aláírt **debug APK**, nem Play Áruházas kiadás. Az elkészült APK minden jelenlegi leckét, betűkészletet és illusztrációt tartalmaz: használatához nem kell PC, futó szerver, internet vagy felhasználói fiók.

Részletes fejlesztői információ: [docs/ANDROID.md](docs/ANDROID.md).

## Az első lecke

1. Tanulókártya: **chào → szia**, majd jelentésfelismerés.
2. Tanulókártya: **cảm ơn → köszönöm**, majd jelentésfelismerés.
3. Tanulókártya: **tạm biệt → viszlát**, majd jelentésfelismerés.
4. A három ismert kifejezés párosítása.
5. Egyetlen szó felidézése: **chào**. Csak itt a `chao` írásmódot is elfogadjuk, és megmutatjuk a pontos ékezetes alakot.
6. Egyszerű helyzetfelismerés a már ismert három kifejezéssel.

A telefon **saját billentyűzete** működik a szövegmezőkben. Nincs alkalmazáson belüli karakterbillentyűzet. A bevitelt nem fókuszáljuk automatikusan; a billentyűzet csak a mező megérintésekor nyílik meg. A vietnámi karakterek később a telefonon beállított vietnámi billentyűzettel írhatók.

## Haladás és mentés

- IndexedDB-alapú helyi mentés és félbehagyott lecke folytatása.
- Feladatonként csak az első válasz ad XP-t: helyes válasz 10, hibás 2. Újrajátszáskor nincs pontgyűjtés.
- Legalább 80% kell az elsajátításhoz; hatból öt helyes válasz már elég.
- Külön készségstatisztikák, napi XP-cél, aktív tanulási napok és két egyszerű mérföldkő.
- A megtanult kifejezések szókincstárba kerülnek; saját kifejezések is hozzáadhatók.
- A Profil képernyőn a mentés Androidon valódi JSON-fájlként a rendszer megosztási paneljén keresztül exportálható. A fájl importálható is; ez felülírja az eszköz aktuális adatait.
- A korábbi, mondatokkal induló lecke félbehagyott munkamenetét az adatbetöltés elhagyja, de a régi XP-t, statisztikákat és szókincset megőrzi. Az új leckének külön azonosítója van.

Az Android-alkalmazás és a régi PC-s/böngészős változat tárhelye különálló. Költözéshez használd az export/import funkciót. Az alkalmazás eltávolítása törölheti a helyi haladást; előtte készíts exportot. Az Android-frissítésekhez őrizd meg a helyi `.android-tools/debug.keystore` aláírókulcsot.

## Nyelvi és hanganyag-státusz

**A vietnámi tananyag ellenőrzésre váró vázlat, nem anyanyelvi beszélő által jóváhagyott tartalom.** Jóváhagyás után saját hangcsomagok valódi WAV-hangja játszható le a tanulókártyákon. TTS és külön hallásértési gyakorlat nincs. Nem jelenítünk meg kitalált hanganyagot vagy hallásértési pontszámot. A későbbi leckékben a megszólítások, udvariasság és természetes mondatok az alapok után következnek.

A korábbi alapfogalmak áttekintéséhez háttérforrásként használtuk Tung Hoang [Basic Vietnamese — Vocabulary](https://openbooks.lib.msu.edu/vietnamese/chapter/u1-vocabulary/) tananyagát. Ez nem a magyar magyarázatok vagy a hanoi kiejtés anyanyelvi jóváhagyása.

Időzített ismétlés és további fejezetek még nincsenek megvalósítva. A külön helyi podcastfeldolgozó elkészült: [használat és ellenőrzés](docs/AUDIO_PIPELINE.md). Podcastból származó hang nincs az APK-ban. A jövőbeli privát hangok helye `private-audio/`, amely a publikus asseteken kívül és a verziókezelésből kizárva marad.

## Felépítés

- `src/data/beginner.json`: szerkeszthető tananyag, tanulókártyák, feladatok, elfogadott válaszok és ellenőrzési státusz.
- `src/domain.ts`: értékelés, XP, elsajátítás, Unicode-normalizálás és mentésvalidálás/migráció.
- `src/components/ExerciseCard.tsx`: tanulókártya → feladat → visszajelzés; a későbbi feladattípusok támogatása megmaradt.
- `src/App.tsx`, `src/styles.css`: telefonra tervezett képernyők, fejezetkártyák és alsó navigáció.
- `src/progress.ts`: IndexedDB, tranzakciós hibajelzés.
- `src/backup.ts`: Android fájl- és megosztási export, böngészőben letöltési fallback.
- `capacitor.config.ts`, `android/`: natív Android-csomag és billentyűzet/safe-area beállítások.
- `public/hanoi-hero.png`: új, beépített ImageGen-illusztráció; prompt és részletek: [docs/ARTWORK.md](docs/ARTWORK.md).
- `public/fonts/`: helyi Be Vietnam Pro betűkészlet, mellékelt SIL OFL licenc.

A régi `desktop/` és Windows-csomag a korábbi kiadásból megmaradt. A fő célplatform Android; a régi asztali alkalmazást nem frissítettük és nem töröltük.

## Fejlesztés és ellenőrzés

```sh
npm install
npm run dev
npm test
npm run build
npm run android:build
```

A függőségek rögzített állapotát a `pnpm-lock.yaml` tartalmazza. A munkaterület Node környezetében npm nélkül is futnak az ellenőrzések:

```sh
node node_modules/tsx/dist/cli.mjs --test tests/domain.test.ts tests/progress.test.ts
node node_modules/typescript/bin/tsc -b
node node_modules/vite/bin/vite.js build
```

A 26 TypeScript/domain-/IndexedDB-/frissítési/buildvédelmi teszt és a 9 Python hangfeldolgozó-teszt sikeres, beleértve a régi mentések adatvesztés nélküli migrációját. A production build és a mobilos böngészőteszt is sikeres. Utóbbi 320/390/412 px telefonos nézeteket, asztali előnézetet, tanítás előtti kérdezés kizárását, az első lecke teljes menetét, helyi mentést, újratöltést, export/importot, saját szókincset és az ismétlés XP-korlátját ellenőrzi. A normál input tulajdonságait és a saját karakterbillentyűzet hiányát is vizsgálja.

Opcionális böngészőteszt, futó production preview mellett:

```powershell
$env:PLAYWRIGHT_MODULE = 'file:///abszolut/ut/playwright/index.mjs'
node tests/ui.mjs
```

A mobilos böngésző-ellenőrzés nem helyettesíti a valódi Android-tesztet. Fizikai telefonon még ellenőrizendő az APK telepítése, a gyári billentyűzet, a kijelzőkivágás és a natív megosztási panel.

## GitHub-frissítés és saját hanganyag (0.3)

A Profil → Alkalmazásfrissítés a privát daisy169903-stack/language-app tárolót ellenőrzi. Az alkalmazás indításakor legfeljebb naponta egyszer keres, és kézi ellenőrzés is van. Privát tárolóhoz a felhasználó egy kizárólag ehhez a tárolóhoz tartozó, Contents: Read-only tokent írhat az alkalmazás jelszómezőjébe; soha ne a csevegésbe vagy a forráskódba. Androidon a token Keystore-kulccsal titkosítva tárolódik, nem kerül a tanulási exportba vagy a biztonsági mentésbe. Az APK letöltése ellenőrzött GitHub URL-ről, a telefon böngészőjében történik; a telepítést az Androidban a felhasználó erősíti meg. A böngészőben is GitHub-bejelentkezés kell a privát kiadáshoz. [Részletek](docs/UPDATES.md).

A verzió növelése és main/master push után a mellékelt workflow készít új kiadást, ha az eredeti aláírókulcs megfelelő Actions secretként rendelkezésre áll. Az aláírókulcs GitHubra töltése külön kifejezett engedélyt igényel; engedély nélkül helyben marad. Azonos verzió kiadását a workflow nem írja felül.

A Profil → Saját hanganyag alatt importálható a külön .vlaudio.json csomag. Függő klipet előbb hallgass meg, ellenőrizd a szöveget, az északi kiejtést és a vágás épségét, majd válaszd az „Ezt használom” gombot. Ez saját ellenőrzés, nem anyanyelvi szaklektorálás. A stabil hangazonosító miatt később ugyanahhoz a leckéhez saját felvétel rendelhető.

A szabadon elérhető [Vietlingo Greetings északi epizódon](https://vietlingo.com/podcast/greetings-chao-hoi-northern) ténylegesen lefutott a helyi ASR: 1019 szó, köztük 10 bizonytalan, nulla hosszúságú szóillesztés. 49 függő klip készült a chào, cảm ơn és teljes megszólítások példáiból. A tạm biệt nem volt megtalálható; ehhez másik saját felvétel kell. Egyetlen valódi jelöltet sem hagytunk automatikusan jóvá. Plus epizódokat nem töltöttünk le.

A podcastfelvétel, átirat, modellek, klipcsomag és aláírókulcs nincs a GitHub-forrásban vagy az APK-ban. A Vite buildvédelem elutasítja a privát hangcsomagokat és az engedélyezési adatok nélküli hangokat a public mappában. A telefonon importált hangok az IndexedDB-hangtárban maradnak, alkalmazásfrissítéskor nem cseréljük le őket.

A tests/audio-ui.mjs az induláskori frissítési jelzést, a hangimportot, a lejátszás + megerősítés feltételét, a valós pending csomag betöltését, a WAV-lejátszást és a sérült csomag elutasítását ellenőrzi. A jóváhagyás mechanikus tesztje külön szintetikus síphangot használ, nem igazolja a vietnámi kiejtést. Fizikai telefonos upgrade, Keystore, billentyűzet és lejátszás még készüléktesztet igényel.

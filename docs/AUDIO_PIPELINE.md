# Helyi vietnámi hangfeldolgozás

A program saját, helyi tananyagból vagy podcastfájlból keres szavakat, kifejezéseket és mondatokat. A gépi átirat és az északi kiejtés **mindig kézi meghallgatást igényel**. A példaszövegek vietnámi tervezetek; nem jelentenek anyanyelvi jóváhagyást. A tesztek szintetikus síphangot használnak, nem vietnámi beszédet, ezért nem igazolják a beszédfelismerés pontosságát.

## Telepítés

A projekt gyökerében, PowerShellben, Python 3.12-vel:

```powershell
python -m venv .audio-tools/venv
.audio-tools/venv/Scripts/python.exe -m pip install -r tools/audio_pipeline/requirements.txt
```

A rögzített `faster-whisper==1.2.1` verzió forrása: [hivatalos PyPI-oldal](https://pypi.org/project/faster-whisper/). A PyAV végzi a dekódolást; külön `ffmpeg.exe` nem szükséges. A feldolgozás CPU-n, `int8` módban fut. Az ASR nyelve `vi`, a szóidőbélyegek engedélyezettek. Nagyobb modell több időt, memóriát és tárhelyet igényelhet. Nincs felhős beszédfelismerés.

A függőséglista a `PyAV 18.1.0` verziót is rögzíti: a 19-es verzió eltávolított egy, a faster-whisper 1.2.1 által használt paramétert ([hivatalos hibajegy](https://github.com/SYSTRAN/faster-whisper/issues/1589)). Mindig a teljes requirements-fájlt telepítsd.

Az alapértelmezett munkamappa `private-audio/workspace`; a projekt `.gitignore` fájlja kizárja a `private-audio/` tartalmát. Ne helyezd a forrást, a modellt, az átiratot vagy a privát csomagot `public/`, `dist/` vagy kiadási mappába. A `--workspace <mappa>` globális kapcsoló a parancs **előtt** álljon. A munkamappa megbízható helyi fájlokat tartalmaz; a JSON-fájlok kézi módosítása felülírhatja az ellenőrzés eredményét.

## 1. Helyi forrás importálása

```powershell
.audio-tools/venv/Scripts/python.exe -m tools.audio_pipeline import "C:/hangok/lecke.mp3" --title "Saját tananyag" --source-url "https://pelda.hu/eredeti-oldal" --license private-study --accent unknown
```

Az eredeti fájl másolata a privát munkamappába kerül. A válaszban lévő `src-...` azonosítót használd a következő lépésekben. A `--source-url` kizárólag származási adat: a parancs nem tölt le URL-t. Csak jogszerűen birtokolt helyi fájlt adj meg. A `publishable` licencet csak akkor válaszd, ha van terjesztési jogod; a nyilvánosan meghallgatható podcast önmagában nem ilyen engedély. Az `--accent northern` csak előzetes forrásadat, a klip későbbi kiejtésellenőrzését nem váltja ki.

## 2. Helyi átirat

```powershell
.audio-tools/venv/Scripts/python.exe -m tools.audio_pipeline transcribe --source-id src-... --model small --allow-model-download
```

Az első futáskor a fenti explicit kapcsoló megengedi a modell letöltését a munkamappa `models/` könyvtárába. A modell letöltése hálózatot igényel; a hangot nem küldi el. A már letöltött modellhez hagyd el a `--allow-model-download` kapcsolót: ekkor csak helyi modellt keres. A `--model` helyi, CTranslate2 formátumú modellkönyvtár is lehet.

A `sources/<source-id>/transcript.json` tartalmazza a szó szövegét, kezdő és záró másodpercét és a nyers `probability` értéket. Ez nem kalibrált helyességi százalék. Az ASR kihagyhat szavakat, elronthatja a tónusjeleket és az időzítést is.

A nyers szóidőbélyegek a validálás előtt a `transcript.raw.json` fájlba is bekerülnek. Az ASR néha azonos kezdő és záró időt ad egy szóhoz: ezt a program változatlanul megőrzi, `zero-duration-alignment` figyelmeztetéssel. Az ilyen szót tartalmazó kivágás továbbra is bizonytalan, függő jelölt. A program nem talál ki szóhosszt és nem hagyja ki a szót a keresési sorból. A nem véges, fordított vagy nem időrendben álló időbélyeg hibát okoz, de a nyers eredmény megmarad.

Meglévő, ellenőrizetlen szóidőbélyegek importálása ASR nélkül:

```powershell
.audio-tools/venv/Scripts/python.exe -m tools.audio_pipeline transcribe --source-id src-... --transcript "timestamps.json"
```

Minimális formátum (az alábbi időpont csak formátumpélda):

```json
{"words":[{"word":"Chào","start":1.2,"end":1.7,"probability":null}]}
```

A `probability` lehet `null`, ha nem ismert. Az importált átirat nem válik automatikusan hitelessé.

## 3. Kért szövegek és kivágás

A `tools/audio_pipeline/requests.example.json` használható kiindulásnak:

```json
[
  {"id":"greeting.chao","text":"Chào"},
  {"id":"politeness.cam-on","text":"Cảm ơn"},
  {"id":"farewell.tam-biet","text":"Tạm biệt"}
]
```

Az `id` a lecke jelentéshez kötött azonosítója. Új saját felvételnél ugyanazt az azonosítót tartsd meg; nem a fájlnév vagy időpont azonosítja a kifejezést. Teljes mondat is megadható a `text` mezőben.

```powershell
.audio-tools/venv/Scripts/python.exe -m tools.audio_pipeline extract --source-id src-... --requests tools/audio_pipeline/requests.example.json
```

A keresés először pontos, egymást követő szavakat keres. Az NFC normalizálás és a kisbetűsítés megengedett; az írásjelek eltérhetnek, a vietnámi tónusjelek megmaradnak. Pontos találat hiányában legfeljebb három hasonló szövegjavaslat készülhet, külön figyelmeztetéssel. Többször előforduló szövegnél minden jelölt külön marad. A nem talált kérések a `review.json` `unmatched` listájába kerülnek. A hasonlósági pontszám nem bizonyítja a szöveg azonosságát.

A `clips/` mappában valódi, mono 16 kHz, 16 bites PCM WAV-fájlok készülnek. A kivágás 180 ms környezetet kér mindkét oldalon; a halk szakaszokat csak ebben a hozzáadott környezetben rövidíti. Az ASR szóintervallumát és lehetőség szerint legalább 80 ms környezetét megtartja. Hibás ASR-időbélyegnél ettől még levághat beszédet: **a teljes szókezdetet, szóvéget és tónust hallgasd meg**. A szomszédos beszéd is benne maradhat; ez tudatosan óvatos kivágás.

Minden jelölt `pending`; nagy valószínűség vagy pontos szövegtalálat sem ad automatikus jóváhagyást. A 0,8 alatti vagy ismeretlen minimum szóvalószínűség figyelmeztetés, nem minőségi garancia. A több találat, az eltérő szöveg, a hosszú szóközi szünet és az ismeretlen nyelvjárás külön jelzést kap.

## 4. Meghallgatás és kézi jóváhagyás

Nyisd meg helyben a `private-audio/workspace/review.html` fájlt. A jelöltek és az eredeti felvétel is lejátszható. Nincs hálózati szerver vagy webes jóváhagyás. A böngésző helyifájl-korlátozásai esetén közvetlenül nyisd meg a WAV-fájlt egy lejátszóval. Hallgasd meg a kért szöveget, a teljes kiejtést, az északi változatot és a vágást.

Csak valódi meghallgatás után:

```powershell
.audio-tools/venv/Scripts/python.exe -m tools.audio_pipeline approve --candidate-id clip-... --reviewer "Saját név" --confirm-text "Chào" --confirm-northern
```

A `--confirm-text` a kért szöveg pontos megismétlése; a `--confirm-northern` annak megerősítése, hogy a meghallgatott kiejtés északi. Ha ezt nem tudod megítélni, kérj hozzáértő ellenőrzést, és hagyd függőben. A program az ellenőrző nevét és az időpontot tárolja. Egy logikai azonosítóhoz mindig a legutóbb kifejezetten kiválasztott jóváhagyott jelölt exportálódik; a korábbi felvétel megmarad a munkamappában.

Telefonos ellenőrzéshez készíts privát jelöltcsomagot:

```powershell
.audio-tools/venv/Scripts/python.exe -m tools.audio_pipeline export-review --output private-audio/review.vlaudio.json
```

Ez a `vietlingo-audio-review` formátum minden függő jelöltet tartalmaz külön `candidateId` értékkel, lejátszható hanggal, nyers valószínűséggel és figyelmeztetésekkel. Mindegyik `review.status: pending`, és a csomag mindig `audience: private`. Az alkalmazás csak kifejezett felhasználói jóváhagyás után engedheti leckehangként használni. A telefonos döntések nem írják vissza automatikusan a számítógép `review.json` fájlját.

## 5. Jóváhagyott csomag exportálása

```powershell
.audio-tools/venv/Scripts/python.exe -m tools.audio_pipeline export --audience private --output private-audio/my-voice.vlaudio.json
```

Csak kiválasztott, kézzel jóváhagyott északi klipek kerülnek bele. Függő jelöltekből üres csomag keletkezik. A lecke kódjának módosítása nélkül lecserélhető a hang, ha a logikai `id` változatlan.

Nyilvános csomaghoz `--audience public` szükséges. **Bármely kiválasztott privát forrás esetén a teljes nyilvános export hibával leáll**, és a meglévő célfájlt nem írja felül. A privát podcastot ne csomagold az alkalmazás nyilvános kiadásába.

A hordozható jóváhagyott csomag sémája:

```text
{version:1, kind:"vietlingo-audio-pack", audience:"private"|"public", clips:[{
  id, text, mimeType:"audio/wav", dataBase64, sha256,
  source:{title,url,license:"private-study"|"publishable",accent:"northern"},
  review:{status:"approved",reviewer,reviewedAt}
}]}
```

Az eredeti helyi útvonal, teljes átirat és eredeti felvétel nem kerül a csomagba. A megadott forráscím és ellenőrzőnév viszont igen; ezekhez ne adj meg titkos adatot. A SHA-256 a csomagban lévő WAV sértetlenségének ellenőrzésére szolgál.

## Ellenőrzés

```powershell
.audio-tools/venv/Scripts/python.exe -m unittest discover -s tests/audio_pipeline -v
```

A tesztek valódi szintetikus WAV-fájlokból ellenőrzik a kivágást és az időzítést, az óvatos csendrövidítést, a tónusérzékeny keresést, a bizonytalan találatokat, a külön jóváhagyási lépést, a stabil azonosítót, a felvételcserét, az export hashét és a privát forrás nyilvános exportjának tiltását. A szintetikus tesztjóváhagyások kizárólag ideiglenes tesztadatokon futnak; nem valódi hanganyag jóváhagyásai. A tesztek nem töltenek le modellt, nem futtatnak ASR-t, és nem bizonyítják egy valódi felvétel vietnámi vagy északi helyességét.

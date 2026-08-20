# Filmul de prezentare Vecini

Un clip vertical de 82 de secunde, 1080×1920, gata de pus pe Instagram Reels,
TikTok, YouTube Shorts sau pe pagina de prezentare.

Totul din el este generat din cod. Nu există nicio înregistrare de ecran făcută
manual, deci filmul se poate reface oricând, identic, după ce aplicația se
schimbă — se rulează din nou și atât.

## Ce se vede în film

Ecranele sunt fotografiate din aplicația reală, rulând local. Datele din ele
sunt inventate în întregime: comunitatea „Aleea Teilor", 24 de vecini, 7
sesizări cu poze, 6 anunțuri, 5 discuții și 2 voturi, toate scrise în
`data.mjs`. **Niciun cont real, nicio parolă, niciun număr de telefon și
niciun email adevărat nu apar nicăieri în film.** Aplicația nu se conectează
la Supabase în timpul fotografierii; toate răspunsurile vin dintr-un
înlocuitor local, iar orice încercare de scriere este aruncată.

Codul de invitație arătat, `ALEEATEI-70`, e cel dintr-o comunitate de test.

## Cum se face filmul

Ai nevoie doar de ce e deja în proiect: Node, dependențele instalate cu
`npm install`, și browserul Chromium pe care îl aduce Playwright. `ffmpeg` vine
din pachetul `ffmpeg-static`, nu trebuie instalat separat în sistem.

```bash
npm install
npm run build
npx vite preview --port 4173 --strictPort &     # lasă-l să meargă până la final

npm run demo:capture    # fotografiază 18 ecrane din aplicație  (≈1 minut)
npm run demo:stage      # duce compoziția lângă ele și reconstruiește
npm run demo:render     # face filmul                            (≈15 minute)
```

Rezultatele apar în `demo/out/`:

| Fișier | Ce e |
|---|---|
| `vecini-demo-fara-text.mp4` | filmul curat, fără subtitrări scrise pe imagine |
| `vecini-demo.mp4` | același film, cu subtitrările scrise pe imagine |
| `vecini-demo.srt` | subtitrările, ca fișier separat |
| `voice-over.txt` | textul de citit, cu minutul fiecărei replici |

Amândouă sunt 1080×1920, 30 de cadre pe secundă, H.264 cu o pistă audio mută.

**Pentru Descript** (sau orice alt editor) ia `vecini-demo-fara-text.mp4` și
`vecini-demo.srt`. Textul scris peste imagine nu se mai poate scoate din
pixeli, așa că filmul de editat e cel curat — editorul își pune propriile
subtitrări din `.srt`, sau le scrie singur din vocea pe care o adaugi. Pista
audio mută e acolo tocmai ca vocea să aibă unde să stea și ca editorul să
așeze corect timeline-ul.

**Pentru publicat direct** ia `vecini-demo.mp4`. Subtitrările sunt deja pe
imagine, ceea ce contează pentru că majoritatea oamenilor se uită fără sonor.
`.srt`-ul rămâne util oricum: YouTube îl indexează.

Ambele ies din aceeași randare, iar subtitrările scrise pe imagine sunt arse
din exact același `.srt`, deci nu au cum să ajungă să se contrazică.

## Înainte de randarea lungă

`npm run demo:preview` face doar 12 cadre, din momentele importante, în
`demo/preview/`. Se uită omul la ele în câteva secunde și vede dacă e ceva
strâmb, în loc să aștepte un sfert de oră ca să afle.

## Vocea

Filmul iese cu o pistă audio mută. Textul de citit e în
`demo/out/voice-over.txt`, cu momentul fiecărei replici.

În Descript: pui `vecini-demo-fara-text.mp4` pe timeline, înregistrezi sau
generezi vocea peste el, și lași editorul să facă subtitrările din vocea aceea.

Din linia de comandă, dacă ai deja un fișier de voce:

```bash
ffmpeg -i demo/out/vecini-demo.mp4 -i voce.mp3 \
       -map 0:v -map 1:a -c:v copy -c:a aac -shortest \
       demo/out/vecini-demo-cu-voce.mp4
```

## Cum e făcut, pe scurt

| Fișier | Ce face |
|---|---|
| `timeline.mjs` | filmul scris o singură dată: scenele, textul, subtitrările. Și compoziția și fișierul `.srt` citesc de aici, deci nu pot ajunge să se contrazică |
| `data.mjs` | comunitatea inventată |
| `photos.mjs` | pozele sesizărilor, desenate ca SVG |
| `harness.mjs` | servește comunitatea inventată aplicației reale |
| `capture.mjs` | fotografiază 18 ecrane, la rezoluție triplă |
| `stage.html` | compoziția: telefonul, tranzițiile, textele. Primește `?t=` în milisecunde și desenează exact cadrul acela |
| `render.mjs` | cere pe rând cele 2460 de cadre și le dă lui ffmpeg |
| `subtitles.mjs` | scrie `.srt`-ul și textul pentru voce |

Compoziția e o funcție de timp și nimic altceva: pentru aceeași milisecundă
desenează întotdeauna același lucru. De aceea randarea se poate opri și relua,
iar două rulări dau exact același film.

## Dacă vrei să schimbi ceva

Textele, momentele și subtitrările sunt toate în `timeline.mjs`. Scenele se
lungesc sau se scurtează schimbând `t0` și `t1`, iar `DURATION` trebuie să
rămână egal cu `t1`-ul ultimei scene. După orice modificare:
`npm run demo:stage`, apoi `npm run demo:preview` ca să te uiți întâi.

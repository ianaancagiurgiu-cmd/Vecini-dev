# Scenarii de test pentru baza de date

> Document generat automat de `npm run test:db`. Nu îl edita de mână: se rescrie la fiecare rulare, din aceleași scenarii care se execută.

## Pe scurt

Rulat la 20 noiembrie 2026, pe o bază de date PostgreSQL reală, cu toate cele 24 migrări aplicate în ordine.

| | |
|---|---|
| Scenarii rulate | **154** |
| Trec | **154** |
| Probleme confirmate | **0** |
| De decis (comportament nedocumentat) | **5** |
| Eșecuri neașteptate | **0** |


## Ce se testează și cum

Testele de interfață (cele din `tests/`) verifică ce face un ecran cu un răspuns dat. Nu pot dovedi că o comunitate nu vede datele alteia, pentru că răspunsul îl dau ele însele. Regula aceea nu stă în ecrane, ci în baza de date.

De aceea scenariile de aici rulează direct pe baza de date: fiecare e executat **ca un anume om** — cu rolul și identitatea lui, exact cum îl vede Supabase — și încearcă ceva ce are sau nu are voie să facă. După fiecare scenariu, tot ce a făcut se anulează, deci scenariile nu se influențează între ele.

Fiecare scenariu verifică ce **promite documentația** (studiul de caz și explicațiile din migrări), nu ce se întâmplă să facă codul. Unde cele două diferă, scenariul pică și apare mai jos ca problemă.

### Personajele

| Cine | Unde locuiește | Rol |
|---|---|---|
| Ana Pop | A — Aleea Teilor 15-20 | administrator |
| Mihai Georgescu | A | moderator |
| Ioana Rusu | A | vecin |
| Dan Marin | A | vecin |
| Bogdan Ilie | B — Strada Popești 8 | administrator |
| Carmen Dobre | B | vecin |
| Maria Stan | A și B | vecin în amândouă |
| Radu Neagu | nicăieri | are cont, dar nicio comunitate |
| vizitatorul | — | fără cont, doar cu cheia publică a aplicației |

## Probleme găsite

Niciuna.

## De decis

Scenariile de mai jos trec: ele doar fixează ce se întâmplă astăzi. Dar ce se întâmplă astăzi nu e scris nicăieri ca fiind intenționat, așa că rămâne o decizie de produs, nu un defect.

| Nr. | Situația | Ce se întâmplă astăzi | De hotărât |
|---|---|---|---|
| INT-11 | Un vecin scos de administrator se întoarce cu același cod de invitație | Astăzi reușește: codul rămâne valabil până când administratorul îl schimbă. | Scoaterea unui vecin nu îl împiedică să revină. Dacă scoaterea trebuie să fie definitivă, e nevoie fie de o listă de persoane blocate, fie de schimbarea automată a codului la fiecare excludere. (Punând comunitatea pe „intrare cu aprobare”, revenirea ar trece prin administrator.) |
| INT-15 | Toți membrii pleacă dintr-o comunitate, apoi cineva intră cu vechiul cod | Astăzi, primul venit devine administrator și moștenește toată arhiva: registrul de plăți, documentele, discuțiile. | O comunitate rămasă fără niciun membru își păstrează conținutul și codul. Primul care intră ulterior îi devine administrator și vede tot ce a fost acolo, inclusiv cine cât a plătit. Variante: comunitatea goală se arhivează, sau codul ei se dezactivează când pleacă ultimul om. |
| SON-10 | După ce oamenii au votat, administratorul schimbă întrebarea sondajului | Astăzi reușește: voturile date pentru „Schimbăm poarta?” rămân lipite de noua întrebare. | Administrația poate schimba întrebarea, termenul și tipul unui sondaj după ce s-a votat, poate redeschide unul închis și poate adăuga variante noi. Variantele existente și voturile sunt protejate, întrebarea nu. Dacă sondajele țin loc de „cine a fost de acord cu ce”, întrebarea ar trebui înghețată după primul vot. |
| FON-09 | Un moderator își trece singur plata ca făcută | Astăzi reușește: administrația poate înregistra o plată și pe propriul nume. | Regula din documentație e că „cine a dat banii nu e niciodată cel care a scris plata”. Pentru un vecin simplu, baza de date o impune. Pentru un moderator sau administrator care își plătește propria cotă, nu — își poate confirma singur plata. Variante: cere ca plata proprie să fie înregistrată de alt membru al administrației, sau acceptă situația ca firească în asociațiile mici. |
| NOT-05 | Un vecin simplu trimite tuturor o notificare care arată ca un anunț oficial, cu un link din afara aplicației | Astăzi reușește: funcția de trimitere verifică doar că ești membru, nu și ce trimiți. | Notificările sunt create de aplicația fiecărui utilizator, nu de server. Orice vecin poate deci trimite celorlalți o notificare cu orice titlu și orice link, inclusiv una care imită un anunț al administrației sau duce în afara aplicației. Variante: notificările să fie create de baza de date atunci când apare anunțul/comentariul (declanșatoare), sau măcar linkul să fie limitat la adrese din aplicație. |

## Toate scenariile

### IZO — Izolarea între comunități

Carmen și Bogdan locuiesc pe Strada Popești (B). Niciunul nu are ce căuta în datele de pe Aleea Teilor (A) — nici ca vecin, nici ca administrator al altei comunități.

| Nr. | Scenariu | Rezultat așteptat | Rezultat | Regula vine din |
|---|---|---|---|---|
| IZO-01 | Un vecin din B încearcă să citească anunțurile comunității A | Nu primește niciun rând. | ✅ trece | Studiu de caz, „Tehnologie”: autorizarea stă în baza de date, ca o regulă să nu poată fi ocolită de nimic care ajunge la date pe altă cale. |
| IZO-02 | Un vecin din B încearcă să citească discuțiile comunității A | Nu primește niciun rând. | ✅ trece | Studiu de caz, „Tehnologie”: autorizarea stă în baza de date, ca o regulă să nu poată fi ocolită de nimic care ajunge la date pe altă cale. |
| IZO-03 | Un vecin din B încearcă să citească răspunsurile din discuții comunității A | Nu primește niciun rând. | ✅ trece | Studiu de caz, „Tehnologie”: autorizarea stă în baza de date, ca o regulă să nu poată fi ocolită de nimic care ajunge la date pe altă cale. |
| IZO-04 | Un vecin din B încearcă să citească sesizările comunității A | Nu primește niciun rând. | ✅ trece | Studiu de caz, „Tehnologie”: autorizarea stă în baza de date, ca o regulă să nu poată fi ocolită de nimic care ajunge la date pe altă cale. |
| IZO-05 | Un vecin din B încearcă să citească comentariile de la sesizări comunității A | Nu primește niciun rând. | ✅ trece | Studiu de caz, „Tehnologie”: autorizarea stă în baza de date, ca o regulă să nu poată fi ocolită de nimic care ajunge la date pe altă cale. |
| IZO-06 | Un vecin din B încearcă să citească istoricul sesizărilor comunității A | Nu primește niciun rând. | ✅ trece | Studiu de caz, „Tehnologie”: autorizarea stă în baza de date, ca o regulă să nu poată fi ocolită de nimic care ajunge la date pe altă cale. |
| IZO-07 | Un vecin din B încearcă să citească cine susține o sesizare comunității A | Nu primește niciun rând. | ✅ trece | Studiu de caz, „Tehnologie”: autorizarea stă în baza de date, ca o regulă să nu poată fi ocolită de nimic care ajunge la date pe altă cale. |
| IZO-08 | Un vecin din B încearcă să citească sondajele comunității A | Nu primește niciun rând. | ✅ trece | Studiu de caz, „Tehnologie”: autorizarea stă în baza de date, ca o regulă să nu poată fi ocolită de nimic care ajunge la date pe altă cale. |
| IZO-09 | Un vecin din B încearcă să citească variantele de vot comunității A | Nu primește niciun rând. | ✅ trece | Studiu de caz, „Tehnologie”: autorizarea stă în baza de date, ca o regulă să nu poată fi ocolită de nimic care ajunge la date pe altă cale. |
| IZO-10 | Un vecin din B încearcă să citească voturile comunității A | Nu primește niciun rând. | ✅ trece | Studiu de caz, „Tehnologie”: autorizarea stă în baza de date, ca o regulă să nu poată fi ocolită de nimic care ajunge la date pe altă cale. |
| IZO-11 | Un vecin din B încearcă să citească fondurile comunității A | Nu primește niciun rând. | ✅ trece | Studiu de caz, „Tehnologie”: autorizarea stă în baza de date, ca o regulă să nu poată fi ocolită de nimic care ajunge la date pe altă cale. |
| IZO-12 | Un vecin din B încearcă să citească plățile la fonduri comunității A | Nu primește niciun rând. | ✅ trece | Studiu de caz, „Tehnologie”: autorizarea stă în baza de date, ca o regulă să nu poată fi ocolită de nimic care ajunge la date pe altă cale. |
| IZO-13 | Un vecin din B încearcă să citească sumele individuale la fonduri comunității A | Nu primește niciun rând. | ✅ trece | Studiu de caz, „Tehnologie”: autorizarea stă în baza de date, ca o regulă să nu poată fi ocolită de nimic care ajunge la date pe altă cale. |
| IZO-14 | Un vecin din B încearcă să citească documentele comunității A | Nu primește niciun rând. | ✅ trece | Studiu de caz, „Tehnologie”: autorizarea stă în baza de date, ca o regulă să nu poată fi ocolită de nimic care ajunge la date pe altă cale. |
| IZO-15 | Un vecin din B încearcă să citească lista de membri comunității A | Nu primește niciun rând. | ✅ trece | Studiu de caz, „Tehnologie”: autorizarea stă în baza de date, ca o regulă să nu poată fi ocolită de nimic care ajunge la date pe altă cale. |
| IZO-16 | Un vecin din B încearcă să citească aprecierile comunității A | Nu primește niciun rând. | ✅ trece | Studiu de caz, „Tehnologie”: autorizarea stă în baza de date, ca o regulă să nu poată fi ocolită de nimic care ajunge la date pe altă cale. |
| IZO-17 | Un vecin din B încearcă să citească evidența conturilor șterse comunității A | Nu primește niciun rând. | ✅ trece | Studiu de caz, „Tehnologie”: autorizarea stă în baza de date, ca o regulă să nu poată fi ocolită de nimic care ajunge la date pe altă cale. |
| IZO-18 | Fără niciun filtru, un vecin din B cere „toate” rândurile din fiecare tabel | Primește doar rândurile comunității lui — niciunul din A. | ✅ trece | Studiu de caz, „Tehnologie”: autorizarea stă în baza de date, ca o regulă să nu poată fi ocolită de nimic care ajunge la date pe altă cale. |
| IZO-19 | Un vecin care e în ambele comunități cere datele fiecăreia | Le vede pe amândouă, fiecare separat, și nimic nu se amestecă între ele. | ✅ trece | Studiu de caz, „Tehnologie”: autorizarea stă în baza de date, ca o regulă să nu poată fi ocolită de nimic care ajunge la date pe altă cale. |
| IZO-20 | Un vecin din B încearcă să scrie o discuție, o sesizare și un comentariu în A | Toate trei sunt refuzate. | ✅ trece | Studiu de caz, „Tehnologie”: autorizarea stă în baza de date, ca o regulă să nu poată fi ocolită de nimic care ajunge la date pe altă cale. |
| IZO-21 | Administratorul din B încearcă să publice un anunț, un sondaj, un fond și un document în A | Toate sunt refuzate: e administrator doar la el acasă. | ✅ trece | Studiu de caz, „Tehnologie”: autorizarea stă în baza de date, ca o regulă să nu poată fi ocolită de nimic care ajunge la date pe altă cale. |
| IZO-22 | Administratorul din B încearcă să modifice sau să șteargă conținut din A | Nimic nu se schimbă în A. | ✅ trece | Studiu de caz, „Tehnologie”: autorizarea stă în baza de date, ca o regulă să nu poată fi ocolită de nimic care ajunge la date pe altă cale. |
| IZO-23 | Un vecin din B încearcă să voteze, să susțină o sesizare și să aprecieze un comentariu din A | Toate trei sunt refuzate. | ✅ trece | Studiu de caz, „Tehnologie”: autorizarea stă în baza de date, ca o regulă să nu poată fi ocolită de nimic care ajunge la date pe altă cale. |
| IZO-24 | Administratorul din B încearcă să înregistreze o plată la un fond din A | Refuzat: registrul unei comunități îl scriu doar oamenii ei. | ✅ trece | Migrarea 0016: „Staff see everything, because they are the ones keeping the record.” — staff-ul comunității respective. |
| IZO-25 | Un vecin din B cere totalurile fondurilor din A (fund_summary) | Funcția nu întoarce nimic cui nu e membru. | ✅ trece | Migrarea 0016: „the one thing it must not do is hand the totals of a community to somebody who is not in it.” |
| IZO-26 | Un vecin din B trimite notificări în A prin notify_members și notify_user | Ambele funcții refuză pe cine nu e membru al comunității numite. | ✅ trece | Migrarea 0002: „security definer bypasses RLS, so re-check the caller belongs here.” |
| IZO-27 | Un vecin din B folosește notify_user din propria comunitate ca să scrie cuiva din A | Nu se trimite nimic: destinatarul trebuie să fie membru al aceleiași comunități. | ✅ trece | Migrarea 0002. |
| IZO-28 | Un vecin din B scrie direct în tabelul de notificări un rând pentru cineva din A | Refuzat: nu poți pune o notificare în lista cuiva cu care nu împarți comunitatea. | ✅ trece | Migrarea 0001: „Notifications & preferences: strictly private to their owner.” |
| IZO-29 | Administratorul din B schimbă roluri sau predă administrarea în A | set_member_role și transfer_admin refuză: nu e administrator acolo. | ✅ trece | Migrarea 0010. |
| IZO-30 | Administratorul din B mută un membru al lui în A, modificând rândul de apartenență | Refuzat: apartenența la altă comunitate nu se poate fabrica dintr-un rând propriu. | ✅ trece | Studiu de caz, „Tehnologie”: autorizarea stă în baza de date, ca o regulă să nu poată fi ocolită de nimic care ajunge la date pe altă cale. |
| IZO-31 | Un vecin din B corectează comentariul altcuiva din A prin edit_comment | Refuzat: funcția schimbă doar mesajele proprii. | ✅ trece | Migrarea 0015. |
| IZO-32 | Un autor din B își mută propria discuție în comunitatea A | Refuzat: un text scris în B nu poate apărea pe avizierul lui A. | ✅ trece | Studiu de caz, „Tehnologie”: autorizarea stă în baza de date, ca o regulă să nu poată fi ocolită de nimic care ajunge la date pe altă cale. |
| IZO-33 | Un administrator din B atașează un document de-al lui la un fond din A | Chiar dacă rândul se scrie, membrii lui A nu îl văd printre hârtiile fondului lor. | ✅ trece | Migrarea 0017. |
| IZO-34 | Un vecin din B cere fișierele comunității A (documente și poze de la sesizări) | Nu vede niciun fișier din A, deci nu poate obține nici link semnat pentru ele. | ✅ trece | Migrările 0017 și 0018: bucket privat, acces după primul folder din cale. |
| IZO-35 | Administratorul din B încarcă un fișier în folderul de documente al lui A | Refuzat. La fel pentru o poză de sesizare pusă de un vecin din B în folderul lui A. | ✅ trece | Migrările 0017 și 0018. |
| IZO-36 | Căi de fișier construite ca să păcălească verificarea comunității | Orice cale al cărei prim folder nu e exact id-ul unei comunități în care ești membru e refuzată. | ✅ trece | Migrarea 0017: „reads it back without letting a malformed path raise”. |
| IZO-37 | Pozele vechi (dinainte de migrarea 0018) și tabelul care le leagă de comunitate | Un vecin din altă comunitate nu vede poza veche, iar tabelul de legătură nu îi spune ce fișiere are altă comunitate. | ✅ trece | Migrarea 0019. |
| IZO-38 | Un utilizator oarecare află din ce comunitate face parte un fond, știindu-i doar id-ul | Funcția ajutătoare nu răspunde celor care nu sunt membri. | ✅ trece | Migrarea 0016. |

### ANO — Vizitatorul fără cont

Cheia publică a aplicației stă în codul paginii, la vedere. Oricine o poate folosi ca să întrebe baza de date direct, fără să se înregistreze. Acestea sunt întrebările lui.

| Nr. | Scenariu | Rezultat așteptat | Rezultat | Regula vine din |
|---|---|---|---|---|
| ANO-01 | Un vizitator fără cont citește, pe rând, fiecare tabel cu date ale comunităților | Nu primește niciun rând din niciunul. | ✅ trece | Migrarea 0005: „row-level security (correctly) hides communities from anonymous visitors”. |
| ANO-02 | Un vizitator fără cont citește numele și apartamentele tuturor utilizatorilor | Nu primește nimic: numele și apartamentul sunt pentru oameni cu cont. | ✅ trece | Migrarea 0009 descrie profilul ca „readable by anyone signed in” — adică autentificat, nu oricine. |
| ANO-03 | Un vizitator verifică un cod de invitație înainte să-și facă cont | Află doar id-ul și numele comunității — fără adresă, cod, descriere sau membri. Codul merge indiferent de majuscule și de spații. | ✅ trece | Migrarea 0005: „it returns the community's id and name and nothing else”. |
| ANO-04 | Coduri de invitație greșite, goale sau construite ca să ghicească | Niciunul nu întoarce o comunitate: nici bucăți de cod, nici semne de înlocuire, nici text de tip SQL. | ✅ trece | Migrarea 0005. |
| ANO-05 | Un vizitator fără cont încearcă să scrie: o discuție, o apartenență, o notificare, o comunitate | Toate sunt refuzate. | ✅ trece | Migrarea 0001. |
| ANO-06 | Un vizitator fără cont apelează funcțiile cu drepturi ridicate | Niciuna nu face nimic pentru el. | ✅ trece | Migrările 0002, 0004, 0007, 0010, 0015, 0016: fiecare funcție e dată doar rolului „authenticated”. |
| ANO-07 | Funcțiile rezervate oamenilor cu cont, văzute dinspre un vizitator | Nu le poate nici măcar apela — nu doar că nu fac nimic pentru el. | ✅ trece | Migrarea 0020: pe Supabase, „revoke … from public” nu îl atinge pe vizitator; trebuie numit. |

### INT — Intrarea într-o comunitate

Radu are cont, dar nu e în nicio comunitate. Singurul lucru care ar trebui să-i deschidă ușa e codul de invitație primit de la un vecin.

| Nr. | Scenariu | Rezultat așteptat | Rezultat | Regula vine din |
|---|---|---|---|---|
| INT-01 | Un om cu cont, fără comunitate, cere lista comunităților și codurile lor de invitație | Nu află codul niciunei comunități în care nu e membru. | ✅ trece | Migrarea 0005: cine are un cod află doar numele comunității. Codul e singura cheie de intrare. |
| INT-02 | Un om cu cont intră într-o comunitate fără cod, scriindu-și singur apartenența | Refuzat. Fără cod nu se intră. | ✅ trece | Migrarea 0020: „takes a code, not an id”. |
| INT-03 | Odată intrat astfel, ce poate citi | Nimic din comunitatea în care nu a fost invitat: nici anunțuri, nici plăți, nici telefoane. | ✅ trece | Studiu de caz: „Access rules could not be a matter of hiding controls in the interface.” |
| INT-04 | La intrare, cineva își cere singur rolul de administrator | Rolul cerut e ignorat: cine intră într-o comunitate cu membri e vecin simplu. | ✅ trece | Migrarea 0001: „A client can never grant itself admin/moderator by simply asking for it.” |
| INT-05 | Cineva înscrie pe altcineva într-o comunitate, în numele lui | Refuzat: fiecare intră doar el însuși. | ✅ trece | Migrarea 0001: „Anyone signed in can insert themselves”. |
| INT-06 | Același om intră de două ori în aceeași comunitate | A doua încercare nu strică nimic și nu îl dublează: rămâne un singur rând, cu același rol. | ✅ trece | Migrarea 0001: unique (user_id, community_id). Migrarea 0020. |
| INT-07 | Cineva creează o comunitate nouă | Devine administratorul ei din aceeași clipă; următorul care intră cu codul e vecin simplu. O comunitate nu poate fi creată pe altă cale. | ✅ trece | Migrarea 0001: „the first member of a community becomes its admin automatically”. Migrarea 0020. |
| INT-08 | Între crearea unei comunități și intrarea fondatorului, altcineva se înscrie primul | Nu există un „între”: comunitatea și administratorul ei apar în același pas, iar un străin nu se poate înscrie singur. | ✅ trece | Migrarea 0020: „makes the community and its founder's membership in one statement, so there is no gap to stand in”. |
| INT-09 | Un vecin iese din comunitate | Nu mai vede nimic din ea, dar ce a scris rămâne la locul lui. | ✅ trece | Migrarea 0001: „members can remove only themselves (leave)”. |
| INT-10 | Administratorul scoate un vecin din comunitate | Vecinul pierde accesul pe loc. Un vecin simplu sau un moderator nu pot scoate pe nimeni. | ✅ trece | Migrarea 0001: „Admins can change roles or remove members”. |
| INT-11 | Un vecin scos de administrator se întoarce cu același cod de invitație | Astăzi reușește: codul rămâne valabil până când administratorul îl schimbă. | ⚠️ trece, de decis | — (nedocumentat) |
| INT-12 | Doar administratorul schimbă codul de invitație și setările comunității | Vecinul și moderatorul sunt refuzați. După schimbare, codul vechi nu mai deschide nimic. | ✅ trece | Migrarea 0001: „Only an admin of that community can change its settings.” |
| INT-13 | Un administrator își pune drept cod codul altei comunități, scris cu litere mici | Refuzat: două comunități nu pot avea același cod, indiferent de majuscule — altfel invitații uneia ajung în cealaltă. | ✅ trece | Migrarea 0001 (code unique) + 0005 (căutarea ignoră majusculele). |
| INT-14 | Comunitatea e pusă pe „intrare cu aprobare”, iar cineva cu codul se înscrie | Nu devine membru până nu îl aprobă administratorul: cererea lui așteaptă, iar el nu vede nimic din comunitate. | ✅ trece | Ecranul „Setări comunitate” oferă trei moduri de intrare, între care „cu aprobare”. Migrarea 0020. |
| INT-16 | Administratorul aprobă o cerere de intrare | Omul devine vecin simplu și vede comunitatea; cererea dispare. Doar administratorul poate aproba — nu moderatorul, nu un vecin, nu cel care a cerut. | ✅ trece | Migrarea 0020. |
| INT-17 | Administratorul respinge o cerere, sau omul și-o retrage singur | În ambele cazuri cererea dispare și nu rămâne nicio apartenență. Nimeni nu poate retrage cererea altcuiva. | ✅ trece | Migrarea 0020. |
| INT-18 | Cineva cere să intre, apoi își șterge contul înainte să fie aprobat | Cererea dispare odată cu contul: administratorul nu poate aproba un cont în spatele căruia nu mai e nimeni. | ✅ trece | Migrarea 0020: „An account that has been given up is not waiting for anything.” |
| INT-19 | O comunitate „cu aprobare” în care nu mai e nimeni | Următorul om cu codul intră direct: nu mai e nimeni care să-l aprobe. | ✅ trece | Migrarea 0020. |
| INT-15 | Toți membrii pleacă dintr-o comunitate, apoi cineva intră cu vechiul cod | Astăzi, primul venit devine administrator și moștenește toată arhiva: registrul de plăți, documentele, discuțiile. | ⚠️ trece, de decis | — (nedocumentat) |

### ROL — Roluri: vecin, moderator, administrator

În comunitatea A: Ana e administrator, Mihai moderator, Ioana și Dan vecini simpli.

| Nr. | Scenariu | Rezultat așteptat | Rezultat | Regula vine din |
|---|---|---|---|---|
| ROL-01 | Un vecin simplu încearcă tot ce e rezervat administrației | Fiecare încercare e refuzată: anunț, sondaj, fond, plată, document, schimbare de status, ascunderea unei discuții. | ✅ trece | Migrarea 0001 („members read; staff write”), 0012, 0016, 0017. |
| ROL-02 | Moderatorul face ce ține de moderare și de avizier | Poate publica și șterge anunțuri, ascunde discuții, schimba statusul unei sesizări, crea sondaje, ține registrul fondurilor și pune documente. | ✅ trece | Migrarea 0001: „staff (admin/moderator) write”. |
| ROL-03 | Moderatorul încearcă ce ține doar de administrator | Refuzat: roluri, predarea comunității, setări, cod, scoaterea membrilor. | ✅ trece | Migrarea 0010. |
| ROL-04 | Cineva scrie în numele altcuiva | Refuzat peste tot: anunț, discuție, sesizare, comentariu, vot, susținere, apreciere, plată, document, arhivare. | ✅ trece | Fiecare politică de inserare cere „author_id = auth.uid()” sau echivalentul. |
| ROL-05 | Un moderator rescrie textul unei discuții sau al unei sesizări scrise de altcineva | Refuzat: moderarea înseamnă a ascunde, nu a pune cuvinte în gura cuiva. | ✅ trece | Migrarea 0001: „staff can update status (moderation)”. Migrarea 0015: o corectură lasă întotdeauna un semn. |
| ROL-06 | Autorul unei discuții ascunse de moderator și-o face singur vizibilă la loc | Refuzat: ce a ascuns moderatorul rămâne ascuns. | ✅ trece | Migrarea 0001: statusul unei discuții e decizia administrației. |
| ROL-07 | Singurul administrator încearcă să plece sau să se retrogradeze, lăsând comunitatea fără nimeni la conducere | Refuzat pe orice cale: ieșire, modificarea propriului rol, funcția de schimbare a rolului. | ✅ trece | Migrarea 0010: „nothing, by any route, may leave a community with members but no admin”. |
| ROL-08 | Administratorul predă comunitatea unui vecin | Vecinul devine administrator, fostul administrator devine vecin, într-un singur pas. Către cineva din afară, predarea e refuzată și nu se schimbă nimic. | ✅ trece | Migrarea 0010. |
| ROL-09 | Doi administratori: unul îl retrogradează pe celălalt, apoi rămâne singur | Cât sunt doi, oricare poate pleca sau poate fi retrogradat. Ultimul rămas nu mai poate. | ✅ trece | Migrarea 0010: „an admin can make another member an admin, and both stay admins”. |
| ROL-10 | Schimbări de rol cu valori greșite | Un rol inexistent e refuzat; la fel schimbarea rolului cuiva care nu e membru. | ✅ trece | Migrarea 0010. |
| ROL-11 | Un moderator e retrogradat în timp ce lucrează | Drepturile dispar imediat, fără să aștepte o nouă autentificare. | ✅ trece | Migrarea 0001: rolul e citit din baza de date la fiecare cerere. |
| ROL-12 | Ultimul om dintr-o comunitate, administrator fiind, pleacă | Are voie: nu mai rămâne nimeni care să fie lăsat fără conducere. | ✅ trece | Migrarea 0010: „The last admin of an empty-but-for-them community may still leave”. |

### ANU — Anunțuri și calendar

Scrise de administrație, citite de toți.

| Nr. | Scenariu | Rezultat așteptat | Rezultat | Regula vine din |
|---|---|---|---|---|
| ANU-01 | Un anunț cu dată: sfârșit înaintea începutului, sau sfârșit fără început | Ambele sunt refuzate. Un început fără sfârșit, sau cu sfârșit în aceeași clipă, e în regulă. | ✅ trece | Migrarea 0013: „an end before its beginning is a typo rather than a state to render”. |
| ANU-02 | Un anunț prioritar al cărui termen a trecut | Nu mai e prioritar, fără ca cineva să fi făcut ceva: prioritatea se citește din dată, nu dintr-o bifă. | ✅ trece | Migrarea 0011 și studiul de caz: „Priority notices carry an expiry date, not a flag”. |
| ANU-03 | O ședință anulată e ștearsă din calendar | Administrația o poate șterge; un vecin nu. Ce și-a arhivat cineva despre ea rămâne un rând fără pereche, care nu deranjează pe nimeni. | ✅ trece | Migrarea 0013 („Cancelling”) și 0008 (item_id fără cheie străină, intenționat). |

### SES — Sesizări

Orice vecin raportează; statusul îl schimbă doar administrația.

| Nr. | Scenariu | Rezultat așteptat | Rezultat | Regula vine din |
|---|---|---|---|---|
| SES-01 | Cine poate scrie în istoricul unei sesizări | Autorul scrie doar prima linie („nouă”), doar la sesizarea lui. Schimbările de status le scrie administrația. | ✅ trece | Migrarea 0003: „a reporter may only add the opening 'new' entry, and only for an issue they themselves reported”. |
| SES-02 | Autorul unei sesizări mai adaugă linii „nouă” în istoric, cu orice text | Refuzat: prima linie se scrie o singură dată. | ✅ trece | Migrarea 0003: „only the opening entry”. |
| SES-03 | Statusul unei sesizări | Doar administrația îl schimbă, și doar într-una din cele trei valori. | ✅ trece | Migrarea 0001. |
| SES-04 | „Susțin această sesizare”: o dată, în nume propriu, și retras doar de cel care a pus-o | A doua apăsare nu numără de două ori; nimeni nu poate retrage susținerea altcuiva. | ✅ trece | Migrarea 0001. |
| SES-05 | După trimitere, sesizarea și comentariile ei nu mai pot fi șterse sau rescrise direct | Nici de autor, nici de alt vecin. Singura cale de a corecta un comentariu e funcția cu fereastra de 15 minute. | ✅ trece | Migrarea 0015: „the tables stay closed to updates entirely, and this is the only door”. |

### MSG — Corectarea unui mesaj trimis

Cincisprezece minute, doar mesajul tău, și rămâne semnul „editat”.

| Nr. | Scenariu | Rezultat așteptat | Rezultat | Regula vine din |
|---|---|---|---|---|
| MSG-01 | Autorul își corectează comentariul la două minute după trimitere | Textul se schimbă și apare momentul corecturii. O a doua corectură, tot în fereastră, merge și ea. | ✅ trece | Migrarea 0015. |
| MSG-02 | Exact la marginea ferestrei: 14 minute și 59 de secunde, apoi 15 minute și o secundă | Prima corectură trece, a doua e refuzată. | ✅ trece | Migrarea 0015: „created_at > now() - interval '15 minutes'”. |
| MSG-03 | Cineva corectează mesajul altcuiva | Refuzat pentru oricine în afară de autor — inclusiv pentru administrator. | ✅ trece | Migrarea 0015: „yours, and inside the window”. |
| MSG-04 | Corecturi cu valori greșite: text gol, doar spații, tip necunoscut, id de la alt fel de mesaj | Toate refuzate, cu mesajul rămas neatins. | ✅ trece | Migrarea 0015. |
| MSG-08 | Un comentariu corectat în ceva ce nu se vede: doar rânduri goale și taburi | Refuzat, la fel ca textul gol: un mesaj nu poate fi „corectat” până dispare. | ✅ trece | Migrarea 0015: „a comment cannot be edited into nothing”. |
| MSG-05 | Cineva trimite un comentariu cu data pusă de el, în viitor, ca să-l poată corecta oricând | Refuzat: momentul trimiterii îl stabilește serverul, altfel fereastra de 15 minute nu mai înseamnă nimic. | ✅ trece | Migrarea 0015: „a client permitted to write created_at can extend its own deadline”. |
| MSG-06 | Cineva trimite un comentariu cu data pusă în trecut, ca să apară înaintea celorlalte | Refuzat: ordinea unei discuții nu poate fi rescrisă. | ✅ trece | Migrarea 0015, același principiu. |
| MSG-07 | Un vecin scos din comunitate își mai corectează un comentariu trimis cu un minut înainte | Refuzat: cine nu mai e în comunitate nu mai schimbă nimic în ea. | ✅ trece | Migrarea 0015 nu verifică apartenența; migrarea 0001 o cere pentru orice scriere. |

### REA — Aprecieri (inimioara)

O inimă pe comentariu, de persoană, retrasă doar de cine a pus-o.

| Nr. | Scenariu | Rezultat așteptat | Rezultat | Regula vine din |
|---|---|---|---|---|
| REA-01 | Două apăsări una după alta pe aceeași inimă | Rămâne o singură inimă. La fel pentru un răspuns dintr-o discuție. | ✅ trece | Migrarea 0014: „Pressing the heart twice in a row must not make two hearts.” |
| REA-02 | O apreciere cu țintă greșită: pe două mesaje deodată, pe niciunul, sau cu un „emoji” cât un paragraf | Toate refuzate. | ✅ trece | Migrarea 0014. |
| REA-03 | Cineva retrage sau modifică inima altcuiva | Refuzat. Toți vecinii văd toate inimile, dar fiecare o retrage doar pe a lui. | ✅ trece | Migrarea 0014: „Deliberately no update policy.” |
| REA-04 | Cineva pleacă din comunitate și vrea să-și retragă inima rămasă în urmă | Nu mai vede comentariul, dar își poate retrage inima care încă se numără. | ✅ trece | Migrarea 0014: „Taking yours back needs no membership check.” |
| REA-05 | Comentariul apreciat dispare | Inimile lui dispar odată cu el, ca să nu fie numărate la nesfârșit. | ✅ trece | Migrarea 0014: „Two real references cascade on their own.” |

### SON — Sondaje

Rezultatul e public, votul e al fiecăruia.

| Nr. | Scenariu | Rezultat așteptat | Rezultat | Regula vine din |
|---|---|---|---|---|
| SON-01 | Un vecin votează de două ori aceeași variantă | Al doilea vot e refuzat. | ✅ trece | Migrarea 0001: cheia primară a votului. |
| SON-02 | Într-un sondaj cu o singură variantă de ales, un vecin votează și „Da”, și „Nu” | Al doilea vot e refuzat: un om, un vot. | ✅ trece | Studiu de caz: deciziile au „a record of who agreed to what”; coloana polls.multi deosebește cele două feluri de sondaj. |
| SON-03 | Într-un sondaj cu mai multe variante, un vecin alege două | Ambele voturi sunt primite. | ✅ trece | Migrarea 0001: polls.multi. |
| SON-04 | Un vecin votează într-un sondaj închis de administrație | Refuzat. | ✅ trece | Migrarea 0001: „p.closed = false”. |
| SON-05 | Un vecin votează după ce termenul sondajului a trecut, dar nimeni nu l-a închis manual | Refuzat: termenul e termen, chiar dacă administratorul a uitat să apese „închide”. | ✅ trece | Studiu de caz, constrângerea a treia: „Anything that depends on a person remembering to do it will not be done.” |
| SON-06 | Un vot care leagă un sondaj de varianta altui sondaj | Refuzat: varianta trebuie să fie a sondajului în care votezi. | ✅ trece | Migrarea 0001: votul are și poll_id, și option_id, fără nicio legătură între ele. |
| SON-07 | Un vecin se uită în baza de date cine cu ce a votat | Vede câte voturi are fiecare variantă și dacă el însuși a votat — nu și numele celorlalți. | ✅ trece | Studiu de caz, „The product”: „The count is public and the ballot is anonymous.” |
| SON-08 | Nici administratorul nu vede cine cu ce a votat | Votul e anonim și față de administrație. | ✅ trece | Studiu de caz: „the ballot is anonymous”. |
| SON-12 | Rezultatul unui sondaj, cerut de un vecin, de un om din altă comunitate și de un vizitator | Vecinul primește numărul de voturi pentru fiecare variantă — inclusiv zero — fără niciun nume. Ceilalți nu primesc nimic. | ✅ trece | Studiu de caz: „The count is public and the ballot is anonymous.” Migrarea 0021. |
| SON-09 | Un vot dat nu mai poate fi schimbat sau retras | Nici de cel care a votat, nici de administrație. | ✅ trece | Migrarea 0001: fără politici de modificare sau ștergere pe voturi, variante și sondaje. |
| SON-10 | După ce oamenii au votat, administratorul schimbă întrebarea sondajului | Astăzi reușește: voturile date pentru „Schimbăm poarta?” rămân lipite de noua întrebare. | ⚠️ trece, de decis | — (nedocumentat) |
| SON-11 | Un vecin votează în numele altuia sau închide el sondajul | Refuzat. | ✅ trece | Migrarea 0001: „Polls: members read+vote; staff create/close.” |

### FON — Fonduri

Fondul „Reparație acoperiș” din A: 250 lei de locuință. Dan e scutit (0 lei). Ioana a dat o rată de 100 lei, Mihai a plătit tot.

| Nr. | Scenariu | Rezultat așteptat | Rezultat | Regula vine din |
|---|---|---|---|---|
| FON-01 | Un vecin deschide registrul fondului | Își vede doar rândul lui: ce a plătit el și suma lui. Nu vede cine altcineva a plătit sau e în urmă. | ✅ trece | Migrarea 0016: „Your own line, and nothing else. […] Publishing a list of debtors to the whole building is a thing associations have been penalised for.” |
| FON-02 | Administrația deschide același registru | Vede toate plățile și toate excepțiile, pentru că ea ține evidența. | ✅ trece | Migrarea 0016. |
| FON-03 | Un vecin își trece singur plata, își micșorează suma sau își șterge o rată | Toate refuzate: o plată o confirmă doar cine a primit banii. | ✅ trece | Migrarea 0016: „A resident marking themselves paid is not a record, it is a claim.” |
| FON-04 | Totalurile fondului, văzute de fiecare vecin | Toți văd aceleași totaluri — 350 din 1.000 lei, 2 locuințe din 5 la zi — și fiecare propria situație. Cine e scutit apare ca „la zi”. | ✅ trece | Migrarea 0016: „A home owing nothing counts as done”; totalurile sunt pentru toți membrii. |
| FON-05 | O plată în rate: a doua rată completează suma | Ratele se adună. După a doua rată, vecinul e trecut „la zi” și totalul crește exact cu rata. | ✅ trece | Migrarea 0016: „a payment in instalments is several payments rather than one number overwritten twice”. |
| FON-06 | Sume imposibile: plată de zero sau negativă, fond de zero lei, scutire negativă | Toate refuzate. O scutire de exact zero lei e permisă. | ✅ trece | Migrarea 0016: sume întregi, în bani; „zero is allowed, and is the point”. |
| FON-07 | Un vecin care a plătit pleacă din comunitate | Banii lui rămân în totalul strâns: au fost încasați, indiferent unde locuiește el acum. | ✅ trece | Migrarea 0016: „the record of who paid for the roof is worth more a year later than it is now”. |
| FON-08 | Administrația înregistrează o plată pe numele cuiva care nu e în comunitate | Refuzat: registrul unei comunități e despre oamenii ei. | ✅ trece | Migrarea 0016. |
| FON-09 | Un moderator își trece singur plata ca făcută | Astăzi reușește: administrația poate înregistra o plată și pe propriul nume. | ⚠️ trece, de decis | — (nedocumentat) |
| FON-10 | O sumă absurd de mare la un fond | Refuzată: e o greșeală de tastare, nu o colectă. Totalurile celorlalte fonduri rămân vizibile. | ✅ trece | Migrarea 0023: „refusing it keeps the arithmetic far from the edge”. |
| FON-11 | Un fond încheiat | Rămâne vizibil tuturor membrilor, cu tot cu totaluri. | ✅ trece | Migrarea 0016: „Closed funds stay readable”. |
| FON-12 | Un fond e șters cu totul | Plățile și excepțiile lui dispar odată cu el; factura atașată rămâne printre documente, fără fond. | ✅ trece | Migrarea 0017: „an invoice outlives the collection it was raised for”. |

### DOC — Documente și fișiere

Fișierele stau în două locuri private: documentele asociației și pozele de la sesizări.

| Nr. | Scenariu | Rezultat așteptat | Rezultat | Regula vine din |
|---|---|---|---|---|
| DOC-01 | Un vecin deschide documentele asociației | Le vede pe toate ale comunității lui și poate ajunge la fișier. Nu poate adăuga, redenumi sau șterge. | ✅ trece | Migrarea 0017: „Every member reads them; only staff put them there.” |
| DOC-02 | Un vecin atașează o poză la sesizare | O poate încărca doar în folderul comunității lui. Nu poate șterge sau înlocui poza altcuiva — nici pe a lui. | ✅ trece | Migrarea 0018. |
| DOC-03 | Un document al cărui rând arată spre fișierul altei comunități | Rândul poate exista, dar fișierul rămâne de neatins: accesul se decide la fișier, nu la rând. | ✅ trece | Migrarea 0017: „storage policies see the object, not our tables”. |
| DOC-04 | Un fișier pus într-un bucket care nu există, sau într-un al treilea bucket | Refuzat: sunt permise doar cele două locuri cunoscute. | ✅ trece | Migrările 0017 și 0018. |

### TEL — Numere de telefon și profiluri

Ana și Dan și-au făcut numărul vizibil. Ioana are un număr salvat, dar ascuns.

| Nr. | Scenariu | Rezultat așteptat | Rezultat | Regula vine din |
|---|---|---|---|---|
| TEL-01 | Cineva își salvează numărul fără să aleagă nimic despre vizibilitate | Numărul e ascuns până când omul alege altfel. | ✅ trece | Studiu de caz: „A phone number is optional, off by default”. |
| TEL-02 | Cine vede un număr făcut vizibil | Doar vecinii din aceeași comunitate. Nu cei din altă comunitate, nu cei fără comunitate, nu vizitatorii. | ✅ trece | Studiu de caz: „visible only to members of the same community […] a database policy rather than interface logic”. |
| TEL-03 | Un număr ascuns, cerut de administrator | Nici administratorul nu îl vede. | ✅ trece | Migrarea 0009: „only if they chose to be reachable”. |
| TEL-04 | Un vecin pleacă din comunitate | Din acea clipă nu mai vede numerele foștilor vecini, iar ei nu îl mai văd pe al lui. | ✅ trece | Migrarea 0009: „only by the people they actually live near”. |
| TEL-05 | Cineva schimbă numărul altcuiva sau i-l face vizibil | Refuzat, inclusiv pentru administrator. | ✅ trece | Migrarea 0009: „Your own row, always, to read and to change.” |
| TEL-06 | Cineva schimbă numele sau apartamentul din profilul altcuiva | Refuzat: fiecare își schimbă doar profilul lui. | ✅ trece | Migrarea 0001. |
| TEL-07 | Cineva cu cont, din altă comunitate sau din niciuna, încearcă să afle apartamentele | Vede numele oamenilor (ca să apară lângă ce au scris), dar nu și apartamentul. Apartamentul îl văd doar vecinii din aceeași comunitate și omul însuși. | ✅ trece | Decizia din 20 noiembrie 2026: numărul de telefon și apartamentul sunt doar pentru cei din comunitate. Migrarea 0024. |
| TEL-08 | Un vecin pleacă din comunitate | Din acel moment nu mai vede apartamentele foștilor vecini, iar ei nu îl mai văd pe al lui. Numele rămâne, lângă ce a scris. | ✅ trece | Migrarea 0024; același principiu ca la telefon (TEL-04). |
| TEL-09 | Un vizitator fără cont cere apartamentele | Nu poate nici apela funcția. | ✅ trece | Migrarea 0024. |

### STE — Ștergerea contului

Contul se golește, nu dispare: omul pleacă, ce a scris rămâne.

| Nr. | Scenariu | Rezultat așteptat | Rezultat | Regula vine din |
|---|---|---|---|---|
| STE-01 | Un vecin își șterge contul | Dispar numele, apartamentul, telefonul, adresa de email, parola, notificările, preferințele, abonamentul de push și ce avea arhivat. Nu se mai poate autentifica. | ✅ trece | Studiu de caz: „Identity, contact details and access are deleted.” Migrarea 0007. |
| STE-02 | Ce rămâne în urma unui cont șters | Sesizarea, discuția, comentariile și votul rămân la locul lor, atribuite unui vecin care a plecat. Ceilalți le văd în continuare. | ✅ trece | Studiu de caz: „Contributions remain, attributed to a member who left.” |
| STE-03 | Singurul administrator al unei comunități cu membri își șterge contul | Comunitatea nu rămâne fără conducere: administrator devine vecinul cu cea mai mare vechime. | ✅ trece | Migrarea 0007: „hand the keys to the longest-standing member who is left”. |
| STE-04 | Administratorul își șterge contul când mai există un al doilea administrator | Nu se schimbă rolul nimănui: comunitatea are deja pe cineva la conducere. | ✅ trece | Migrarea 0007. |
| STE-05 | Cineva din două comunități își șterge contul | Fiecare comunitate numără o plecare, iar administrația fiecăreia o vede doar pe a ei. Nimeni nu poate scrie în această evidență. | ✅ trece | Migrarea 0007: „Deliberately holds no reference back to the person”. |
| STE-06 | Ștergerea e cerută de două ori la rând | A doua cerere nu strică nimic și nu mai numără o plecare. | ✅ trece | Migrarea 0007. |
| STE-07 | Un vecin care a plătit la un fond își șterge contul | Plățile lui rămân în registru și în totalul strâns: banii au fost încasați. | ✅ trece | Studiu de caz: „Contributions remain”. Migrarea 0016. |

### NOT — Notificări

Ale fiecăruia, private, și trimise doar celor care nu le-au oprit.

| Nr. | Scenariu | Rezultat așteptat | Rezultat | Regula vine din |
|---|---|---|---|---|
| NOT-01 | Cineva citește sau marchează ca citite notificările altcuiva | Refuzat. Fiecare își vede doar lista lui. | ✅ trece | Migrarea 0001: „strictly private to their owner”. |
| NOT-02 | Se trimite o notificare tuturor vecinilor, iar unul dintre ei a oprit acel fel de notificări | Primesc toți, mai puțin cel care a trimis-o și cel care le-a oprit. Dan a oprit anunțurile și fondurile, nu și sesizările. | ✅ trece | Migrările 0002, 0012, 0016: fiecare comutator din Setări are o ramură în pref_allows. |
| NOT-03 | Un vecin care a oprit anunțurile primește totuși unul, scris direct în lista lui de către alt vecin | Refuzat: preferințele se respectă pe orice cale ajunge notificarea. | ✅ trece | Migrarea 0002: „honouring notification preferences […] the filtering has to happen server-side”. |
| NOT-04 | Notificare către sine, către nimeni, către cineva din afară | Nu se trimite nimic în niciunul din cazuri, și nu apare nicio eroare. | ✅ trece | Migrarea 0002. |
| NOT-05 | Un vecin simplu trimite tuturor o notificare care arată ca un anunț oficial, cu un link din afara aplicației | Astăzi reușește: funcția de trimitere verifică doar că ești membru, nu și ce trimiți. | ⚠️ trece, de decis | — (nedocumentat) |
| NOT-06 | Cineva citește sau schimbă preferințele de notificare ale altcuiva | Refuzat. | ✅ trece | Migrarea 0001. |

### ARH — Arhivare și push

Lucruri care țin de un singur om și de telefonul lui.

| Nr. | Scenariu | Rezultat așteptat | Rezultat | Regula vine din |
|---|---|---|---|---|
| ARH-01 | Un vecin își arhivează un anunț | Dispare doar din lista lui. Ceilalți îl văd în continuare, și nimeni nu vede ce a arhivat altcineva. | ✅ trece | Migrarea 0008: „a private act of tidying, not moderation”. |
| ARH-02 | Abonamentul de push al unui telefon | Fiecare îl vede doar pe al lui. Când altcineva se autentifică pe același telefon, abonamentul trece la el și fostul proprietar nu mai primește nimic acolo. | ✅ trece | Migrarea 0004: „A push subscription belongs to a browser, not to an account.” |

### DAT — Date la limită

Ce se întâmplă cu texte ciudate, foarte lungi sau goale.

| Nr. | Scenariu | Rezultat așteptat | Rezultat | Regula vine din |
|---|---|---|---|---|
| DAT-01 | Texte cu diacritice, emoji, ghilimele, alfabete diferite și bucăți de cod | Sunt păstrate și întoarse exact cum au fost scrise, fără să strice nimic. | ✅ trece | Studiu de caz: trei limbi de la prima versiune, inclusiv maghiara. |
| DAT-02 | Un comentariu de două milioane de caractere | Refuzat: un mesaj are o lungime maximă, altfel un singur om poate îngreuna aplicația pentru toată comunitatea. | ✅ trece | Migrarea 0014 limitează un emoji la 8 caractere „so the column cannot be used to store a paragraph”; pentru texte nu există nicio limită. |
| DAT-03 | Un comentariu, o discuție sau o sesizare fără niciun text | Refuzate: ce nu are conținut nu se trimite. | ✅ trece | Migrarea 0015 refuză corectarea „into nothing”; trimiterea inițială nu are aceeași regulă. |
| DAT-04 | Valori lipsă acolo unde sunt obligatorii, și valori din afara listei permise | Refuzate de baza de date, nu doar de formular. | ✅ trece | Migrările 0001, 0006, 0016. |
| DAT-05 | Un vecin își deschide sesizarea direct cu statusul „rezolvat” | Statusul de pornire îl dă sistemul, nu cel care scrie. | ✅ trece | Migrarea 0001: „Issues: members read+write; staff update status”. |

## Cum se rulează

```
npm run test:db            # toate scenariile; rescrie și acest document
node tests-db/run.mjs IZO  # doar o arie
node tests-db/run.mjs 'SON-0[78]'  # doar câteva
```

Are nevoie de un PostgreSQL local în care poate crea și șterge o bază de date de test (`vecini_test`). Nu se conectează niciodată la baza de date reală.

Când o problemă e reparată, scenariul ei începe să treacă și rularea o semnalează ca „de actualizat”: atunci se șterge rândul ei din `tests-db/known-problems.mjs`, iar scenariul devine un test obișnuit, care de-acum trebuie să treacă mereu.

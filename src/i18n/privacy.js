/*
  Politica de confidențialitate, in the app's three languages.

  Kept out of strings.js because it is a document rather than a set of labels:
  it is read top to bottom, it changes rarely and all at once, and it should be
  reviewable as a whole by somebody who is not going to read the rest of the
  app's text.

  Every statement in it is meant to be checkable against the code and the
  migrations. If the app starts keeping something new, sending it somewhere
  new, or keeping it for a different length of time, this is the file that has
  to change with it — and POLICY_UPDATED in src/lib/legal.js.

  {operator} and {email} are filled in from src/lib/legal.js.

  Each section: h (heading), p (paragraphs), and optionally list (items shown
  as bullets after the paragraphs) and after (paragraphs after the list).
*/

export const PRIVACY = {
  ro: {
    title: 'Politica de confidențialitate',
    updated: 'Ultima actualizare',
    intro: 'Pe scurt: folosim datele tale doar ca să funcționeze aplicația pentru tine și vecinii tăi. Nu le vindem, nu facem reclame, nu urmărim ce faci, iar ce se publică în comunitatea ta nu ajunge la nimeni din afara ei.',
    sections: [
      {
        h: 'Cine răspunde de date',
        p: [
          'Vecini este o aplicație operată de {operator}. Pentru orice întrebare despre datele tale sau ca să-ți exerciți drepturile de mai jos, scrie la {email}.',
          'Ce se publică într-o comunitate — anunțuri, documente, colecte și plăți — este decis de administrația acelei comunități (de obicei asociația de proprietari). Aplicația le păstrează și le arată membrilor, după regulile descrise aici.',
        ],
      },
      {
        h: 'Ce date folosim',
        p: ['Doar ce e nevoie ca aplicația să funcționeze:'],
        list: [
          'Contul: adresa de email și parola (păstrată doar sub formă criptată, pe care nu o poate citi nimeni). Dacă intri cu Google, primim de la Google numele și adresa de email.',
          'Profilul: numele, apartamentul sau casa (opțional) și o culoare pentru inițiale.',
          'Numărul de telefon, doar dacă îl adaugi tu. E ascuns până alegi să-l arăți vecinilor.',
          'Comunitățile în care ești și rolul tău (vecin, moderator, administrator).',
          'Ce scrii: anunțuri, discuții, răspunsuri, sesizări, comentarii, aprecieri și pozele atașate la sesizări.',
          'Voturile din sondaje. Votul tău îl vezi doar tu; ceilalți văd doar totalurile.',
          'La fonduri: sumele pe care le ai de plătit și plățile înregistrate de administrație pe numele tău.',
          'Notificările primite și preferințele tale de notificare. Dacă activezi notificările pe telefon, adresa tehnică prin care browserul le primește.',
          'Ce ai arhivat pentru tine și cererile de intrare într-o comunitate, cât timp așteaptă aprobarea.',
        ],
      },
      {
        h: 'De ce și pe ce temei',
        p: [
          'Folosim aceste date ca să-ți oferim serviciul pe care l-ai cerut când ți-ai făcut cont (art. 6 alin. (1) lit. b din GDPR): să vezi și să scrii în comunitatea ta.',
          'Arătarea numărului de telefon și notificările pe telefon se bazează pe alegerea ta (consimțământ, lit. a). Le poți opri oricând din aplicație.',
          'Păstrăm puține informații tehnice (de exemplu, jurnalele serverelor) pentru securitate și ca să putem investiga o problemă (interes legitim, lit. f).',
        ],
      },
      {
        h: 'Cine vede datele',
        list: [
          'Vecinii din aceeași comunitate văd ce se publică acolo, cu numele și apartamentul autorilor.',
          'Numele și apartamentul din profilul tău pot fi văzute de orice utilizator autentificat al aplicației, ca să poată apărea lângă ce ai scris. De aceea apartamentul e opțional. Fără cont, profilul nu poate fi văzut.',
          'Numărul de telefon îl văd doar vecinii din aceeași comunitate, și doar dacă ai ales să-l arăți.',
          'La fonduri, fiecare vecin își vede doar propria situație și totalul strâns. Lista cu cine cât a plătit o vede doar administrația comunității.',
          'Votul tău nu îl vede nimeni, nici administrația.',
          'Nimeni din altă comunitate nu vede nimic din ce se publică în comunitatea ta. Aceste reguli sunt aplicate direct în baza de date, nu doar ascunse în ecrane.',
          'Nu vindem date, nu le folosim pentru reclame și nu le dăm altor firme, cu excepția furnizorilor de mai jos, care ne ajută să rulăm aplicația.',
        ],
      },
      {
        h: 'Furnizorii care ne ajută',
        p: ['Aceste firme prelucrează date doar în numele nostru și doar ca să funcționeze aplicația:'],
        list: [
          'Supabase — baza de date, conturile și fișierele. Datele sunt stocate pe servere din Uniunea Europeană (Stockholm, Suedia).',
          'Netlify — găzduiește aplicația și o livrează în browser. Ca orice server web, vede adresa IP a celui care o deschide.',
          'Serviciul de email folosit pentru mesajele de confirmare a contului și de resetare a parolei.',
          'Google, doar dacă alegi să intri cu contul Google.',
          'Serviciul de notificări al browserului tău (de exemplu Google, Apple sau Mozilla), doar dacă activezi notificările pe telefon. Prin el trece textul notificării.',
        ],
        after: ['Când un furnizor are sediul în afara Uniunii Europene, transferul se face cu garanțiile cerute de GDPR, cum sunt clauzele contractuale standard aprobate de Comisia Europeană.'],
      },
      {
        h: 'Cât timp păstrăm datele',
        p: [
          'Cât timp ai cont. Când îți ștergi contul (din Cont → Șterge contul), ștergem imediat emailul, parola, numele, apartamentul, telefonul, notificările, preferințele și tot ce ai arhivat. Nu te mai poți autentifica.',
          'Ce ai scris într-o comunitate rămâne, ca istoricul ei să nu aibă goluri, dar apare semnat „Vecin care a plecat”, fără nimic care să te identifice. Plățile înregistrate la fonduri rămân în registrul asociației, pentru că sunt evidența ei contabilă.',
          'Dacă ieși doar dintr-o comunitate, nu mai vezi nimic din ea; ce ai scris acolo rămâne.',
        ],
      },
      {
        h: 'Drepturile tale',
        p: ['Ai dreptul să afli ce date avem despre tine, să le corectezi, să le ștergi, să le primești într-un format pe care îl poți duce în altă parte, să te opui unei prelucrări și să-ți retragi consimțământul.'],
        list: [
          'Numele, apartamentul și telefonul le corectezi singur, din Cont.',
          'Contul îl ștergi singur, din Cont → Șterge contul.',
          'Pentru orice altceva, scrie la {email}. Răspundem în cel mult o lună.',
        ],
        after: ['Dacă nu ești mulțumit de răspuns, poți depune o plângere la Autoritatea Națională de Supraveghere a Prelucrării Datelor cu Caracter Personal (www.dataprotection.ro).'],
      },
      {
        h: 'Pe telefonul tău',
        p: [
          'Aplicația păstrează în browser doar ce îi trebuie ca să funcționeze: sesiunea de autentificare, limba aleasă și câteva preferințe de afișare.',
          'Nu folosim cookie-uri de reclame sau de analiză și nu avem programe de urmărire. Fonturile și restul aplicației vin de pe serverul nostru, nu de la terți.',
        ],
      },
      {
        h: 'Securitate',
        p: [
          'Conexiunea e criptată. Accesul la date e decis de reguli aplicate în baza de date, verificate cu teste automate care încearcă, pe rând, să citească date din altă comunitate. Documentele și pozele de la sesizări se deschid doar prin linkuri care expiră după o oră.',
          'Dacă se întâmplă totuși un incident care îți pune datele în pericol, îl raportăm autorității în 72 de ore și te anunțăm, așa cum cere legea.',
        ],
      },
      {
        h: 'Copii',
        p: ['Aplicația nu este destinată copiilor sub 16 ani.'],
      },
      {
        h: 'Modificări',
        p: ['Dacă schimbăm ceva important în acest text, actualizăm data de sus și te anunțăm în aplicație.'],
      },
    ],
  },

  en: {
    title: 'Privacy policy',
    updated: 'Last updated',
    intro: 'In short: we use your data only to make the app work for you and your neighbours. We do not sell it, we do not show ads, we do not track you, and what is published in your community reaches nobody outside it.',
    sections: [
      {
        h: 'Who is responsible',
        p: [
          'Vecini is operated by {operator}. For any question about your data, or to exercise the rights below, write to {email}.',
          'What is published in a community — announcements, documents, collections and payments — is decided by that community\'s administration (usually the owners\' association). The app stores it and shows it to members under the rules described here.',
        ],
      },
      {
        h: 'What data we use',
        p: ['Only what the app needs to work:'],
        list: [
          'Your account: email address and password (stored only in encrypted form, which nobody can read). If you sign in with Google, Google gives us your name and email address.',
          'Your profile: name, flat or house (optional) and a colour for your initials.',
          'Your phone number, only if you add it. It stays hidden until you choose to show it to your neighbours.',
          'The communities you belong to and your role (neighbour, moderator, administrator).',
          'What you write: announcements, discussions, replies, reports, comments, likes and photos attached to reports.',
          'Your poll votes. Only you see your vote; everyone else sees totals.',
          'For collections: the amounts you owe and the payments the administration records in your name.',
          'Notifications you receive and your notification settings. If you turn on phone notifications, the technical address your browser receives them at.',
          'What you have archived for yourself, and requests to join a community while they wait for approval.',
        ],
      },
      {
        h: 'Why, and on what basis',
        p: [
          'We use this data to provide the service you asked for when you created an account (Article 6(1)(b) GDPR): to read and write in your community.',
          'Showing your phone number and phone notifications rely on your choice (consent, point a). You can turn them off at any time in the app.',
          'We keep a little technical information (for example, server logs) for security and to investigate problems (legitimate interest, point f).',
        ],
      },
      {
        h: 'Who sees the data',
        list: [
          'Neighbours in the same community see what is published there, with the authors\' names and flats.',
          'The name and flat in your profile can be seen by any signed-in user of the app, so that they can appear next to what you wrote. That is why the flat is optional. Without an account, profiles cannot be seen.',
          'Your phone number is visible only to neighbours in the same community, and only if you chose to show it.',
          'For collections, each neighbour sees only their own line and the total raised. The list of who paid what is visible only to the community\'s administration.',
          'Nobody sees your vote, not even the administration.',
          'Nobody in another community sees anything published in yours. These rules are enforced in the database itself, not merely hidden on screen.',
          'We do not sell data, use it for advertising or give it to other companies, apart from the providers below who help us run the app.',
        ],
      },
      {
        h: 'Providers who help us',
        p: ['These companies process data only on our behalf and only to make the app work:'],
        list: [
          'Supabase — the database, accounts and files. Data is stored on servers in the European Union (Stockholm, Sweden).',
          'Netlify — hosts the app and delivers it to your browser. Like any web server, it sees the IP address of whoever opens it.',
          'The email service used for account confirmation and password reset messages.',
          'Google, only if you choose to sign in with your Google account.',
          'Your browser\'s notification service (for example Google, Apple or Mozilla), only if you turn on phone notifications. The notification text passes through it.',
        ],
        after: ['Where a provider is based outside the European Union, transfers rely on the safeguards GDPR requires, such as the standard contractual clauses approved by the European Commission.'],
      },
      {
        h: 'How long we keep it',
        p: [
          'For as long as you have an account. When you delete your account (Account → Delete account), we immediately delete your email, password, name, flat, phone number, notifications, settings and anything you archived. You can no longer sign in.',
          'What you wrote in a community stays, so its history has no holes, but it is signed "A neighbour who left", with nothing that identifies you. Payments recorded for collections stay in the association\'s ledger, because they are its financial record.',
          'If you only leave a community, you no longer see anything in it; what you wrote there stays.',
        ],
      },
      {
        h: 'Your rights',
        p: ['You have the right to know what data we hold about you, to correct it, to delete it, to receive it in a format you can take elsewhere, to object to processing, and to withdraw consent.'],
        list: [
          'You can correct your name, flat and phone number yourself, in Account.',
          'You can delete your account yourself, in Account → Delete account.',
          'For anything else, write to {email}. We answer within one month.',
        ],
        after: ['If you are not satisfied with our answer, you can complain to the Romanian data protection authority, ANSPDCP (www.dataprotection.ro).'],
      },
      {
        h: 'On your phone',
        p: [
          'The app keeps in your browser only what it needs to work: your sign-in session, your chosen language and a few display preferences.',
          'We use no advertising or analytics cookies and no tracking software. The fonts and the rest of the app come from our own server, not from third parties.',
        ],
      },
      {
        h: 'Security',
        p: [
          'The connection is encrypted. Access to data is decided by rules enforced in the database, checked by automated tests that try, one by one, to read another community\'s data. Documents and report photos open only through links that expire after an hour.',
          'If an incident nonetheless puts your data at risk, we report it to the authority within 72 hours and tell you, as the law requires.',
        ],
      },
      {
        h: 'Children',
        p: ['The app is not intended for children under 16.'],
      },
      {
        h: 'Changes',
        p: ['If we change anything important in this text, we update the date at the top and let you know in the app.'],
      },
    ],
  },

  hu: {
    title: 'Adatvédelmi tájékoztató',
    updated: 'Utolsó frissítés',
    intro: 'Röviden: az adataidat csak arra használjuk, hogy az alkalmazás működjön neked és a szomszédaidnak. Nem adjuk el, nem mutatunk hirdetéseket, nem követünk, és ami a közösségedben megjelenik, azt kívülálló nem látja.',
    sections: [
      {
        h: 'Ki felel az adatokért',
        p: [
          'A Vecini alkalmazást {operator} üzemelteti. Az adataiddal kapcsolatos kérdésekkel, vagy az alábbi jogaid gyakorlásához írj a {email} címre.',
          'Azt, hogy mi jelenik meg egy közösségben — hirdetmények, dokumentumok, gyűjtések és befizetések —, a közösség vezetése dönti el (általában a tulajdonosi egyesület). Az alkalmazás ezeket tárolja és az itt leírt szabályok szerint mutatja a tagoknak.',
        ],
      },
      {
        h: 'Milyen adatokat használunk',
        p: ['Csak azt, ami a működéshez szükséges:'],
        list: [
          'A fiókod: e-mail-cím és jelszó (csak titkosított formában tárolva, amit senki nem tud elolvasni). Ha Google-fiókkal lépsz be, a Google átadja a neved és az e-mail-címed.',
          'A profilod: név, lakás vagy ház (nem kötelező) és egy szín a monogramodhoz.',
          'A telefonszámod, csak ha megadod. Rejtve marad, amíg úgy nem döntesz, hogy megmutatod a szomszédaidnak.',
          'A közösségek, amelyeknek tagja vagy, és a szereped (szomszéd, moderátor, adminisztrátor).',
          'Amit írsz: hirdetmények, beszélgetések, válaszok, bejelentések, hozzászólások, kedvelések és a bejelentésekhez csatolt fényképek.',
          'A szavazataid. A szavazatodat csak te látod; a többiek csak az összesítést.',
          'Gyűjtéseknél: a fizetendő összegeid és a vezetés által a nevedre rögzített befizetések.',
          'A kapott értesítések és az értesítési beállításaid. Ha bekapcsolod a telefonos értesítéseket, az a technikai cím, amelyen a böngésződ fogadja őket.',
          'Amit magadnak archiváltál, és a csatlakozási kérések, amíg jóváhagyásra várnak.',
        ],
      },
      {
        h: 'Miért és milyen jogalapon',
        p: [
          'Az adatokat arra használjuk, hogy nyújtsuk a szolgáltatást, amelyet a fiók létrehozásakor kértél (GDPR 6. cikk (1) bekezdés b) pont): hogy olvashass és írhass a közösségedben.',
          'A telefonszám megjelenítése és a telefonos értesítések a te választásodon alapulnak (hozzájárulás, a) pont). Bármikor kikapcsolhatod őket az alkalmazásban.',
          'Kevés technikai információt (például szervernaplókat) őrzünk meg a biztonság érdekében és hibák kivizsgálásához (jogos érdek, f) pont).',
        ],
      },
      {
        h: 'Ki látja az adatokat',
        list: [
          'Az ugyanazon közösségben élő szomszédok látják, ami ott megjelenik, a szerzők nevével és lakásával.',
          'A profilodban szereplő nevet és lakást az alkalmazás bármely bejelentkezett felhasználója láthatja, hogy megjelenhessenek amellett, amit írtál. Ezért nem kötelező a lakás megadása. Fiók nélkül a profilok nem láthatók.',
          'A telefonszámodat csak az ugyanazon közösség szomszédai látják, és csak ha így döntöttél.',
          'Gyűjtéseknél mindenki csak a saját sorát és az összegyűlt összeget látja. Azt, hogy ki mennyit fizetett, csak a közösség vezetése látja.',
          'A szavazatodat senki nem látja, még a vezetés sem.',
          'Más közösségből senki nem lát semmit abból, ami a tiédben megjelenik. Ezeket a szabályokat maga az adatbázis érvényesíti, nem csak a képernyőn vannak elrejtve.',
          'Nem adunk el adatokat, nem használjuk hirdetésre, és nem adjuk át más cégeknek, kivéve az alábbi szolgáltatókat, akik az alkalmazás működtetésében segítenek.',
        ],
      },
      {
        h: 'A szolgáltatók, akik segítenek',
        p: ['Ezek a cégek csak a nevünkben és csak az alkalmazás működéséhez kezelnek adatokat:'],
        list: [
          'Supabase — az adatbázis, a fiókok és a fájlok. Az adatok az Európai Unióban lévő szervereken vannak (Stockholm, Svédország).',
          'Netlify — tárolja az alkalmazást és eljuttatja a böngésződbe. Mint minden webszerver, látja annak IP-címét, aki megnyitja.',
          'Az e-mail-szolgáltatás, amellyel a fiók-megerősítő és jelszó-visszaállító üzeneteket küldjük.',
          'A Google, csak ha Google-fiókkal lépsz be.',
          'A böngésződ értesítési szolgáltatása (például Google, Apple vagy Mozilla), csak ha bekapcsolod a telefonos értesítéseket. Ezen halad át az értesítés szövege.',
        ],
        after: ['Ha egy szolgáltató az Európai Unión kívül működik, az adattovábbítás a GDPR által előírt garanciákkal történik, például az Európai Bizottság által jóváhagyott általános szerződési feltételekkel.'],
      },
      {
        h: 'Meddig őrizzük az adatokat',
        p: [
          'Amíg van fiókod. Ha törlöd a fiókodat (Fiók → Fiók törlése), azonnal töröljük az e-mail-címedet, jelszavadat, nevedet, lakásodat, telefonszámodat, értesítéseidet, beállításaidat és mindent, amit archiváltál. Többé nem tudsz belépni.',
          'Amit egy közösségben írtál, megmarad, hogy a közösség története ne legyen hiányos, de „Egy szomszéd, aki elment” aláírással jelenik meg, semmi olyannal, ami azonosítana. A gyűjtésekhez rögzített befizetések az egyesület nyilvántartásában maradnak, mert ezek a pénzügyi nyilvántartása.',
          'Ha csak kilépsz egy közösségből, többé nem látsz belőle semmit; amit ott írtál, megmarad.',
        ],
      },
      {
        h: 'A jogaid',
        p: ['Jogod van megtudni, milyen adatokat tárolunk rólad, kijavítani, törölni őket, olyan formátumban megkapni, amelyet máshová vihetsz, tiltakozni az adatkezelés ellen, és visszavonni a hozzájárulásodat.'],
        list: [
          'A nevedet, lakásodat és telefonszámodat magad javíthatod a Fiók menüben.',
          'A fiókodat magad törölheted: Fiók → Fiók törlése.',
          'Minden másért írj a {email} címre. Legfeljebb egy hónapon belül válaszolunk.',
        ],
        after: ['Ha nem vagy elégedett a válaszunkkal, panaszt tehetsz a román adatvédelmi hatóságnál, az ANSPDCP-nél (www.dataprotection.ro).'],
      },
      {
        h: 'A telefonodon',
        p: [
          'Az alkalmazás csak azt tárolja a böngészőben, ami a működéshez kell: a bejelentkezésedet, a választott nyelvet és néhány megjelenítési beállítást.',
          'Nem használunk hirdetési vagy elemző sütiket, és nincs követőprogramunk. A betűtípusok és az alkalmazás többi része a saját szerverünkről jön, nem harmadik féltől.',
        ],
      },
      {
        h: 'Biztonság',
        p: [
          'A kapcsolat titkosított. Az adatokhoz való hozzáférést az adatbázisban érvényesített szabályok döntik el, amelyeket automatikus tesztek ellenőriznek: egyenként megpróbálnak egy másik közösség adataihoz hozzáférni. A dokumentumok és a bejelentésekhez csatolt fényképek csak egy óra után lejáró linkkel nyílnak meg.',
          'Ha mégis olyan incidens történik, amely veszélyezteti az adataidat, 72 órán belül jelentjük a hatóságnak és értesítünk, ahogy a törvény előírja.',
        ],
      },
      {
        h: 'Gyerekek',
        p: ['Az alkalmazás nem 16 év alatti gyerekeknek szól.'],
      },
      {
        h: 'Változások',
        p: ['Ha valami fontosat változtatunk ezen a szövegen, frissítjük a fenti dátumot, és jelezzük az alkalmazásban.'],
      },
    ],
  },
};

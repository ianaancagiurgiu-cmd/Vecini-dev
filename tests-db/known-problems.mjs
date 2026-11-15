/*
  What the suite found and nobody has fixed yet.

  Each entry is a scenario that fails because the database does something the
  documentation says it does not. They are kept here rather than beside the
  scenarios so that the whole list of open defects is one screen, and so that
  closing one is deleting one entry — at which point the scenario goes back to
  being an ordinary test that has to pass.

  sev: critic   — one community's data reachable by somebody outside it
       ridicat  — a promise the product makes in writing, not kept
       mediu    — a rule that can be walked around by somebody already inside
       scazut   — untidy, bounded, or needs unusual effort to matter

  root groups entries that one change would close together.
*/
export const KNOWN = {
  'INT-01': { sev: 'critic', root: 'intrare',
    why: 'Politica „communities_select” lasă orice om autentificat să citească toate comunitățile, cu tot cu codul de invitație. Codul e singura cheie de intrare.' },
  'INT-02': { sev: 'critic', root: 'intrare',
    why: 'Politica „memberships_insert_self” cere doar ca rândul să fie pe numele tău. Nu verifică niciun cod: cine știe id-ul unei comunități — și INT-01 îl dă oricui — intră în ea.' },
  'INT-03': { sev: 'critic', root: 'intrare',
    why: 'Urmarea directă a lui INT-02: odată înscris, omul e membru cu drepturi depline și citește anunțurile, telefoanele vizibile și documentele.' },
  'INT-08': { sev: 'ridicat', root: 'intrare',
    why: 'Primul rând de apartenență dintr-o comunitate primește rolul de administrator, oricine l-ar scrie. Aplicația creează comunitatea și abia apoi înscrie fondatorul, în două cereri separate.' },
  'INT-14': { sev: 'mediu', root: 'intrare',
    why: 'Setarea „intrare cu aprobare” se salvează, dar nimic din baza de date nu o citește. E un comutator care nu schimbă nimic.' },
  'INT-13': { sev: 'mediu', root: 'intrare',
    why: 'Unicitatea codului ține cont de majuscule, căutarea după cod nu. Două comunități pot avea „TEILOR-15” și „teilor-15”, iar invitatul ajunge la una dintre ele la întâmplare.' },
  'INT-05': { sev: 'scazut', root: 'intrare',
    why: 'Administratorul poate rescrie user_id pe un rând de apartenență din comunitatea lui și astfel înscrie pe oricine, fără acordul acelui om.' },

  'ANO-02': { sev: 'ridicat', root: 'profiluri',
    why: 'Politica „profiles_select” e „using (true)”, iar rolul anonim are drept de citire pe tabel. Cu cheia publică din pagină, fără cont, se pot citi numele și apartamentul fiecărui utilizator.' },

  'SON-07': { sev: 'ridicat', root: 'vot',
    why: 'Fiecare vot e un rând cu user_id, iar politica de citire îl arată oricărui membru. Aplicația afișează doar totaluri, dar baza de date răspunde cu numele.' },
  'SON-08': { sev: 'ridicat', root: 'vot',
    why: 'Aceeași cauză ca la SON-07: nici administrația nu ar trebui să vadă cine cu ce a votat.' },
  'SON-02': { sev: 'mediu', root: 'vot',
    why: 'Unicitatea votului e pe (sondaj, variantă, om). Nimic nu oprește al doilea vot, pe altă variantă, într-un sondaj cu alegere unică.' },
  'SON-05': { sev: 'mediu', root: 'vot',
    why: 'Politica de vot verifică doar bifa „închis”. Termenul sondajului (ends_at) nu e verificat nicăieri în baza de date.' },
  'SON-06': { sev: 'mediu', root: 'vot',
    why: 'Votul are poll_id și option_id fără nicio legătură între ele. Se poate vota într-un sondaj cu varianta altuia, inclusiv din altă comunitate.' },

  'IZO-28': { sev: 'mediu', root: 'notificari',
    why: 'Politica „notifications_insert” verifică doar că expeditorul e membru al comunității scrise pe rând, nu și cui îi e adresat rândul. Oricine poate pune o notificare, cu orice text și link, în lista oricărui utilizator.' },
  'NOT-03': { sev: 'mediu', root: 'notificari',
    why: 'Aceeași politică: inserarea directă ocolește preferințele pe care funcțiile notify_* le respectă.' },

  'ROL-05': { sev: 'mediu', root: 'moderare',
    why: 'Politicile de modificare pentru discuții și sesizări lasă administrația să schimbe orice coloană, nu doar statusul: textul, titlul, chiar și autorul. Fără niciun semn că s-a modificat.' },
  'ROL-06': { sev: 'mediu', root: 'moderare',
    why: 'Politica „discussions_update” lasă autorul să-și modifice rândul, inclusiv coloana status. Ce ascunde moderatorul, autorul face vizibil la loc.' },
  'DAT-05': { sev: 'scazut', root: 'moderare',
    why: 'La creare, statusul poate fi trimis de client. Un vecin își poate deschide sesizarea direct ca „rezolvată”.' },
  'SES-02': { sev: 'scazut', root: 'moderare',
    why: 'Autorul poate adăuga oricâte linii cu statusul „new”, cu orice text, oricând — nu doar pe prima.' },

  'MSG-05': { sev: 'mediu', root: 'timp',
    why: 'La trimitere, created_at poate fi dat de client. Un comentariu datat în viitor rămâne „în primele 15 minute” ani de zile și poate fi rescris oricând.' },
  'MSG-06': { sev: 'mediu', root: 'timp',
    why: 'Aceeași cauză: un mesaj datat în trecut apare înaintea celor la care de fapt răspunde.' },
  'MSG-07': { sev: 'scazut', root: 'timp',
    why: 'edit_comment verifică autorul și fereastra de timp, nu și dacă autorul mai e membru.' },
  'MSG-08': { sev: 'scazut', root: 'timp',
    why: 'Verificarea de text gol folosește btrim(), care taie doar spațiile. Rândurile noi și taburile trec.' },
  'REA-04': { sev: 'scazut', root: 'timp',
    why: 'Migrarea 0014 spune că inima se poate retrage și după plecare. În practică ștergerea are nevoie și de dreptul de citire, pe care omul plecat nu-l mai are — deci inima rămâne numărată.' },

  'FON-07': { sev: 'mediu', root: 'fonduri',
    why: 'fund_summary adună doar plățile celor care sunt membri în clipa întrebării. Când un plătitor pleacă, banii lui dispar din „strâns”, deși rămân în registru.' },
  'STE-07': { sev: 'mediu', root: 'fonduri',
    why: 'Aceeași cauză ca la FON-07, pe calea ștergerii contului.' },
  'FON-08': { sev: 'scazut', root: 'fonduri',
    why: 'Nimic nu leagă user_id de pe o plată de comunitatea fondului. O plată trecută din greșeală pe alt om îi arată acelui om un rând din registrul unei comunități străine.' },
  'FON-10': { sev: 'scazut', root: 'fonduri',
    why: 'Totalul se calculează ca sumă și se convertește înapoi la bigint. Un fond cu o sumă uriașă dă eroare la conversie, iar eroarea oprește totalurile pentru toate fondurile comunității.' },
  'IZO-38': { sev: 'scazut', root: 'fonduri',
    why: 'fund_community rulează cu drepturi ridicate și e apelabilă de oricine, inclusiv fără cont. Spune cărei comunități îi aparține un fond.' },

  'IZO-37': { sev: 'scazut', root: 'fisiere',
    why: 'Tabelul legacy_issue_photos e citibil de orice om autentificat: căile pozelor vechi (care conțin id-ul autorului) și comunitatea lor.' },

  'DAT-02': { sev: 'scazut', root: 'limite',
    why: 'Nicio coloană de text nu are lungime maximă. Aplicația încarcă toate comentariile comunității la pornire.' },
  'DAT-03': { sev: 'scazut', root: 'limite',
    why: 'Coloanele sunt „not null”, dar textul gol sau doar din spații e acceptat.' },
};

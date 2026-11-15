/*
  What the suite found and nobody has fixed yet.

  Each entry is a scenario that fails because the database does something the
  documentation says it does not. They are kept here rather than beside the
  scenarios so that the whole list of open defects is one screen, and so that
  closing one is deleting one entry — at which point the scenario goes back to
  being an ordinary test that has to pass.

    'SON-07': { sev: 'ridicat', root: 'vot', why: 'Fiecare vot e un rând cu user_id …' },

  sev: critic   — one community's data reachable by somebody outside it
       ridicat  — a promise the product makes in writing, not kept
       mediu    — a rule that can be walked around by somebody already inside
       scazut   — untidy, bounded, or needs unusual effort to matter

  root groups entries that one change would close together; report.mjs has
  the Romanian heading for each.

  Empty since migrations 0020 to 0023, which closed the thirty-two the first
  run found. The list of what those were is in the commit that added this
  file, and in the header of each of those migrations.
*/
export const KNOWN = {};

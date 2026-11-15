/*
  How long a piece of text may be.

  The database is what enforces these — migration 0022 — and it answers
  something too long with an error. These numbers exist so that nobody meets
  that error: a field that stops accepting characters is a limit you can see,
  and a save that fails after you have finished writing is one you cannot.

  They are far above anything the screens are for. Keep them equal to, or
  below, the check constraints of the same name in the migration.
*/
export const LIMITS = {
  title: 300,
  body: 20000,
  message: 5000,
  question: 500,
  option: 200,
  note: 1000,
  location: 300,
  personName: 120,
  apartment: 60,
  phone: 40,
  communityName: 200,
  communityAddress: 300,
  communityDescription: 5000,
};

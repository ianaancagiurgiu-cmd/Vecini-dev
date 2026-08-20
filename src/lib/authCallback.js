/*
  What kind of emailed link brought us here, read from the URL itself.

    https://vecini.example/#access_token=...&refresh_token=...&type=email_change

  The Supabase client announces this too, as a PASSWORD_RECOVERY event, and that
  is what the app used to listen for. But the client reads the URL while it
  starts up, at import time, and announces what it found a tick later — before
  the store has mounted and subscribed. The event was consistently missed, so a
  password-reset link signed the person in and dropped them on the dashboard,
  and the screen for choosing a new password never appeared.

  The URL is still there afterwards, so reading it directly is not a race. This
  module only reads: the client finds what it needs regardless of the order.
*/

function readParams() {
  if (typeof window === 'undefined') return {};
  const out = {};
  const sources = [
    window.location.hash.replace(/^#/, ''),
    window.location.search.replace(/^\?/, ''),
  ];
  for (const source of sources) {
    // A normal route ("/app/settings") parses to one meaningless key, which is
    // harmless: none of the names below can come out of it.
    for (const [key, value] of new URLSearchParams(source)) out[key] = value;
  }
  return out;
}

const params = readParams();

/** 'signup' | 'recovery' | 'email_change' | 'magiclink' | 'invite', or undefined. */
export const callbackType = params.type;

/** Whatever the auth service refused to do, in its own words. */
export const callbackError = params.error_description || params.error_code || params.error || null;

/** True when this page load is the far end of a link we emailed someone. */
export const isAuthCallback = !!(
  params.access_token || params.refresh_token || params.code || callbackError
);

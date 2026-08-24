import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

/*
  Where "back" goes.

  Most screens have one parent and could just name it. Two do not: neighbours
  and notifications open both from settings and from the dashboard, so any
  fixed address is right from one door and wrong from the other — which is the
  bug this replaces, not a refinement of it.

  So: retrace the step actually taken, and fall back to the declared parent when
  there is no step to retrace. That second case is real — a notification opens
  the app directly on a screen, and plain history.back() would then leave the
  app entirely rather than going up a level.

  React Router keeps a counter in history.state; index zero means this entry is
  the first of the session, with nothing behind it belonging to us.
*/
export function useBack(fallback) {
  const nav = useNavigate();
  return useCallback(() => {
    if ((window.history.state?.idx ?? 0) > 0) nav(-1);
    else nav(fallback, { replace: true });
  }, [nav, fallback]);
}

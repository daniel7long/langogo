// Navigation helpers.
//
// goHub(router, path)  jumps to a "hub" screen (Lessons, Profile, Vocab Notes). If that screen is already
//                      in the history, everything above it is closed, so the back button never leads
//                      into screens you have already left (this is what caused the loop where
//                      pressing back on Vocab Notes reopened the review).
// goBackOr(router, p)  goes back one step, or to path p when there is nothing to go back to
//                      (for example after reloading the page).
export function goHub(router, path) {
  if (typeof router.dismissTo === 'function') router.dismissTo(path);
  else router.navigate(path);
}

export function goBackOr(router, fallback) {
  if (router.canGoBack()) router.back();
  else router.replace(fallback);
}

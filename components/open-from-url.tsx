"use client";

import { useEffect } from "react";

/**
 * Opens the item named by ?open=<id> once the page has loaded, by tapping its
 * tile (the element with data-open-id). Used by links from emails and Google
 * Chat ("Open Yayup") and from Ideas, so they land on the reward or profile
 * item itself. The parameter is then dropped so a refresh doesn't reopen it.
 */
export function OpenFromUrl() {
  useEffect(() => {
    const url = new URL(window.location.href);
    const id = url.searchParams.get("open");
    if (!id) return;
    url.searchParams.delete("open");
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
    const key = CSS.escape(id);
    // Shop tiles carry data-open-id; reward and staff discount tiles already carry data-reward-id.
    const target = document.querySelector<HTMLElement>(`[data-open-id="${key}"], [data-reward-id="${key}"]`);
    if (!target) return;
    target.scrollIntoView({ block: "center" });
    target.click();
  }, []);
  return null;
}

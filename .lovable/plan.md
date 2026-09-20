## Sensitive Content System

Let users mark their posts as **sensitive** when creating them, and let viewers choose in their profile settings whether sensitive content is hidden, blurred-with-warning, or shown. By default, sensitive content is **blurred behind a warning** for everyone.

### User Experience

**Creators (Create page):**
- New toggle "Mark as sensitive content" in `Create.tsx` next to existing options (Location, Tags), with a short description: "Adult, graphic, or otherwise mature content."

**Viewers (Profile / Settings):**
- New "Content Preferences" card on `Profile.tsx` (own profile only) with three radio options:
  - Hide sensitive content
  - Blur with warning (default)
  - Always show sensitive content
- Preference persisted in `localStorage` under `red-rxxm:sensitive-pref` and exposed via a tiny `useSensitivePref()` hook so the feed reads it reactively.

**Feed behavior (`PostCard` + `ForYouFeed`):**
- Posts/reels gain an optional `isSensitive` flag.
- Based on the viewer's preference:
  - `hide` → post is not rendered at all.
  - `blur` (default) → media/text is blurred and a centered overlay says "Sensitive content — Tap to view" with a small "Always show" shortcut.
  - `show` → rendered normally with a small "Sensitive" pill next to the username.
- A few mock posts/reels in `mockData.ts` and `ForYouFeed.tsx` get `isSensitive: true` so the behavior is visible immediately.

### Technical Notes

- Pure frontend change. No DB schema or RLS changes — preference lives in `localStorage`, sensitivity flag lives on the mock post objects (matches the rest of the feed which is mock-driven today).
- New file `src/hooks/useSensitivePref.ts` exporting `type SensitivePref = "hide" | "blur" | "show"` and a hook that subscribes to `storage` events so changes in Settings reflect immediately in the feed.
- New small component `src/components/feed/SensitiveOverlay.tsx` reused by both `PostCard` (image/video/text) and `ForYouFeed` reels for visual consistency.
- `PostCard` gets an `isSensitive?: boolean` on `BasePost`; rendering wraps media in a blur layer when `pref === "blur"` and the user hasn't tapped to reveal (local component state).
- `ForYouFeed` reuses the same overlay; `hide` mode filters reels out of the array before mapping.
- `Create.tsx` adds a `sensitive` state toggle (UI only — there's no backend post submission yet, consistent with the current page).

### Files Touched

- `src/components/feed/SensitiveOverlay.tsx` *(new)*
- `src/hooks/useSensitivePref.ts` *(new)*
- `src/pages/Create.tsx` — sensitive toggle row
- `src/pages/Profile.tsx` — Content Preferences card (own profile)
- `src/components/feed/PostCard.tsx` — add `isSensitive`, blur/hide logic
- `src/components/feed/ForYouFeed.tsx` — add `isSensitive`, blur/hide logic
- `src/data/mockData.ts` — flag a couple of posts as sensitive

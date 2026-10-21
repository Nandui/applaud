# Applaud v2 redesign: Mobbin references

Surveyed 2026-10-21 across ~25 iOS apps (Discord, Xbox, PlayStation, Steam-likes, Duolingo, Strava, Threads, Snapchat, Cash App, Venmo, Telegram, iMessage-style pickers, Chipotle/CAVA/CHOPT rewards, Spotify Wrapped, Runna, Finch, WHOOP, Opal, corner, Handshake, Linktree, Hypelist). Previews are in `refs/`.

## Chosen references and why

| Area | Reference | What we take | Why it fits 19–24 year olds |
|---|---|---|---|
| Profile layout | [Discord profile](https://mobbin.com/screens/34b7948b-78c4-4d94-948c-1eba39bb7ec8) (`refs/01`) | Banner → overlapping avatar with decoration ring → status bubble → name + badge row → About me card | The profile they already decorate daily |
| Profile theme | [Discord edit profile](https://mobbin.com/screens/de3de6b0-90ba-4a10-8ac9-217dafa63156) (`refs/02`), [Discord colour picker flow](https://mobbin.com/flows/5e2b0641-60ef-4df6-aeb6-743592d9a5b3) | Two-colour profile theme that tints the whole page; Edit Profile as a sheet with live preview | Self-expression without a shop: everything is free or earned |
| Avatar decorations | [Discord decoration sheet](https://mobbin.com/screens/0033c690-425f-429a-9b47-1c985aaaa63f) | Grid of rings; locked ones show how to unlock | We swap "buy" for "earn": decorations unlock from recognition milestones |
| Status | [Discord set status](https://mobbin.com/screens/01cae5e2-b66d-4b1d-813f-bb6ced19d9e7) | Thought-bubble status on the avatar | Low-effort, fun, ephemeral |
| Showcase / trophies | [Xbox profile](https://mobbin.com/screens/360116dc-529a-4b9d-9c72-dad5a2686753) (`refs/03`), [WHOOP achievements](https://mobbin.com/screens/072a02ea-d162-41c1-abba-dd27b0b8df0f), [Duolingo achievements](https://mobbin.com/screens/7dc56e7a-5099-44aa-88c1-5a8cb629eab6) | Tabbed profile (Received / Trophies / About), trophy shelf of award wins, value badges with counts | The Steam/Xbox showcase feel |
| Feed | [Threads feed](https://mobbin.com/screens/fe72d204-7d68-47a3-bbf2-ca5aafe2969c) (`refs/04`) | Text-first posts, avatar + thread line, compact icon actions, "2 replies · 4 likes" footer | Recognition is mostly words; Threads/X is the native shape for that |
| Kudos social proof | [Strava feed](https://mobbin.com/screens/f9216faa-47b8-4b6c-9e69-6464b21c3d74) | Face-pile "Sam and 12 others reacted" | Makes cheering visible |
| Reactions | [Telegram](https://mobbin.com/screens/236fc8bc-865d-4750-a134-e1ffb0e8b4af) (`refs/09`), [XChat](https://mobbin.com/screens/64cdcbe2-42ad-4dfc-98fe-82e598ac9653) | Long-press (or tap) emoji tray above the post | iMessage tapback muscle memory |
| Send: who | [Snapchat send to](https://mobbin.com/screens/efbd9c79-21ea-4df3-b836-d07c767ff2e4) (`refs/05`) | Search + recents list with round checkboxes, sticky blue send bar with chosen names | The most-used "pick people" UI in this age group |
| Send: points | [Cash App pay sheet](https://mobbin.com/screens/468e7290-291c-4e36-9a5d-be5e5934e897) (`refs/06`) | Giant number + keypad in a bottom sheet | Points feel like money, so use the money UI |
| Send: message | [Threads compose](https://mobbin.com/screens/3511218b-1ba5-44b0-b944-dbd3565c7280) | Full-screen composer, toolbar for GIF / photo / value | Familiar posting surface |
| Celebrate | [Runna PB](https://mobbin.com/screens/0e8a24e7-31ae-4657-bc16-6ace3abc70ea) (`refs/10`), [Finch](https://mobbin.com/screens/87a4df00-120f-4fed-bbbd-28c7637e6c4b) | Confetti success screen after sending, badge unlock moments | Dopamine on the action we want repeated |
| Leaderboard | [Duolingo league](https://mobbin.com/screens/3ca570fe-9e97-4e65-85eb-3e544a7eacab) (`refs/07`) | Ranked list, your row highlighted and pinned, big rank numbers | Universally understood by this age group |
| Rewards | [CHOPT](https://mobbin.com/screens/01247d01-f64c-40ac-8884-4f7aec993bdb) (`refs/08`), [Xbox rewards](https://mobbin.com/screens/d871c5dc-6ff2-4be2-8a31-4b8088ad809a), [CAVA](https://mobbin.com/screens/48e0e359-5704-4b72-8f48-e4a6457d25bc) | Balance hero, category chips, cards with "x% of the way there" progress | Clear "what can I get" at a glance |
| Recap (later) | [Spotify Wrapped](https://mobbin.com/screens/9cc6cdc9-6c8f-49aa-99f7-1531de8b5017) | Big-number story cards | Possible monthly "your month in applause"; not in this PR |

## Considered and not used

- Instagram-style stories row: no stories feature (Fernando said no).
- Discord server sidebar: there is one workplace, so a server rail adds nothing.
- Venmo feed: too plain; Threads gives the same text-first shape with more personality.
- Linktree / Airbuds full-canvas profile editors: too free-form for a workplace; Discord's structured theme is safer and still expressive.
- Any paid cosmetics / shop UI (Discord Nitro, Xbox store): decorations are earned, never bought.

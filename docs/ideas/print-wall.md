# Print Wall

Status: **idea — validated on hardware geometry, not yet specced**
Date: 2026-11-14
Related: [`../../specs/ee02-13in-spectra6/SPEC.md`](../../specs/ee02-13in-spectra6/SPEC.md), [`../../specs/icloud-album-sync/SPEC.md`](../../specs/icloud-album-sync/SPEC.md)

---

## Problem Statement

How might we let the live 13.3" Spectra 6 frame show a rotating wall of public-domain
prints from the Rijksmuseum, with gallery placards, switchable against the photo
rotation — without firmware changes or manual steps?

---

## Recommended Direction

A new source tool, `apps/museum/`, mirroring the `icloud-album-sync` pattern: fetch from
the Rijksmuseum Linked Art API → verify rights → render at the `spectra6-133` profile with a
**baked-in placard** → write to a **per-mode staging folder** → regenerate the manifest →
deploy.

"Mode" is a folder swap on the Mac. The device's round-robin index is modulo'd
(`((art_index % c) + c) % c`), so it wraps safely across a swap. No firmware change.

Curation starts as a **hand-picked list of object IDs** in a JSON file. The API has no
free-text search and the collection is 390k prints; a curated list is both more
controllable and cheaper on a rate-limited, three-hop fetch.

---

## Source: Rijksmuseum

Verified live on 2026-11-14. The old key-based `rijksmuseum.nl/api` is retired; the current
service is keyless Linked Art.

| Property | Value |
|---|---|
| Search | `https://data.rijksmuseum.nl/search/collection` — keyless, no auth |
| Query | field-based only: `type`, `technique`, `material`, `creator`, `creationDate`, `title` |
| Filter used | `type=print&imageAvailable=true` (≈390k objects) |
| Image chain | object → `shows` VisualItem → `digitally_shown_by` DigitalObject → `access_point` |
| Image URL | IIIF at `iiif.micr.io`; request `/full/!1600,1600/0/default.jpg` |
| Rights | per-object `subject_to → classified_as`; accept `publicdomain/mark` (PD) or `publicdomain/zero` (CC0) |
| Vocabulary | **Dutch terms essential** — `lithograph` 364 hits vs `lithografie` 40,683 |
| Resolution | verified 9700×14284 on first poster; IIIF serves exactly what is asked |

**Why the chain matters:** three sequential GETs per artwork. Cache all three hops, or a
20-item sync is 60 requests before the image download.

**Why `type=print`, not `type=poster`:** posters are a thin slice (~5k). Prints are the
collection's centre of gravity and the dithering spike (below) shows they hold up.

---

## Dithering Evidence (spike, 2026-11-14)

Six public-domain prints, one per technique class, fetched at 1600px and run through the
real pipeline: `bun packages/epaper/src/prepare.ts --profile spectra6-133 --fit`.

| Sample | Technique | Result |
|---|---|---|
| `kleurenlithografie-200101267` | colour lithograph | **Excellent** — red/blue/yellow survive; paper becomes fine halftone |
| `houtsnede-200100990` | woodcut | **Very good** — bold line and type hold |
| `lithografie-20010096` | lithograph | **Good** — form legible, slight softening |
| `houtgravure-200101106` | wood engraving | **Good** — same |
| `mezzotint-20010651` | mezzotint | **Surprisingly good** — dense stipple reads as engraving texture |
| `aquatint-200106046` | aquatint | **Weakest** — tonal washes flatten to uniform grain; fine at 1 m, muddy at 30 cm |

**Verdict:** `type=print` is viable. The failure mode is *stylization*, not destruction.

**The happy accident:** the panel converts everything to a dot/line screen, and prints
already *are* line and halftone media. The constraint is on-brand for prints in a way it
would never be for paintings. A painting would look wrong; a print looks like a print.

**Not covered by the spike:** full-frame composition at viewing distance on the actual
panel, and whether the profile's `pre_filter` (`-modulate 95,160 -sigmoidal-contrast 4,50%`,
tuned for photos) over-saturates colour lithographs.

---

## Mode Switching

Each source stays sole writer of its own folder — the mirror step deletes anything not in
its `.managed.json`, so two syncs in one folder would delete each other's files.

```
www/epaper13-modes/art/      ← museum sync writes here (.managed.json)
www/epaper13-modes/photos/   ← iCloud sync writes here
www/epaper13/                ← live; set-mode.ts publishes one into it
```

`set-mode.ts art|photos` rsyncs the chosen mode into the live folder and regenerates the
manifest. The prev/next buttons navigate artworks for free — no firmware work.

---

## Placard

Baked into the PNG at prepare time. The manifest is a flat array of filenames parsed by a
naive quoted-string scan, and the device renders no text — so a placard cannot be metadata.

- Bottom strip, ~10–12% of the 1200 px height, white background.
- Title / artist / date, black text, serif.
- Black on white is the one part of this that is not fighting the palette.

Open: strip (shrinks the artwork) vs overlay (covers the artwork).

---

## Key Assumptions to Validate

- [x] **Dithering preserves prints** — spike above; tone flattens but form survives.
- [ ] **Rights pass rate across `type=print`** — license is not a search facet; sample 50 and
      measure PD/CC0. The six samples were all PD.
- [ ] **`pre_filter` is right for art** — it boosts saturation 160% for photos; a colour
      lithograph may end up garish. Compare with the filter disabled.
- [ ] **Placard legibility at 6 colours** — render at final size.
- [ ] **Folder-swap preserves rotation sanity on hardware** — code wraps; verify on the frame.

---

## MVP Scope

- Rijksmuseum only, keyless Linked Art, with a local three-hop cache.
- Hand-curated list of ~20 object IDs, all PD/CC0.
- Prepare with placard → `www/epaper13-modes/art/` → manifest → deploy.
- `set-mode.ts art|photos`.
- Manual runs only; no scheduling.

---

## Not Doing (and Why)

- **Live query-driven discovery** — no free-text search, and a list is controllable.
- **Paintings** — the tonal-dithering problem the print scope was chosen to avoid.
- **AI-generated art** — cost and slop; its own spec.
- **Generative/procedural art** — strong candidate, but its own spec.
- **Multiple museums at once** — the Met is the obvious second source; one first.
- **Firmware changes** — the whole point is that none are needed.
- **Captions in the manifest** — the device cannot render text; bake into the PNG.

---

## Open Questions

| # | Question | Default if unresolved |
|---|---|---|
| Q1 | Placard: strip or overlay? | Strip (white mat reads as a frame) |
| Q2 | `pre_filter` for art: keep, soften, or disable? | Disable, measure |
| Q3 | `--fit` (white mat) or cover (centre-crop) for art? | `--fit` — never crop a composition |
| Q4 | Reuse `.managed.json` mirror semantics, or a stable non-churning set? | Mirror, same as photos |
| Q5 | Hand-picked IDs or a query seed once the path works? | List first |
| Q6 | Scheduling: launchd at the same 6 h cadence as the photo sync? | Yes, once manual runs are proven |

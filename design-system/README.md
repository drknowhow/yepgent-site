# yepgent.com — design system (reference)

A browsable, visual reference for the **v4 design system**: the tokens, the
type, and the components that build yepgent.com. It mirrors what already ships
in `style.css`, and it is the source for the Claude Design project on
[claude.ai/design](https://claude.ai/design).

> **Canon lives elsewhere.** `BRAND.md` and `DESIGN.md` (repo root) are the
> written source of truth, and `style.css` is the *production* token source.
> The `tokens.ds.css` here is a standalone copy of the v4 tokens so the cards
> render on their own; keep it in step with `style.css`, do not fork the brand
> from it.

## What's here

```
design-system/
  tokens.ds.css      canonical v4 tokens (dark :root + light override + shell tokens)
  _preview.css       shared harness for the cards (warm-white editorial shell)
  gallery.html       open this to browse every card locally
  _ds_manifest.json  card + token index for the claude.ai/design pane
  foundations/       brand, color, typography, spacing, shape, motion
  components/        nav, hero, buttons, memory-terminal, cards
```

Each card is a standalone HTML preview. The first line is a
`<!-- @dsCard group="…" name="…" -->` marker; every card links `tokens.ds.css`
then `_preview.css` and sets `<html data-theme="light">` so it reads as the
warm-white site.

## Preview locally

Open `gallery.html` directly, or serve the folder (some browsers block
`file://` sub-resources):

```sh
python -m http.server 8799 --directory design-system
# then open http://127.0.0.1:8799/gallery.html
```

## The system, in one breath

Functionalist editorial with a terminal undertone. Warm-white in light,
near-black in dark. One committed brand green at `<=12%` of any surface
(`#0a8a5a` light / `#1db981` dark, hue-locked). Oversized serif-italic display
(Iowan Old Style), system sans for body, mono for the machine voice. The drawn
sprout, the `yepgent.` wordmark, "an agent that grows."

## Claude Design

This folder is the source for the **"Design System"** project on
claude.ai/design (synced via the Design Sync tooling). To change a card, edit
its HTML here and re-sync; `_ds_manifest.json` is the index that pane reads.

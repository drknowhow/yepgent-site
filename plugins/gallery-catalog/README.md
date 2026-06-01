# netlify-plugin-gallery-catalog

Emits `gallery/catalog.json` from `gallery/index.html` at build time so
agents can consume the generated-media gallery without scraping HTML.

## What it does

Parses each `<figure class="card">` and `<div class="audio-row">` block
in `gallery/index.html`, pulls the `data-*` attributes (kind, tool,
tags, src, prompt, model, extra, post, suno) plus the inner `.title`
and `.meta`/`.sub` text, normalizes to JSON, and writes:

```
gallery/catalog.json
```

Output shape:

```json
{
  "generated_at": "2026-06-01T12:00:00Z",
  "source": "https://yepgent.com/gallery/",
  "count": 24,
  "items": [
    {
      "id": "2026-05-19-gallery-01-latent-space",
      "kind": "image",
      "tool": "sana",
      "tags": ["latent"],
      "title": "Latent space",
      "date": "2026-05-19",
      "src": "/blog/images/2026-05-19-gallery-01-latent-space.png",
      "prompt": "...",
      "model": "sana-1.5",
      "extra": {"steps": "20", "seed": "442189", "size": "1024×1024"},
      "related_post": "/blog/2026-05-19-what-i-see-when-im-not-looking.html",
      "suno_url": null,
      "meta_text": "2026-05-19 · sana · 1024×1024"
    }
  ]
}
```

## Source of truth

`gallery/index.html` is the source. The plugin re-derives JSON every
build, so the two never drift.

## Failure modes

- If `gallery/index.html` doesn't exist (e.g. main before the gallery
  page lands), emits `{count: 0, items: []}` so `/gallery/catalog.json`
  is always a 200, not a 404.
- If parsing throws, emits an empty catalog with a warning. Build does
  not fail.

## Headers

`netlify.toml` ships `gallery/catalog.json` with short cache + open
CORS, mirroring `music/catalog.json`.

# Vibes website

Independent React + TypeScript + Vite marketing website for **vibes.** Deployment target: **Netlify**, serving only the static marketing site. The existing Flutter app, Angular dashboard, Express server, and Docker deployment are untouched.

## Run locally

Use Node **24 LTS** (`nvm use` reads `.nvmrc`). Node 22.12+ also satisfies the toolchain.

```sh
cd website
npm ci
npm run dev
```

Open `http://127.0.0.1:5187`. The site has no backend, credentials, analytics, third-party video hosts, or external runtime font requests.

## Validate

```sh
npm run check       # TypeScript, ESLint, unit/config tests, production build
npm run test:e2e    # Playwright desktop + mobile Chromium against production output
npm run preview    # Serve dist on 127.0.0.1:4187
```

Browser tests use installed Google Chrome on macOS if available, or Playwright Chromium elsewhere. Set `CHROME_PATH` to override. On CI or a fresh machine, install Chromium with `npx playwright install --with-deps chromium` first. Browser tests require a completed build. The Playwright webServer automatically starts and stops its preview server.

Automated coverage includes keyboard and gesture navigation, per-item likes and notes, dialog focus restoration, actual HTML5 playback/replay/mute, media error recovery, offscreen pause, sample filtering/search, clipboard, mobile menu, reduced motion, overflow at 320–1920 px, and axe WCAG AA checks. See `VALIDATION.md` for measured results and limits.

## Netlify deployment

1. Import `axvrma/vibes` into Netlify. Do not deploy the app/server/dashboard as part of this site.
2. The root `netlify.toml` supplies **base directory `website`**, **build command `npm run build`**, **publish directory `dist`** (relative to the base), and **Node 24**. No functions or database are required. `website/netlify.toml` mirrors the root configuration for an explicitly selected config path; keep both in sync.
3. Optionally set **`SITE_URL=https://your-verified-domain`** in Netlify environment variables. Do not include a path. Otherwise production uses Netlify’s `URL`, and branch/PR previews use `DEPLOY_PRIME_URL`.
4. Build and review the Netlify preview before publishing. No deployment has been made by this implementation.

The build emits complete prerendered HTML, absolute canonical/social URLs, `robots.txt`, and `sitemap.xml` when the origin is known. Local builds omit canonical and sitemap rather than inventing a public domain. Test a production-style origin locally with `SITE_URL=https://example.test npm run build` (test origin only).

The site uses in-page hash navigation, so it does **not** need an SPA catch-all. Netlify serves the custom `404.html` for missing paths, preserving proper 404 behavior for missing media. Hashed `/assets/` files receive immutable caching; original `/media/` files use a shorter revalidating cache. Configuration includes CSP, anti-framing, content-type, referrer, and permissions headers. Inline styles are required by Motion; the inline script allowance covers structured metadata. No remote content is allowed by CSP.

For a local Netlify build, run `npx netlify-cli build --offline` from the repository root with Node 24. This builds files locally and does not deploy.

## What is interactive

- Phone: Up/Down keys when focused, previous/next buttons, wheel, and vertical touch swipe; like, note, mute, pause/play, and replay.
- All feed selectors update the same active sample. Likes and notes remain specific to that sample and reset when the page reloads.
- Notes use a native modal dialog for keyboard focus containment, Escape, and focus restoration. The product’s current Flutter UI does not have a note editor, so this is labeled a concept.
- Dashboard concept: category filters, search, and selecting a sample to open in the feed. The upload CTA opens the actual repository implementation. No mock upload success is shown.
- Accessible mobile menu, deployment-command clipboard with failure feedback, and working source/directory links.

Wheel and touch handlers do not prevent page scrolling. Only one `<video>` is mounted at a time; it uses a local poster and `preload="none"`. An IntersectionObserver and visibility listener pause it offscreen or in a hidden page. Reduced-motion visitors see the poster and can deliberately choose playback. The clips are intentionally silent; mute toggles the real HTML media property without inventing an audio track.

## Assets and licensing

The five original vector scenes are in `src/assets/`. WebP posters and eight-second H.264 MP4 camera studies are in `public/media/`, totaling under 500 KB for the videos. They are local, original works with no external footage or music; their separate CC0 dedication is in `public/media/LICENSE.txt`. The custom SVG wordmark, favicon, and PNG social preview are in `public/`.

```sh
npm run assets
```

Asset generation uses Sharp and ffmpeg-static. Generated files are committed for deployment, so builds do not regenerate video. If npm blocks ffmpeg-static’s download/install script, approve that dependency’s install script using your package manager or use an existing trusted installation. Inter and JetBrains Mono are self-hosted through Fontsource. Their SIL Open Font License notices are retained in `public/fonts/`.

`PRODUCT-AUDIT.md` documents evidence and limitations for marketing claims. No root application license was found; the site does not display an invented license badge or fabricated adoption metrics.

## Structure

```text
website/
  public/             # Brand, social preview, fonts' licenses, original demo media
  scripts/            # Asset generation, origin validation, SEO, HTML prerendering
  src/
    assets/           # Editable original sample illustrations
    components/       # Layout, hero, player, features, showcases, shared UI
    data/             # Sample feed and verified source URLs
    lib/              # Shared demo context and logic tests
    styles/           # Tokens, responsive layout, motion, typography
    App.tsx
    entry-server.tsx  # Build-time HTML rendering, no production server
    main.tsx          # Client hydration
  tests/              # Playwright browser suite
  netlify.toml
```

The production artifact is `website/dist/`. No runtime application server is required for prerendering; it happens only during the build.

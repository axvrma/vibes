# Validation

Executed locally on 3 November 2026 with Node 24.19.0 and installed Google Chrome. Tests ran against the production build, not the development server.

| Check                                     | Result                                                                                                                                                     |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TypeScript (`npm run typecheck`)          | Passed                                                                                                                                                     |
| ESLint (`npm run lint`)                   | Passed                                                                                                                                                     |
| Prettier (`npm run format:check`)         | Passed                                                                                                                                                     |
| Vitest (`npm test`)                       | 10 passed                                                                                                                                                  |
| Playwright (`npm run test:e2e`)           | 23 passed; 3 intentionally skipped for inapplicable input methods                                                                                          |
| axe WCAG 2 A/AA + 2.1 AA                  | No violations in the full page or open notes dialog, desktop and mobile                                                                                    |
| Vite production build + HTML prerendering | Passed                                                                                                                                                     |
| Netlify CLI (`netlify build --offline`)   | Passed using the repository configuration; no deployment                                                                                                   |
| Production-origin SEO output              | Canonical, absolute social image URLs, sitemap, robots, and prerendered content verified with a test origin; test origin removed from final local artifact |
| Dependency audit (`npm audit`)            | 0 known vulnerabilities, including development dependencies                                                                                                |

## Browser coverage

- Hero content, anchors, repository CTAs, metadata, and JavaScript error monitoring.
- Feed navigation by buttons, keyboard, wheel, and touch. Feed endpoints disable the corresponding navigation button. Wheel events remain uncancelled so the phone does not trap page scrolling.
- Per-item likes; note creation, editing, Escape, focus restoration, and item isolation.
- Actual HTML5 video loading, muted default, sound property toggle, pause/play, seek/replay, one mounted video, offscreen pause, error display, and continued feed navigation after a failed media request.
- Functional sample-library category filters, search, empty results, and selecting an item to open in the phone.
- Exact deployment-command clipboard output; mobile-menu open, Escape, focus restoration, and closing on navigation.
- Reduced-motion initial poster state and deliberate playback.
- No document overflow at widths 320, 375, 650, 768, 1024, 1440, and 1920 px.

The three skipped cases are mobile menu and touch on the desktop project, and mouse wheel on the mobile project. Each behavior is exercised on the applicable project.

## Lighthouse

Lighthouse 13.5.0, production preview on loopback, default mobile throttling and desktop preset:

| Profile | Performance | Accessibility | Best practices | SEO |
| ------- | ----------- | ------------- | -------------- | --- |
| Mobile  | 96          | 100           | 100            | 100 |
| Desktop | 99          | 100           | 100            | 100 |

Mobile measured FCP 1.6 seconds, LCP 2.5 seconds, TBT 80 ms, CLS 0. Local measurements are evidence for this build, not a guarantee of deployed scores or field performance. Hosting, browser, CPU contention, and network conditions affect results. An earlier mobile run during simultaneous browser audits scored lower; the final run used the optimized production build. Recheck after deployment.

Main JavaScript is approximately 99 KB gzip; Motion’s lazy feature chunk is about 17.5 KB gzip. CSS is about 13.8 KB gzip. The five original eight-second silent H.264 clips total approximately 420 KB. Only the active video mounts; fonts and media are served locally.

To reproduce Lighthouse locally, first run `npm run build` and `npm run preview`, then:

```sh
CHROME_PATH=/path/to/chrome npx lighthouse http://127.0.0.1:4187 \
  --chrome-flags="--headless --no-sandbox" \
  --only-categories=performance,accessibility,best-practices,seo
```

Add `--preset=desktop` for the desktop run. Run performance audits without other CPU-heavy browser work for comparable results.

## Limits and product accuracy

- Tested in desktop Chromium and mobile-emulated Chromium. Physical devices, Safari/WebKit, and Firefox were not tested.
- Local Netlify build and configuration verified; production CDN headers, public domain, HTTPS, and deployed field performance require a real deployment. Nothing was published.
- No application-service integration or end-to-end Docker installation was attempted; this is an independent static marketing site.
- The dashboard is an explicitly labeled concept based on implemented repository capabilities, not an authentic screenshot.
- The notes editor is an explicitly labeled concept: note storage APIs exist, but the pre-2.3 Flutter UI had no verified note editor. The 2.3 implementation and validation are documented below. Demo state is session-only.
- The sample clips are original animated illustrations, not real-world travel footage. They intentionally have no audio track.
- No application license file was found. No permissive-license badge, store availability, fake metrics, or guaranteed privacy/security claims were added.

See `PRODUCT-AUDIT.md` for claim-by-claim source evidence and `README.md` for deployment and asset-generation instructions.


## 2.3 alignment validation (5 November 2026)

After adding the accurate acquisition-mode/library section and canonical colors, `npm run check` passed (typecheck, ESLint, 10 unit tests, production build/prerender). Playwright passed 23 tests with 3 existing input-method skips, including axe checks and responsive widths. The later actual-dashboard capture is rechecked in the release validation record at `../docs/VALIDATION-2.3.md`; prior Lighthouse scores above are historical and are not claimed for the 2.3 page.

The Flutter notes editor is now implemented and covered by widget tests. This static website still uses session-only demo state. The new screenshot is a real disposable test installation; the older interactive dashboard is still an explicitly labeled concept. See updated PRODUCT-AUDIT.md.

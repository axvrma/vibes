# Vibes — Your Private Video Universe.

Your space. Your stories. Your vibe.

The 2.3 identity preserves the website's hand-built lowercase wordmark, open V monogram and rose dot. No player triangle or public-social symbolism. Dark cinematic canvas, rose interaction, soft violet focus, generous spacing. Light mode uses a darker rose for readable contrast. `tokens.json` is canonical; run `node scripts/generate-brand.mjs` from the repository root to regenerate platform tokens and artwork (uses website's existing Sharp).

SVG masters: wordmark, monogram, horizontal lockup, light/dark and monochrome. Keep the original geometry; give the mark at least half its height in clear space. Never stretch or apply extra effects. Launcher icons use opaque square backgrounds; adaptive foregrounds retain transparency and safe-zone padding. Fonts: bundled Inter under SIL OFL (see LICENSE files). UI animation honors reduced motion. Feed overlays remain white on black for legibility regardless of application theme.

Flutter also bundles the SDK’s Apache-licensed Roboto as its engine fallback. Inter remains the interface typeface. Web renderer and font fallback URLs resolve to the deployment origin; adding glyph coverage for other scripts requires additional local fonts.

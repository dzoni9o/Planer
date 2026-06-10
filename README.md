# Planer / NikVolt

Standalone HTML/JS aplikacija za planiranje instalacija.

## Struktura

- `public/index.html` - glavna aplikacija
- `public/pdf-export.js` - vektorski PDF izvoz
- `build.mjs` - kopira `public/` u `dist/` za deploy
- `vercel.json` - Vercel build/output podesavanja

## Deploy

Vercel pokrece:

```sh
npm run build
```

Build pravi `dist/`, a Vercel servira `dist/index.html`.

Podaci se cuvaju lokalno u browseru kroz `localStorage` pod kljucem `nikvolt_v5`.
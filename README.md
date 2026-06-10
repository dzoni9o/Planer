# Planer / NikVolt

Standalone HTML/JS aplikacija za planiranje elektro instalacija.

## Fajlovi

- `index.html` - glavna aplikacija, spremna za zero-config static hosting
- `pdf-export.js` - vektorski PDF izvoz
- `package.json` / `build.mjs` - opcioni build za Vercel ako je u UI ukljucen Build Command

## Vercel

Najjednostavnije podesavanje:

- Framework Preset: `Other`
- Root Directory: prazno
- Build Command: prazno
- Output Directory: prazno

Ako Vercel projekat ipak ima `Build Command` podesen na `npm run build`, build pravi i `dist/` i `public/`, tako da Output Directory moze biti `dist` ili `public`.

Podaci se cuvaju lokalno u browseru kroz `localStorage` pod kljucem `nikvolt_v5`.
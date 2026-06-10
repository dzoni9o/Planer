# Planer / NikVolt

Standalone HTML/JS aplikacija za planiranje elektro instalacija.

## Fajlovi

- `index.html` - glavna aplikacija
- `pdf-export.js` - vektorski PDF izvoz

## Deploy

Ovo je zero-config staticki sajt. Vercel treba direktno da servira `index.html` iz root-a repo-a.

U Vercel Project Settings ostaviti:

- Framework Preset: `Other`
- Root Directory: prazno
- Build Command: prazno
- Output Directory: prazno

Podaci se cuvaju lokalno u browseru kroz `localStorage` pod kljucem `nikvolt_v5`.
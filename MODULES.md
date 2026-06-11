# Uredjivanje modula

Module menjas u fajlu `modules.js`.

Svaki modul je jedan objekat:

```js
{kod:'9999', naziv:'Nova uticnica', serija:'MODE', kat:'uticnica', vel:2, opis:'16A 250V~ 2M'}
```

Polja:

- `kod`: sifra artikla bez `.0`
- `naziv`: naziv koji se prikazuje u aplikaciji
- `serija`: `MODE` ili `EXP`
- `kat`: `sklopka`, `uticnica`, `usb`, `data`, `tel`, `antena`, `audio`, `hdmi`, `dimmer`, `detektor`, `ostalo`
- `vel`: koliko mesta zauzima u dozni, npr. `1`, `2`, `4`
- `opis`: kratak opis

Za lokalnu aplikaciju: sacuvaj `modules.js` i refreshuj browser.

Za Vercel: sacuvaj izmenu, uradi commit i push na GitHub.

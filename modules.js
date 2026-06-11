// NikVolt katalog modula.
// Ovaj fajl slobodno uredjujes rucno. Posle izmene uradi refresh aplikacije.
// Za Vercel/GitHub: sacuvaj izmenu, commit i push.
//
// Primer novog modula:
// {kod:'9999', naziv:'Nova uticnica', serija:'MODE', kat:'uticnica', vel:2, opis:'16A 250V~ 2M'},
//
// Polja modula:
// kod    - sifra artikla bez .0
// naziv  - naziv koji se prikazuje u aplikaciji
// serija - MODE ili EXP
// kat    - sklopka, uticnica, usb, data, tel, antena, audio, hdmi, dimmer, detektor, ostalo
// vel    - koliko mesta zauzima u dozni: 1, 2, 4...
// opis   - kratak opis

window.NIKVOLT_MODULES = {
  MODE: [
  {kod:'655',   naziv:'Sklopka jednopolna',                  serija:'MODE', kat:'sklopka',  vel:1, opis:'10A 1M'},
  {kod:'657',   naziv:'Sklopka naizmenična',                 serija:'MODE', kat:'sklopka',  vel:1, opis:'10A 1M'},
  {kod:'658',   naziv:'Sklopka ukrsna',                      serija:'MODE', kat:'sklopka',  vel:2, opis:'10A 2M'},
  {kod:'6552',  naziv:'Sklopka jednopolna 2M',               serija:'MODE', kat:'sklopka',  vel:2, opis:'10A 2M'},
  {kod:'6572',  naziv:'Sklopka naizmenična 2M',              serija:'MODE', kat:'sklopka',  vel:2, opis:'10AX 250V~ 2M'},
  {kod:'675',   naziv:'Sklopka jednopolna 16A + ind.',       serija:'MODE', kat:'sklopka',  vel:1, opis:'16A 1M, ind.'},
  {kod:'6581',  naziv:'Sklopka jednopolna 16A',              serija:'MODE', kat:'sklopka',  vel:1, opis:'16A 1M'},
  {kod:'6582',  naziv:'Sklopka naizmenična 10A',             serija:'MODE', kat:'sklopka',  vel:1, opis:'160 1M'},
  {kod:'6590',  naziv:'Sklopka ukrsna 16A 2M',               serija:'MODE', kat:'sklopka',  vel:2, opis:'16A 2M'},
  {kod:'6541',  naziv:'Taster jednopolni 1M',                serija:'MODE', kat:'sklopka',  vel:1, opis:'10A 1M'},
  {kod:'6542',  naziv:'Taster naizmenični 1M',               serija:'MODE', kat:'sklopka',  vel:1, opis:'10A 1M'},
  {kod:'652',   naziv:'Utičnica 1M',                         serija:'MODE', kat:'utičnica', vel:1, opis:'10A 1M'},
  {kod:'654',   naziv:'Utičnica 2M',                         serija:'MODE', kat:'utičnica', vel:2, opis:'16A 2M'},
  {kod:'6540',  naziv:'Utičnica 2M 16A sa zaštitom',         serija:'MODE', kat:'utičnica', vel:2, opis:'16A 2M, sa zaštitom'},
  {kod:'6671',  naziv:'Dimmer',                              serija:'MODE', kat:'dimmer',   vel:1, opis:'230V 1M'},
  {kod:'6629',  naziv:'USB punjač 2,1A (tip A)',             serija:'MODE', kat:'usb',      vel:1, opis:'2,1A 5V~ 1M'},
  {kod:'6626',  naziv:'USB tip C punjač 3A',                 serija:'MODE', kat:'usb',      vel:1, opis:'3A/5V~ 1M'},
  {kod:'664S',  naziv:'RJ45 Keystone Cat5e UTP',             serija:'MODE', kat:'data',     vel:1, opis:'RJ45 Cat5e UTP 1M'},
  {kod:'665',   naziv:'RJ45 Keystone Cat6 UTP',              serija:'MODE', kat:'data',     vel:1, opis:'RJ45 Cat6 UTP 1M'},
  {kod:'6623',  naziv:'Antenska TV završna 5dB',             serija:'MODE', kat:'antena',   vel:1, opis:'End-line 5dB IEC 1M'},
  {kod:'6627',  naziv:'Audio 2×RCA',                         serija:'MODE', kat:'audio',    vel:1, opis:'Audio 2×RCA 1M'},
  {kod:'6500',  naziv:'Slijepi modul',                       serija:'MODE', kat:'ostalo',   vel:1, opis:'Slepo mesto 1M'},
],

  EXP: [
  {kod:'73104', naziv:'Sklopka jednopolna EXP 1M',           serija:'EXP',  kat:'sklopka',  vel:1, opis:'Jednopolni EXP 1M'},
  {kod:'73105', naziv:'Sklopka naizmenična EXP 1M',          serija:'EXP',  kat:'sklopka',  vel:1, opis:'Naizmenicni EXP 1M'},
  {kod:'73106', naziv:'Sklopka ukrsna EXP 1M',               serija:'EXP',  kat:'sklopka',  vel:1, opis:'Ukrsni EXP 1M'},
  {kod:'73101', naziv:'Taster EXP 1M',                       serija:'EXP',  kat:'sklopka',  vel:0, opis:'Tipka EXP 1M'},
  {kod:'73301', naziv:'Taster EXP 2M',                       serija:'EXP',  kat:'sklopka',  vel:1, opis:'Tipka EXP 2M'},
  {kod:'72202', naziv:'Dimmer sijalice EXP',                 serija:'EXP',  kat:'dimmer',   vel:1, opis:'230V~ 1M EXP'},
  {kod:'74121', naziv:'Utičnica 1M EXP',                     serija:'EXP',  kat:'utičnica', vel:1, opis:'10A 250V~ 1M'},
  {kod:'74151', naziv:'Utičnica 2M EXP',                     serija:'EXP',  kat:'utičnica', vel:2, opis:'16A 250V~ 2M'},
  {kod:'74152', naziv:'Utičnica 16A sa zaštitom EXP',        serija:'EXP',  kat:'utičnica', vel:2, opis:'16A 250V~ 2M, zaštita'},
  {kod:'74289', naziv:'USB punjač 2,1A EXP 1M',              serija:'EXP',  kat:'usb',      vel:1, opis:'USB charger 2,1A 5V~ 1M'},
  {kod:'74286', naziv:'USB tip C EXP',                       serija:'EXP',  kat:'usb',      vel:1, opis:'USB C 3A/5V~ EXP 1M'},
  {kod:'74281', naziv:'Audio 2×RCA EXP',                     serija:'EXP',  kat:'audio',    vel:1, opis:'Audio 2×RCA EXP 1M'},
  {kod:'74263', naziv:'Antenska TV završna 5dB EXP',         serija:'EXP',  kat:'antena',   vel:1, opis:'Zavrsna TV 5dB EXP 1M'},
  {kod:'74221', naziv:'RJ45 Keystone Cat5e UTP EXP',         serija:'EXP',  kat:'data',     vel:1, opis:'RJ45 Cat5e UTP EXP 1M'},
  {kod:'74223', naziv:'RJ45 Keystone Cat6 UTP EXP',          serija:'EXP',  kat:'data',     vel:1, opis:'RJ45 Cat6 UTP EXP 1M'},
  {kod:'70001', naziv:'Slijepi modul EXP',                   serija:'EXP',  kat:'ostalo',   vel:1, opis:'Slepo mesto EXP 1M'},
],
};

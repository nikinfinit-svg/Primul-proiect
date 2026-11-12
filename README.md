# Portar – antrenamente

Aplicație personală pentru un portar de handbal: tabel săptămânal, antrenamente generate la sală, progresie pe greutăți.
Rulează în browserul telefonului. Nu are server, cont, API-uri plătite sau costuri. Datele rămân pe telefon (localStorage).

Codul e în folderul `app/`:

| Fișier | Ce conține |
|---|---|
| `index.html` | pagina |
| `app.js` | logica: calendarul, generarea antrenamentului, progresia, setările |
| `exercises.js` | lista fixă de exerciții (24), cu zone, echipament, note de tehnică și linkuri YouTube |
| `style.css` | tema întunecată cu accente verzi |
| `sw.js`, `manifest.webmanifest`, `icon*` | instalare pe ecranul principal și funcționare offline |

## Cum o pui pe telefon
1. Publică folderul `app/` pe un hosting static, de exemplu GitHub Pages (Settings → Pages) sau Netlify Drop.
2. Deschide linkul pe telefon. Pe iPhone: Safari → Partajează → „Adaugă pe ecranul principal”. Pe Android: Chrome → meniu → „Instalează aplicația”.
3. Din Setări descarcă din când în când o copie de siguranță (JSON).

## Calendarul lunar
Trimiți poza calendarului în chat cu Claude și ceri programul în formatul de mai jos. Apoi îl lipești în aplicație, la Setări → Calendarul echipei:

```
2026-12-01 handbal
2026-12-02 sala
2026-12-06 meci
```

Stările posibile sunt `liber`, `meci`, `handbal` și `sala`. Merge și formatul `06.12.2026 meci`. Zilele care lipsesc din listă primesc starea implicită: sală marți și joi, liber în rest.

## Reguli implementate
- Rotație forță grea → completare → explozie, în funcție de antrenamentul anterior. Dacă ești obosit, forța grea devine completare, cu o serie mai puțin și greutăți cu ~10% mai mici.
- Durata e de minimum 60 de minute (estimată din serii, pauze și tranziții). Se adaugă exerciții de completare până se ajunge la 60.
- Exercițiile folosite data trecută sau mai recent primesc prioritate mai mică. Numărul de serii și repetări se alege din intervalul fiecărui tip și diferă față de data trecută.
- Zonele bifate ca dureroase scot toate exercițiile care au acea zonă.
- Adductori: maximum 3 serii. Săriturile laterale apar doar dacă bifezi confirmarea kinetoterapeutului în Setări și starea e „bine”. Ridicarea la bară apare doar când starea e „bine”.
- Progresie: dacă la toate seriile atingi maximul intervalului (6 la forță, 12 la completare), greutatea crește cu pasul exercițiului. Altfel rămâne aceeași. Exercițiile fără greutate cresc prin repetări (sau secunde).

Aplicația nu dă sfaturi medicale. Lista de exerciții nu a fost încă verificată de kinetoterapeut.

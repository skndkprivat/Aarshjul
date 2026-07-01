# Opsætning på GitHub – trin for trin

Denne guide viser hvordan du lægger Årshjul-løsningen på GitHub og gør den tilgængelig som en live-side via **GitHub Pages** (samme metode som du allerede bruger til Form-Tracker).

Alle filer i løsningen ligger **fladt** (ingen undermapper) — det er bevidst, så almindelig "træk filer ind"-upload på GitHub altid virker, uden risiko for at mistede undermapper ødelægger stierne.

## ⚠️ Om synlighed (gratis = public repository)

- **GitHub Pages er kun gratis fra et *public* repository.** Et privat repo med Pages kræver GitHub Pro/Team/Enterprise.
- Det ændrer reelt intet ved sikkerheden: **den udgivne side er altid offentligt tilgængelig**, uanset repo-synlighed – kunderne skal jo netop kunne tilgå den. Et privat repo ville kun have skjult kildekoden, ikke selve JSON-filerne med de hashede adgangskoder, som browseren henter hver gang nogen logger ind.
- **Brug derfor et public repository.** Se README.da.md under "Sikkerhed" for de fulde detaljer.

## 1. Opret et nyt repository

1. Gå til [github.com/new](https://github.com/new)
2. **Repository name:** fx `aarshjul` (eller `hcs-aarshjul` hvis det kun er til HCS)
3. Vælg **Public**
4. Opret **uden** README/gitignore (I uploader jeres egne filer) → klik **Create repository**

## 2. Upload filerne

### Mulighed A – via browseren (det du allerede har gjort)

1. På repo-siden: klik **"uploading an existing file"** (eller **Add file → Upload files** hvis repoet allerede har indhold)
2. Træk **alle filerne enkeltvis** ind (ikke en mappe) — altså: `index.html`, `app.js`, `hash-generator.html`, `customers.json`, `admin-users.json`, `hcs-users.json`, `hcs-2026.json`, `README.da.md`, `README.en.md`
   - Da alt ligger fladt, er der intet mappehierarki der kan gå tabt undervejs — det var netop det, der gik galt sidst.
3. Skriv en commit-besked, fx "Ret filstruktur til fladt layout"
4. Klik **Commit changes**

**Har du allerede en tidligere version liggende (med manglende filer)?** Upload blot de nye/rettede filer oven i – de erstatter automatisk dem med samme navn. Du behøver ikke slette repoet.

### Mulighed B – via git (terminal), som du kender fra dine andre projekter

```bash
cd sti/til/aarshjul
git init
git add .
git commit -m "Første version af årshjul"
git branch -M main
git remote add origin https://github.com/<dit-brugernavn>/aarshjul.git
git push -u origin main
```

## 3. Aktivér GitHub Pages

1. I repoet: gå til **Settings → Pages**
2. Under **Build and deployment**:
   - **Source:** "Deploy from a branch"
   - **Branch:** `main`, mappe: `/ (root)`
3. Klik **Save**
4. Vent 1-2 minutter — GitHub viser derefter URL'en øverst, typisk:
   ```
   https://<dit-brugernavn>.github.io/aarshjul/
   ```

## 4. Test at det virker

1. Åbn URL'en fra trin 3
2. Du bør se **"Vælg kunde"**-skærmen med Holbæk Cykelsport
3. Log ind med demo-kontoen `formand` / `hcs2026admin` og tjek at hjulet vises
4. **Skift adgangskoderne** med det samme (se README.da.md, afsnit "Administrere brugere")

## 5. Fremtidige opdateringer (nye aktiviteter, nye kunder, nye år)

Når du redigerer aktiviteter i selve appen, gemmes ændringerne kun i browseren. For at gøre dem permanente:

1. Klik **"Eksportér JSON"** i appen → filen downloades til din computer (fx `hcs-2026.json`)
2. Upload/commit filen til roden af repoet på GitHub – den erstatter automatisk den gamle:
   - **Browser:** **Add file → Upload files** → træk filen ind → **Commit changes**
   - **Git:**
     ```bash
     git add hcs-2026.json
     git commit -m "Opdaterede aktiviteter for HCS 2026"
     git push
     ```
3. GitHub Pages opdaterer automatisk siden inden for typisk 30-60 sekunder efter push/commit

## 6. Tilføje en ny kunde eller nyt år

Følg trinene i README.da.md ("Tilføje en ny kunde" / "Tilføje et nyt år"), og upload de nye/ændrede filer til roden som beskrevet ovenfor.

## Fejlfinding

| Problem | Løsning |
|---|---|
| "Kunne ikke indlæse kundeliste" på siden | Tjek at `customers.json` faktisk ligger i roden af repoet (samme niveau som `index.html`) — brug **Code**-fanen på GitHub til at se filoversigten |
| Siden viser 404 | Tjek at Pages-kilden er sat til `main` / root, og at `index.html` ligger i roden af repoet (ikke i en undermappe) |
| Filer havnede i en undermappe ved upload | Slet undermappen på GitHub, og upload filerne igen én for én (ikke som en mappe) |
| Kan ikke logge ind på live-siden | Åbn browserens udviklerkonsol (F12) → fanen "Network" → tjek om `{kunde-id}-users.json` giver 200 eller 404 |
| Ændringer vises ikke efter upload | Vent et minut, og tjek fanen **Actions** i repoet for at se om "pages build and deployment" er færdig |
| Vil bruge eget domæne | Settings → Pages → "Custom domain" – kræver en CNAME-post hos jeres DNS-udbyder |

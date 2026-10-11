# Opsætning på GitHub – trin for trin

Denne guide viser, hvordan HCS Årshjul ligger på GitHub og er tilgængelig som en live-side via **GitHub Pages**. Den kan også bruges, hvis du skal sætte det op igen fra bunden.

Nu: repoet er `skndkprivat/Aarshjul`, og siden ligger på `https://skndkprivat.github.io/Aarshjul/`.

Alle filer ligger **fladt** (ingen undermapper), så almindelig "træk filer ind"-upload på GitHub altid virker.

## ⚠️ Om synlighed (gratis = public repository)

- **GitHub Pages er kun gratis fra et *public* repository.** Et privat repo med Pages kræver GitHub Pro/Team/Enterprise.
- Det ændrer ikke noget ved sikkerheden: den udgivne side er altid offentlig. Et privat repo ville kun skjule kildekoden, ikke JSON-filerne, som browseren henter.
- **Brug derfor et public repository.** Se README.da.md under "Sikkerhed".

## 1. Opret et nyt repository

1. Gå til [github.com/new](https://github.com/new).
2. **Repository name:** fx `Aarshjul`.
3. Vælg **Public**.
4. Opret **uden** README/gitignore, og klik **Create repository**.

## 2. Upload filerne

Filerne i repoet er:

`index.html`, `app.js`, `hash-generator.html`, `customers.json`, `admin-users.json`, `hcs-users.json`, `hcs-2026.json` (og én fil pr. år), `publicer.bat`, `README.da.md`, `README.en.md`, `GITHUB-SETUP.da.md`, `GITHUB-SETUP.en.md`

### Mulighed A – via browseren

1. Klik **Add file → Upload files** på repo-siden.
2. Træk **filerne enkeltvis** ind (ikke en mappe).
3. Skriv en commit-besked, og klik **Commit changes**.

Upload af en fil med samme navn erstatter automatisk den gamle.

### Mulighed B – via git

```bash
cd sti/til/Aarshjul
git init
git add .
git commit -m "Første version af årshjul"
git branch -M main
git remote add origin https://github.com/<dit-brugernavn>/Aarshjul.git
git push -u origin main
```

## 3. Aktivér GitHub Pages

1. I repoet: **Settings → Pages**.
2. Under **Build and deployment**: **Source** = "Deploy from a branch", **Branch** = `main`, mappe `/ (root)`.
3. Klik **Save**.
4. Efter 1-2 minutter viser GitHub adressen øverst, typisk `https://<dit-brugernavn>.github.io/Aarshjul/`.

## 4. Test at det virker

1. Åbn adressen fra trin 3. Du skal se årshjulet med alle måneder uden at logge ind.
2. Klik **Login**, og log ind med en admin-konto, du selv har lavet (se README.da.md, "Administrere brugere").
3. Tjek, at redigeringspanelet kommer frem.

## 5. Sæt årshjulet ind på hjemmesiden

I en tekstblok på siden, hvor hjulet skal vises, indsættes:

```html
<p><iframe src="https://skndkprivat.github.io/Aarshjul/" width="100%" height="1500" frameborder="0" scrolling="yes" style="border:0;max-width:1200px;display:block;margin:0 auto;"></iframe></p>
```

Ret adressen, hvis dit brugernavn eller repo-navn er et andet.

## 6. Fremtidige opdateringer

Ændringer i appen gemmes først, når de udgives. Den nemmeste måde er knappen **"Udgiv til GitHub"** i redigeringspanelet:

1. Opret et fine-grained GitHub-token til repoet med **Contents: Read and write** (se README.da.md, "Udgive ændringer").
2. Ret aktiviteterne i appen, og klik **"Udgiv til GitHub"**. Første gang beder appen om tokenet.
3. Siden opdateres for alle efter cirka et minut. Du behøver hverken download, upload eller git.

Hvis du ikke har et token, kan du klikke **"Download JSON"** og uploade filen på GitHub (**Add file → Upload files**, samme filnavn), eller lægge den i mappen og køre `publicer.bat`. Kør `git pull` først, hvis nogen har udgivet imens.

Nye år oprettes med knappen **"Tilføj nyt år"**. Den laver årsfilen og opdaterer `customers.json`.

## Fejlfinding

| Problem | Løsning |
|---|---|
| Siden er tom, eller årsvælgeren er tom | Tryk Ctrl+F5. Tjek, at `customers.json` ligger i roden af repoet (samme niveau som `index.html`) |
| Siden viser 404 | Tjek, at Pages-kilden er `main` / root, og at `index.html` ligger i roden, ikke i en undermappe |
| Filer havnede i en undermappe ved upload | Slet undermappen på GitHub, og upload filerne igen én for én |
| Kan ikke logge ind | Åbn udviklerkonsollen (F12) → fanen "Network", og tjek, om `hcs-users.json` giver 200 eller 404 |
| Ændringer vises ikke efter udgivelse | Vent et minut, tryk Ctrl+F5, og tjek fanen **Actions** i repoet, om "pages build and deployment" er færdig |
| "Udgiv til GitHub" giver fejl | Se fejlfindingstabellen i README.da.md (token ugyldigt, ingen skriveadgang m.m.) |
| Iframen er tom på hjemmesiden | Tjek adressen i `src`, og at siden åbner direkte i en browserfane |
| Vil bruge eget domæne | Settings → Pages → "Custom domain" – kræver en CNAME-post hos DNS-udbyderen |

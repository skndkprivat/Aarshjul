# HCS Årshjul

En statisk web-app, der viser et "årshjul" (cirkulær aktivitetskalender) for Holbæk Cykelsport. Hjulet er offentligt og kræver ikke login. Admins kan logge ind, rette aktiviteterne og udgive ændringerne direkte til GitHub fra browseren. Der er ingen backend, og siden hostes på GitHub Pages: `https://skndkprivat.github.io/Aarshjul/`

Siden er indlejret på hjemmesiden med en `<iframe>`:

```html
<p><iframe src="https://skndkprivat.github.io/Aarshjul/" width="100%" height="1500" frameborder="0" scrolling="yes" style="border:0;max-width:1200px;display:block;margin:0 auto;"></iframe></p>
```

## Filstruktur

Alle filer ligger fladt i samme mappe.

```
/
├── index.html              ← siden og udseendet
├── app.js                  ← al logik (visning, login, redigering, udgivelse)
├── customers.json          ← kunde (navn, årstal)
├── hcs-users.json          ← admin-brugere for "hcs" (kun hash, aldrig klartekst)
├── admin-users.json        ← globale brugere, der kan logge ind på alle kunder (tom)
├── hcs-2026.json           ← aktiviteter for 2026
├── hcs-2027.json …         ← ét års-fil pr. år
├── hash-generator.html     ← lokalt værktøj til at oprette nye brugere
└── publicer.bat            ← reserve: udgiv via git fra Windows
```

Navngivning: `{kunde-id}-{årstal}.json` og `{kunde-id}-users.json`, hvor `{kunde-id}` matcher `id` i `customers.json`. Appen åbner den første kunde i `customers.json`. Med `?kunde=id` i adressen kan den åbne en anden.

## Sådan virker det

1. **Alle** kan se hjulet. Klik på en måned eller en aktivitet for at se detaljer, og hent en kalenderfil (`.ics`) for aktiviteter med dato.
2. **Årsvælgeren** øverst viser de år, der står i `customers.json`. Appen åbner på indeværende år.
3. **Admins** klikker "Login" og får et redigeringspanel, hvor de kan tilføje, rette og slette aktiviteter.
4. Ændringer gemmes først, når du klikker **"Udgiv til GitHub"** (se nedenfor).

## Udgive ændringer

### Anbefalet: "Udgiv til GitHub"

Knappen gemmer årsfilen direkte i repoet som en commit. Siden opdateres for alle efter cirka et minut. Det kræver et GitHub-token.

**Opret et token (én gang pr. person og pc):**
1. GitHub → Settings → Developer settings → Personal access tokens → **Fine-grained tokens** → Generate new token.
2. Vælg **Only select repositories** og dernæst `Aarshjul`.
3. Under Repository permissions skal **Contents** være **Read and write**. Sæt en udløbsdato.
4. Kopiér tokenet. Første gang du klikker "Udgiv til GitHub", spørger appen efter det. Du kan vælge "Husk på denne pc". Knappen "🔑 GitHub-token" ændrer eller fjerner det igen.

Den, der skal udgive, skal have skriveadgang til repoet. Inviter personen som collaborator under repoets Settings → Collaborators, og lad dem lave deres eget token. Del helst ikke ét token. Del det aldrig via mail eller chat.

**Tilføj nyt år:** Klik "Tilføj nyt år" og skriv årstallet. Appen opretter årsfilen og opdaterer `customers.json` i samme omgang.

### Reserve: download og upload

Hvis du ikke har et token, kan du klikke **"Download JSON"** og gemme filen med præcis samme navn som den eksisterende (fx `hcs-2026.json`). Derefter:
- Gå til `https://github.com/skndkprivat/Aarshjul` → **Add file → Upload files**, træk filen ind og klik **Commit changes**, eller
- Læg den i den lokale mappe og dobbeltklik på `publicer.bat`. Kør `git pull` først, hvis andre har udgivet imens.

## Administrere brugere

Login styrer kun, hvem der ser redigeringspanelet. Brugerne ligger som saltet hash i `hcs-users.json`.

1. Åbn `hash-generator.html` lokalt i din browser (dobbeltklik).
2. Skriv brugernavn og adgangskode, vælg rollen **admin**, og klik "Generér". Adgangskoden forlader aldrig din browser.
3. Kopiér JSON-objektet ind i `users`-listen i `hcs-users.json`, og udgiv filen (upload på GitHub, eller `publicer.bat`).

Roller: `admin` kan redigere. `superadmin` i `admin-users.json` kan redigere for alle kunder. `viewer` har ikke brug for login, for hjulet er offentligt.

Brug lange adgangskoder, for hashene ligger i en offentlig fil.

## Sikkerhed

- Adgangskoder står aldrig i klartekst, kun som saltet SHA-256-hash. Efter 5 forkerte forsøg låses en konto i 60 sekunder, og sessionen udløber efter 30 minutters inaktivitet.
- Aktivitetstekster vises som ren tekst, så de ikke kan indsætte kode (XSS).
- **Den reelle beskyttelse er GitHub-tokenet.** Kun den, der har et token med skriveadgang, kan ændre filerne. Login på siden er en bekvemmelighed, der skjuler panelet, men kan ikke stoppe en teknisk bruger, der selv forfalsker visningen i browseren. Tokenet gemmes i browseren (`sessionStorage`, eller `localStorage` hvis du vælger "Husk"). Brug derfor kun et token med Contents-adgang til dette ene repo, og slet det på GitHub, hvis det kommer på afveje.
- Repoet er offentligt, så al indhold, inklusive hashene, er synligt for alle. Løsningen passer til en klubs årshjul, men ikke til følsomme data.

## Fejlfinding

| Problem | Løsning |
|---|---|
| Siden er tom eller årsvælgeren er tom | Tryk Ctrl+F5. Hvis du åbner filen som `file://`, så brug i stedet GitHub Pages eller `npx serve .` |
| Kan ikke logge ind | Tjek brugernavn og adgangskode, og at brugeren findes i `hcs-users.json`. En låst konto kan prøve igen efter 60 sekunder |
| "Tokenet er ugyldigt eller udløbet" | Opret et nyt token (se ovenfor), og indsæt det via "🔑 GitHub-token" |
| "Tokenet har ikke skriveadgang" | Tokenet skal være valgt til repoet `Aarshjul` med **Contents: Read and write**, og kontoen skal have adgang til repoet |
| "Filen blev ændret af en anden samtidig" | Genindlæs siden, og prøv igen |
| Ændringer forsvinder, når siden genindlæses | De er ikke udgivet. Klik "Udgiv til GitHub" |
| Udgivet ændring ses ikke | Vent cirka et minut, og tryk Ctrl+F5 |
| `git push` afvises | Kør `git pull` først, for der er udgivet en nyere version |

# Årshjul – multi-kunde løsning

En statisk web-app til at vise og redigere et "årshjul" (cirkulær aktivitetskalender) for flere kunder, med kundevalg, årstalsskift og login pr. kunde. Bygget som ren HTML/JS/CSS uden backend, så den kan hostes hvor som helst (fx GitHub Pages, som du allerede bruger til Form-Tracker).

## Mappestruktur

```
/
├── index.html              ← selve appen
├── app.js                  ← al logik
├── tools/
│   └── hash-generator.html ← lokalt værktøj til at oprette nye brugere
└── data/
    ├── customers.json      ← offentlig liste over kunder (navn, farve, årstal)
    ├── admin-users.json    ← globale superadmin-brugere (adgang til alle kunder)
    └── {kunde-id}/
        ├── users.json      ← brugere for denne kunde (kun hash, aldrig klartekst)
        └── years/
            └── {årstal}.json ← aktiviteter for det pågældende år
```

## ⚠️ Vigtigt: Kør via en webserver, ikke som fil

Fordi data hentes med `fetch()` fra JSON-filer, virker appen **ikke** hvis du blot dobbeltklikker på `index.html`. Den skal serveres via http/https – fx:

- Upload til GitHub Pages (samme metode som Form-Tracker)
- Eller kør lokalt: `npx serve .` i mappen, og åbn den viste `http://localhost`-adresse

## Kom i gang – demo-login

Der er oprettet tre demo-brugere til afprøvning:

| Kunde | Brugernavn | Adgangskode | Rolle |
|---|---|---|---|
| Holbæk Cykelsport | `formand` | `hcs2026admin` | Admin (kan redigere) |
| Holbæk Cykelsport | `medlem` | `hcs2026` | Læser (kun visning) |
| (global) | `soren` | `ChangeMe!2026` | Superadmin (alle kunder) |

**Skift disse adgangskoder før produktion** – se afsnittet om brugere nedenfor.

> **Bemærk om datagrundlag:** Jeg havde kun delvis adgang til jeres oprindelige 25 aktiviteter fra den anden samtale (januar–marts er indtastet). Resten af årets aktiviteter skal tilføjes via admin-panelet eller ved at redigere `data/hcs/years/2026.json` direkte.

## Hvordan det virker

1. **Vælg kunde** – forsiden viser en liste over kunder fra `data/customers.json`.
2. **Log ind** – med brugernavn/adgangskode knyttet til den valgte kunde (eller en global superadmin-konto).
3. **Se årshjulet** – cirkulært hjul med 12 måneder, farvet efter kundens temafarve. Klik en måned for at folde aktiviteterne ud i listen til højre.
4. **Skift år** – dropdown øverst viser de årstal, der er registreret for kunden.
5. **Rediger (kun admin/superadmin)** – tilføj, redigér og slet aktiviteter. Download `.ics`-kalenderfil pr. aktivitet med dato.

## Gemme ændringer permanent

Da løsningen er ren statisk HTML uden backend, gemmes redigeringer kun i browseren, indtil de eksporteres:

1. Klik **"Eksportér JSON"** i toppen efter redigering.
2. Upload den downloadede fil til `data/{kunde-id}/years/{årstal}.json` på serveren/GitHub-repoet – erstat den eksisterende fil.

## Administrere brugere

Der er **ingen backend**, så brugere kan ikke oprettes direkte i appen. I stedet:

1. Åbn `tools/hash-generator.html` lokalt i din browser.
2. Indtast brugernavn, adgangskode og rolle (`admin`, `viewer` eller `superadmin`).
3. Værktøjet genererer et JSON-objekt med et tilfældigt "salt" og en SHA-256 hash – **adgangskoden i klartekst forlader aldrig din browser**.
4. Indsæt objektet i den rigtige `users.json` (kunde-specifik) eller `admin-users.json` (global), og upload filen.

Roller:
- `viewer` – kan se årshjulet og downloade kalenderfiler, men ikke redigere.
- `admin` – kan derudover tilføje/redigere/slette aktiviteter og år for **egen** kunde.
- `superadmin` – kan logge ind på **alle** kunder uden kunde-specifik konto (bruges typisk af dig som konsulent).

## Tilføje en ny kunde

1. Opret en ny mappe under `data/`, fx `data/vattenfall/`.
2. Opret `data/vattenfall/users.json` (brug hash-generatoren) og `data/vattenfall/years/2026.json` (tom aktivitetsliste, se skabelon i `data/hcs/years/2026.json`).
3. Tilføj kunden til `data/customers.json`:
   ```json
   { "id": "vattenfall", "name": "Vattenfall DE", "shortName": "VF", "accent": "#1B3B6F", "years": ["2026"] }
   ```
4. Upload de nye/ændrede filer.

Superadmin-brugere (som `soren`) har automatisk adgang til den nye kunde uden yderligere opsætning.

## Tilføje et nyt år for en eksisterende kunde

Log ind som admin/superadmin → klik **"År"** i toppen → indtast årstal. Appen genererer to filer til download:
- `{årstal}.json` – uploades til `data/{kunde-id}/years/`
- opdateret `customers.json` – erstatter den eksisterende på serveren

## Sikkerhed – hvad er "robust", og hvad er de reelle begrænsninger

Løsningen er markant mere robust end den oprindelige version (fælles klartekst-adgangskode i selve HTML-filen):

- **Adgangskoder gemmes aldrig i klartekst** – kun som SHA-256 hash med individuelt salt.
- **Login-forsøg begrænses**: efter 5 forkerte forsøg låses en konto i 60 sekunder, og hvert forsøg giver stigende forsinkelse (beskytter mod automatiserede angreb).
- **Sessioner udløber automatisk** efter 30 minutters inaktivitet.
- **Adskilte brugere og roller pr. kunde**, i stedet for én fælles kode for alle.
- Data renses for HTML ved visning, så aktivitetstekster ikke kan bruges til at indsætte skadelig kode (XSS).

**Den ærlige begrænsning:** Fordi appen kører 100% i browseren uden server, kan en teknisk bruger med udviklerværktøjer i princippet se de hashede adgangskoder, når siden henter `users.json`. Det er ikke muligt at opnå ægte serverside-sikkerhed uden en backend. Denne løsning er derfor velegnet til **intern brug med lav-til-moderat følsomhed** (fx en klubs årshjul), men **ikke** til data, der kræver egentlig adgangskontrol (fx personfølsomme data eller forretningskritiske hemmeligheder). Hvis det bliver nødvendigt senere, er det næste skridt at flytte login og databeskyttelse til en Node.js-backend (samme mønster som du allerede bruger i ArchyGUI/Form-Tracker), hvor adgangskoder tjekkes server-side, og data slet ikke sendes til browseren før login er verificeret.

## Tilpasning

- **Farver:** ret `accent`-feltet pr. kunde i `data/customers.json`. Månedsfarverne i hjulet genereres automatisk som nuancer af denne farve.
- **Skrifttyper:** Space Grotesk (overskrifter) + Inter (brødtekst), indlæses fra Google Fonts i `index.html`.
- **Sprog:** dansk/engelsk-knap øverst til højre skifter al UI-tekst. Måneder oversættes automatisk.

## Fejlfinding

| Problem | Løsning |
|---|---|
| Siden viser "Kunne ikke indlæse kundeliste" | Du åbner filen direkte (`file://`) – kør den via en webserver i stedet |
| Kan ikke logge ind | Tjek brugernavn/kodeord, og at kontoen findes i den rigtige `users.json` |
| Konto er låst | Vent 60 sekunder, eller ryd `sessionStorage` i browseren |
| Ændringer forsvinder efter genindlæsning | Husk at eksportere JSON og uploade den til serveren – intet gemmes automatisk |
| Nyt år/ny kunde vises ikke | Tjek at `customers.json` er opdateret og uploadet korrekt |

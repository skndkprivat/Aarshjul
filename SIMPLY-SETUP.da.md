# Årshjulet på simply.com – installation

Serverversionen ligger i mappen `simply/`. Den kører på dit simply.com-webhotel (PHP 8.5, testet lokalt på 8.5.11) som `https://aarshjul.holbaek-cykelsport.dk/`. Hjulet er offentligt, admins logger ind, og alle rettelser gemmes med det samme på serveren. Der kræves hverken GitHub, token eller download og upload.

GitHub Pages-versionen i roden af repoet røres ikke og kan bruges som reserve, indtil du er tryg ved den nye.

## 1. DNS (undernavn)

I simply.com → DNS-administration for `holbaek-cykelsport.dk`:

1. Tilføj en **A-record**: navn `aarshjul`, peger på `93.191.156.189` (den adresse, simply viser).
2. **Rør ikke ved de to eksisterende poster** for `holbaek-cykelsport.dk` og `www.`. De peger på Zakobo, hvor hjemmesiden ligger, og skal blive der.
3. Vent, til navnet virker (typisk få minutter, op til nogle timer).

Undernavnet skal også findes som host på webhotellet med sin egen mappe. Det har du allerede oprettet.

## 2. HTTPS

Under **HTTPS beskyttelse** aktiverer du Let's Encrypt for `aarshjul.holbaek-cykelsport.dk`, og først når DNS virker. Aktiver det **ikke** for `holbaek-cykelsport.dk` selv. Slå derefter **"Tving HTTPS"** til for undernavnet, så login-cookien kun sendes krypteret.

## 3. Upload filerne

Upload **indholdet** af mappen `simply/` til undernavnets mappe med SFTP (fx FileZilla) eller simplys filhåndtering:

```
index.html   app.js   api.php   setup.php   .htaccess   config.sample.php
vendor/      seed/
```

Husk, at `.htaccess` er en skjult fil. Den skal med. Lad være med at lægge noget i en mappe der hedder `data`, det laver opsætningen selv.

## 4. Lav konfigurationen

På serveren kopierer du `config.sample.php` til `config.php` og retter den:

- **`setup_token`**: en lang, tilfældig tekst på mindst 16 tegn. Du bruger den kun én gang i trin 5.
- **`data_dir`**: hvor data ligger. Det bedste er en mappe **uden for** den offentlige webmappe, fx `__DIR__ . '/../aarshjul-data'`, hvis du kan skrive i mappen ovenover. Ellers lad den stå som `__DIR__ . '/data'`. Så beskytter en `.htaccess` mod direkte adgang.
- **`session_minutes`** kan stå som den er.

## 5. Opret første admin

1. Åbn `https://aarshjul.holbaek-cykelsport.dk/setup.php`.
2. Skriv opsætningskoden, et brugernavn og en adgangskode på mindst 10 tegn.
3. Siden opretter datamappen, lægger startdata ind (de aktiviteter, der lå i `seed/`) og laver admin-brugeren.
4. **Slet `setup.php` fra serveren.**

## 6. Tjek at det virker og er sikkert

- Hjulet vises uden login, med alle måneder og aktiviteter.
- Log ind, tilføj en aktivitet, og genindlæs siden. Aktiviteten skal stadig være der. Slet den igen.
- Hvis datamappen ligger i webmappen: `https://aarshjul.holbaek-cykelsport.dk/data/users.json` skal give **403 Forbudt**. Får du indholdet at se, så flyt `data_dir` uden for webmappen med det samme.
- `https://aarshjul.holbaek-cykelsport.dk/config.php` må ikke vise noget.

## 7. Byt iframen på hjemmesiden

```html
<p><iframe src="https://aarshjul.holbaek-cykelsport.dk/" width="100%" height="1500" frameborder="0" scrolling="yes" style="border:0;max-width:1200px;display:block;margin:0 auto;"></iframe></p>
```

Da undernavnet ligger under samme domæne som hjemmesiden, virker login også inde i iframen.

## Daglig brug

- Admins retter i panelet, og hver rettelse gemmes med det samme. Hvis to retter samtidig, advares den sidste, og de nyeste data hentes.
- **Historik** viser de seneste versioner, før hver rettelse, og **Gendan** lægger en version tilbage.
- **Brugere og adgangskode** lader en admin oprette og slette brugere og skifte sin egen adgangskode. Det er ikke nødvendigt at kende noget til GitHub eller hash.
- **Tilføj nyt år** laver en tom årsfil og tilføjer året i listen.
- **Download backup** henter det aktuelle år som en JSON-fil.

## Backup

Alt ligger i datamappen: `customers.json`, `hcs-ÅÅÅÅ.json`, `users.json` og `history/`. Hent mappen med SFTP en gang imellem, eller sæt et cron-job op, hvis dit abonnement har det, der kopierer mappen til et sikkert sted.

## Opdatere appen senere

Upload de ændrede filer, men **overskriv aldrig `config.php` eller datamappen**. Upload ikke `seed/` igen, hvis det kan undgås, for det kan kun bruges ved første opsætning.

## Det du skal vide om sikkerheden

- Adgangskoder gemmes som bcrypt-hash (`password_hash`) i `users.json`, som ikke kan hentes udefra.
- Efter 5 forkerte forsøg låses et brugernavn fra samme adresse i 5 minutter. Sessionen udløber efter 30 minutters inaktivitet.
- Alle ændringer kræver login og en sikkerhedskode (CSRF), og serveren validerer alle data, så ingen kan gemme vilkårlig kode.
- `.htaccess` begrænser, hvilke sider der må vise hjulet i en iframe, til din hjemmeside, og kun egne scripts må køre. Det virker kun, hvis webhotellet har `mod_headers` slået til, hvilket det normalt har.
- Der er ikke noget i den offentlige kode, der er hemmeligt. Alt ligger på serveren.

## Fejlfinding

| Problem | Løsning |
|---|---|
| "Serveren er ikke sat op (config.php mangler)" | Lav `config.php` ud fra `config.sample.php` (trin 4) |
| Siden er tom | Tryk Ctrl+F5. Åbn `/api.php?action=customers`. Du skal se en JSON-liste. Er listen tom, er opsætningen ikke kørt |
| 500-fejl på `api.php` | Tjek simplys fejllog. Typisk skriverettigheder til datamappen eller en forkert sti i `data_dir` |
| Kan ikke logge ind i iframen | Tjek, at siden bruger HTTPS, og at iframen peger på undernavnet under samme domæne |
| "For mange forsøg" | Vent 5 minutter. Slet evt. `attempts.json` i datamappen |
| Glemt adgangskode | Slet `users.json` i datamappen, upload `setup.php` igen, og kør opsætningen. Data og historik bevares |
| Hjulet kan ikke vises i iframen | Adressen under `frame-ancestors` i `.htaccess` skal være hjemmesidens, nøjagtigt med `https://` |

# HCS Year Wheel

A static web app that shows a "year wheel" (circular activity calendar) for Holbæk Cykelsport. The wheel is public and needs no login. Admins can log in, edit the activities, and publish the changes straight to GitHub from the browser. There is no backend, and the site is hosted on GitHub Pages: `https://skndkprivat.github.io/Aarshjul/`

The page is embedded on the club's website with an `<iframe>`:

```html
<p><iframe src="https://skndkprivat.github.io/Aarshjul/" width="100%" height="1500" frameborder="0" scrolling="yes" style="border:0;max-width:1200px;display:block;margin:0 auto;"></iframe></p>
```

## File structure

All files sit flat in the same folder.

```
/
├── index.html              ← the page and its look
├── app.js                  ← all logic (display, login, editing, publishing)
├── customers.json          ← customer (name, years)
├── hcs-users.json          ← admin users for "hcs" (hash only, never plaintext)
├── admin-users.json        ← global users who can log in to any customer (empty)
├── hcs-2026.json           ← activities for 2026
├── hcs-2027.json …         ← one file per year
├── hash-generator.html     ← local tool for creating new users
└── publicer.bat            ← fallback: publish with git from Windows
```

Naming: `{customer-id}-{year}.json` and `{customer-id}-users.json`, where `{customer-id}` matches `id` in `customers.json`. The app opens the first customer in `customers.json`. Add `?kunde=id` to the address to open another.

## How it works

1. **Anyone** can view the wheel. Click a month or an activity for details, and download a calendar file (`.ics`) for activities with a date.
2. **The year selector** at the top lists the years in `customers.json`. The app opens on the current year.
3. **Admins** click "Login" and get an editing panel to add, edit, and delete activities.
4. Changes are only saved when you click **"Udgiv til GitHub"** (publish to GitHub, see below).

## Publishing changes

### Recommended: "Udgiv til GitHub"

The button saves the year file straight into the repo as a commit. The site updates for everyone after about a minute. It needs a GitHub token.

**Create a token (once per person and PC):**
1. GitHub → Settings → Developer settings → Personal access tokens → **Fine-grained tokens** → Generate new token.
2. Choose **Only select repositories**, then `Aarshjul`.
3. Under Repository permissions set **Contents** to **Read and write**. Set an expiry date.
4. Copy the token. The first time you click "Udgiv til GitHub" the app asks for it. You can choose to remember it on this PC. The "🔑 GitHub-token" button changes or removes it later.

Anyone who publishes needs write access to the repo. Invite them as a collaborator under the repo's Settings → Collaborators, and have them create their own token. Avoid sharing one token, and never send it by email or chat.

**Add a new year:** Click "Tilføj nyt år" and enter the year. The app creates the year file and updates `customers.json` in one go.

### Fallback: download and upload

Without a token, click **"Download JSON"** and save the file under exactly the same name as the existing one (e.g. `hcs-2026.json`). Then either:
- Go to `https://github.com/skndkprivat/Aarshjul` → **Add file → Upload files**, drag the file in, and click **Commit changes**, or
- Put it in the local folder and double-click `publicer.bat`. Run `git pull` first if others have published in the meantime.

## Managing users

Login only controls who sees the editing panel. Users are stored as salted hashes in `hcs-users.json`.

1. Open `hash-generator.html` locally in your browser (double-click).
2. Enter a username and password, pick the role **admin**, and click "Generér". The password never leaves your browser.
3. Copy the JSON object into the `users` list in `hcs-users.json`, and publish the file (upload on GitHub, or `publicer.bat`).

Roles: `admin` can edit. `superadmin` in `admin-users.json` can edit for all customers. `viewer` needs no login, since the wheel is public.

Use long passwords, since the hashes sit in a public file.

## Security

- Passwords are never stored in plaintext, only as salted SHA-256 hashes. After 5 wrong attempts an account is locked for 60 seconds, and sessions expire after 30 minutes of inactivity.
- Activity text is shown as plain text, so it can't inject code (XSS).
- **The real protection is the GitHub token.** Only someone with a token that has write access can change the files. The login on the page is a convenience that hides the panel, but it can't stop a technical user who fakes the view in their own browser. The token is stored in the browser (`sessionStorage`, or `localStorage` if you choose "Remember"). Use a token with Contents access to this one repo only, and delete it on GitHub if it ends up in the wrong hands.
- The repo is public, so all content, including the hashes, is visible to everyone. The solution suits a club's year wheel, but not sensitive data.

## Troubleshooting

| Problem | Solution |
|---|---|
| The page or the year selector is empty | Press Ctrl+F5. If you open the file as `file://`, use GitHub Pages or `npx serve .` instead |
| Can't log in | Check the username and password, and that the user exists in `hcs-users.json`. A locked account can try again after 60 seconds |
| "Tokenet er ugyldigt eller udløbet" (token invalid or expired) | Create a new token (see above) and enter it via "🔑 GitHub-token" |
| "Tokenet har ikke skriveadgang" (no write access) | The token must be selected for the `Aarshjul` repo with **Contents: Read and write**, and the account must have access to the repo |
| "Filen blev ændret af en anden samtidig" (file changed concurrently) | Reload the page and try again |
| Changes disappear when the page reloads | They weren't published. Click "Udgiv til GitHub" |
| A published change doesn't show | Wait about a minute and press Ctrl+F5 |
| `git push` is rejected | Run `git pull` first, because a newer version has been published |

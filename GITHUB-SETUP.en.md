# GitHub setup – step by step

This guide shows how the HCS Year Wheel sits on GitHub and is available as a live site via **GitHub Pages**. You can also use it to set everything up again from scratch.

Currently: the repo is `skndkprivat/Aarshjul`, and the site is at `https://skndkprivat.github.io/Aarshjul/`.

All files sit **flat** (no subfolders), so a plain "drag files in" upload on GitHub always works.

## ⚠️ On visibility (free = public repository)

- **GitHub Pages is only free from a *public* repository.** A private repo with Pages requires GitHub Pro/Team/Enterprise.
- This doesn't change security: the published site is always public. A private repo would only hide the source code, not the JSON files the browser fetches.
- **So use a public repository.** See README.en.md, "Security".

## 1. Create a new repository

1. Go to [github.com/new](https://github.com/new).
2. **Repository name:** e.g. `Aarshjul`.
3. Choose **Public**.
4. Create it **without** a README/gitignore, and click **Create repository**.

## 2. Upload the files

The files in the repo are:

`index.html`, `app.js`, `hash-generator.html`, `customers.json`, `admin-users.json`, `hcs-users.json`, `hcs-2026.json` (and one file per year), `publicer.bat`, `README.da.md`, `README.en.md`, `GITHUB-SETUP.da.md`, `GITHUB-SETUP.en.md`

### Option A – via the browser

1. Click **Add file → Upload files** on the repo page.
2. Drag the files in **individually** (not a folder).
3. Write a commit message and click **Commit changes**.

Uploading a file with the same name automatically replaces the old one.

### Option B – via git

```bash
cd path/to/Aarshjul
git init
git add .
git commit -m "Initial version of year wheel"
git branch -M main
git remote add origin https://github.com/<your-username>/Aarshjul.git
git push -u origin main
```

## 3. Enable GitHub Pages

1. In the repo: **Settings → Pages**.
2. Under **Build and deployment**: **Source** = "Deploy from a branch", **Branch** = `main`, folder `/ (root)`.
3. Click **Save**.
4. After 1-2 minutes GitHub shows the address at the top, typically `https://<your-username>.github.io/Aarshjul/`.

## 4. Test that it works

1. Open the address from step 3. You should see the year wheel with all months, without logging in.
2. Click **Login** and log in with an admin account you created yourself (see README.en.md, "Managing users").
3. Check that the editing panel appears.

## 5. Put the wheel on the website

In a text block on the page where the wheel should appear, paste:

```html
<p><iframe src="https://skndkprivat.github.io/Aarshjul/" width="100%" height="1500" frameborder="0" scrolling="yes" style="border:0;max-width:1200px;display:block;margin:0 auto;"></iframe></p>
```

Adjust the address if your username or repo name is different.

## 6. Future updates

Changes in the app are only saved once published. The easiest way is the **"Udgiv til GitHub"** (publish to GitHub) button in the editing panel:

1. Create a fine-grained GitHub token for the repo with **Contents: Read and write** (see README.en.md, "Publishing changes").
2. Edit the activities in the app and click **"Udgiv til GitHub"**. The first time, the app asks for the token.
3. The site updates for everyone after about a minute. You don't need a download, an upload, or git.

Without a token, click **"Download JSON"** and upload the file on GitHub (**Add file → Upload files**, same file name), or put it in the folder and run `publicer.bat`. Run `git pull` first if someone has published in the meantime.

New years are created with the **"Tilføj nyt år"** (add new year) button. It creates the year file and updates `customers.json`.

## Troubleshooting

| Problem | Solution |
|---|---|
| The page or the year selector is empty | Press Ctrl+F5. Check that `customers.json` is in the root of the repo (same level as `index.html`) |
| Page shows 404 | Check that the Pages source is `main` / root, and that `index.html` is in the root, not a subfolder |
| Files ended up in a subfolder on upload | Delete the subfolder on GitHub and upload the files again one by one |
| Can't log in | Open the developer console (F12) → "Network" tab, and check whether `hcs-users.json` returns 200 or 404 |
| Changes don't show after publishing | Wait a minute, press Ctrl+F5, and check the **Actions** tab in the repo to see if "pages build and deployment" has finished |
| "Udgiv til GitHub" gives an error | See the troubleshooting table in README.en.md (token invalid, no write access, etc.) |
| The iframe is empty on the website | Check the address in `src`, and that the page opens directly in a browser tab |
| Want to use a custom domain | Settings → Pages → "Custom domain" — requires a CNAME record with your DNS provider |

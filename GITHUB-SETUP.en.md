# GitHub setup – step by step

This guide shows how to put the Year Wheel solution on GitHub and publish it as a live site via **GitHub Pages** (the same approach you already use for Form-Tracker).

All files in this solution sit **flat** (no subfolders) — that's intentional, so that a plain "drag files in" upload on GitHub always works, without the risk of lost subfolders breaking the paths.

## ⚠️ On visibility (free = public repository)

- **GitHub Pages is only free from a *public* repository.** A private repo with Pages requires GitHub Pro/Team/Enterprise.
- This doesn't meaningfully change security: **the published site is always publicly accessible** regardless of repo visibility — customers need to be able to reach it anyway. A private repo would only hide the source code, not the JSON files with hashed passwords, which the browser fetches every time someone logs in.
- **So use a public repository.** See README.en.md, "Security" section, for the full details.

## 1. Create a new repository

1. Go to [github.com/new](https://github.com/new)
2. **Repository name:** e.g. `aarshjul` (or `hcs-aarshjul` if it's only for HCS)
3. Choose **Public**
4. Create it **without** a README/gitignore (you'll upload your own files) → click **Create repository**

## 2. Upload the files

### Option A – via the browser (what you already did)

1. On the repo page: click **"uploading an existing file"** (or **Add file → Upload files** if the repo already has content)
2. Drag **each file individually** in (not a folder) — i.e.: `index.html`, `app.js`, `hash-generator.html`, `customers.json`, `admin-users.json`, `hcs-users.json`, `hcs-2026.json`, `README.da.md`, `README.en.md`
   - Since everything is flat, there's no folder hierarchy that can get lost along the way — that's exactly what went wrong last time.
3. Write a commit message, e.g. "Fix file structure to flat layout"
4. Click **Commit changes**

**Already have a previous version up there (with missing files)?** Just upload the new/fixed files on top — they'll automatically replace the ones with the same name. No need to delete the repo.

### Option B – via git (terminal), like you're used to from your other projects

```bash
cd path/to/aarshjul
git init
git add .
git commit -m "Initial version of year wheel"
git branch -M main
git remote add origin https://github.com/<your-username>/aarshjul.git
git push -u origin main
```

## 3. Enable GitHub Pages

1. In the repo: go to **Settings → Pages**
2. Under **Build and deployment**:
   - **Source:** "Deploy from a branch"
   - **Branch:** `main`, folder: `/ (root)`
3. Click **Save**
4. Wait 1-2 minutes — GitHub will then show the URL at the top, typically:
   ```
   https://<your-username>.github.io/aarshjul/
   ```

## 4. Test that it works

1. Open the URL from step 3
2. You should see the **"Select customer"** screen with Holbæk Cykelsport
3. Log in with the demo account `formand` / `hcs2026admin` and check that the wheel displays
4. **Change the passwords** right away (see README.en.md, "Managing users" section)

## 5. Future updates (new activities, new customers, new years)

When you edit activities in the app itself, changes are only saved in the browser. To make them permanent:

1. Click **"Export JSON"** in the app → the file downloads to your computer (e.g. `hcs-2026.json`)
2. Upload/commit the file to the root of the repo on GitHub — it automatically replaces the old one:
   - **Browser:** **Add file → Upload files** → drag the file in → **Commit changes**
   - **Git:**
     ```bash
     git add hcs-2026.json
     git commit -m "Updated HCS 2026 activities"
     git push
     ```
3. GitHub Pages automatically updates the site, typically within 30-60 seconds of the push/commit

## 6. Adding a new customer or new year

Follow the steps in README.en.md ("Adding a new customer" / "Adding a new year"), and upload the new/changed files to the root as described above.

## Troubleshooting

| Problem | Solution |
|---|---|
| Page shows "Could not load customer list" | Check that `customers.json` is actually in the root of the repo (same level as `index.html`) — use the **Code** tab on GitHub to check the file listing |
| Page shows 404 | Check that the Pages source is set to `main` / root, and that `index.html` is in the repo's root (not a subfolder) |
| Files ended up in a subfolder on upload | Delete the subfolder on GitHub, and upload the files again one by one (not as a folder) |
| Can't log in on the live site | Open the browser's developer console (F12) → "Network" tab → check whether `{customer-id}-users.json` returns 200 or 404 |
| Changes don't show after upload | Wait a minute, and check the **Actions** tab in the repo to see if "pages build and deployment" has finished |
| Want to use a custom domain | Settings → Pages → "Custom domain" — requires a CNAME record with your DNS provider |

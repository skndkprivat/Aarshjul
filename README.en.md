# Year Wheel – multi-customer solution

A static web app that displays and edits a "year wheel" (circular activity calendar) for multiple customers, with customer selection, year switching, and per-customer login. Built as plain HTML/JS/CSS with no backend, so it can be hosted anywhere (e.g. GitHub Pages, which you already use for Form-Tracker).

## Folder structure

```
/
├── index.html              ← the app itself
├── app.js                  ← all logic
├── tools/
│   └── hash-generator.html ← local tool for creating new users
└── data/
    ├── customers.json      ← public list of customers (name, color, years)
    ├── admin-users.json    ← global super admin users (access to all customers)
    └── {customer-id}/
        ├── users.json      ← users for this customer (hash only, never plaintext)
        └── years/
            └── {year}.json ← activities for that year
```

## ⚠️ Important: run via a web server, not as a local file

Because data is loaded with `fetch()` from JSON files, the app will **not** work if you simply double-click `index.html`. It must be served over http/https, e.g.:

- Upload to GitHub Pages (same approach as Form-Tracker)
- Or run locally: `npx serve .` in the folder, then open the shown `http://localhost` address

## Getting started – demo logins

Three demo users are included for testing:

| Customer | Username | Password | Role |
|---|---|---|---|
| Holbæk Cykelsport | `formand` | `hcs2026admin` | Admin (can edit) |
| Holbæk Cykelsport | `medlem` | `hcs2026` | Viewer (read-only) |
| (global) | `soren` | `ChangeMe!2026` | Super admin (all customers) |

**Change these passwords before production use** – see the user management section below.

> **Note on the underlying data:** I only had partial access to your original 25 activities from the other conversation (January–March are filled in). The rest of the year's activities need to be added via the admin panel or by editing `data/hcs/years/2026.json` directly.

## How it works

1. **Select customer** – the landing page lists customers from `data/customers.json`.
2. **Log in** – with a username/password tied to the selected customer (or a global super admin account).
3. **View the wheel** – a circular wheel with 12 months, colored by the customer's theme color. Click a month to expand its activities in the list on the right.
4. **Switch year** – the dropdown at the top shows the years registered for the customer.
5. **Edit (admin/super admin only)** – add, edit, and delete activities. Download a `.ics` calendar file per activity that has a date.

## Saving changes permanently

Since this is plain static HTML with no backend, edits are only kept in the browser until exported:

1. Click **"Export JSON"** at the top after editing.
2. Upload the downloaded file to `data/{customer-id}/years/{year}.json` on the server/GitHub repo, replacing the existing file.

## Managing users

There is **no backend**, so users cannot be created directly inside the app. Instead:

1. Open `tools/hash-generator.html` locally in your browser.
2. Enter a username, password, and role (`admin`, `viewer`, or `superadmin`).
3. The tool generates a JSON object with a random salt and a SHA-256 hash — **the plaintext password never leaves your browser**.
4. Paste the object into the correct `users.json` (customer-specific) or `admin-users.json` (global), and upload the file.

Roles:
- `viewer` – can view the wheel and download calendar files, but not edit.
- `admin` – can additionally add/edit/delete activities and years for **their own** customer.
- `superadmin` – can log in to **any** customer without a customer-specific account (typically used by you as the consultant).

## Adding a new customer

1. Create a new folder under `data/`, e.g. `data/vattenfall/`.
2. Create `data/vattenfall/users.json` (use the hash generator) and `data/vattenfall/years/2026.json` (empty activity list, see template in `data/hcs/years/2026.json`).
3. Add the customer to `data/customers.json`:
   ```json
   { "id": "vattenfall", "name": "Vattenfall DE", "shortName": "VF", "accent": "#1B3B6F", "years": ["2026"] }
   ```
4. Upload the new/changed files.

Super admin users (like `soren`) automatically get access to the new customer with no further setup.

## Adding a new year for an existing customer

Log in as admin/super admin → click **"Years"** at the top → enter the year. The app generates two downloadable files:
- `{year}.json` – upload to `data/{customer-id}/years/`
- an updated `customers.json` – replace the existing one on the server

## Security – what "robust" means here, and the real limits

This solution is significantly more robust than the original version (a single shared plaintext password hard-coded in the HTML file):

- **Passwords are never stored in plaintext** — only as a salted SHA-256 hash.
- **Login attempts are rate-limited**: after 5 wrong attempts an account is locked for 60 seconds, and each attempt adds increasing delay (mitigates automated attacks).
- **Sessions expire automatically** after 30 minutes of inactivity.
- **Separate users and roles per customer**, instead of one shared code for everyone.
- Data is sanitized on display, so activity text can't be used to inject malicious code (XSS).

**The honest limitation:** because the app runs 100% in the browser with no server, a technically capable user with developer tools can, in principle, see the hashed passwords when the page fetches `users.json`. True server-side security isn't achievable without a backend. This solution is therefore well suited to **internal use with low-to-moderate sensitivity** (e.g. a club's year wheel), but **not** for data requiring real access control (e.g. personal data or business-critical secrets). If that becomes necessary later, the next step is moving login and data protection to a Node.js backend (the same pattern you already use in ArchyGUI/Form-Tracker), where passwords are checked server-side and data isn't sent to the browser until login is verified.

## Customization

- **Colors:** edit the `accent` field per customer in `data/customers.json`. Month colors in the wheel are generated automatically as shades of this color.
- **Fonts:** Space Grotesk (headings) + Inter (body text), loaded from Google Fonts in `index.html`.
- **Language:** the Danish/English button in the top right switches all UI text. Month names are translated automatically.

## Troubleshooting

| Problem | Solution |
|---|---|
| Page shows "Could not load customer list" | You're opening the file directly (`file://`) — run it via a web server instead |
| Can't log in | Check the username/password, and that the account exists in the correct `users.json` |
| Account is locked | Wait 60 seconds, or clear `sessionStorage` in the browser |
| Changes disappear after reload | Remember to export the JSON and upload it to the server — nothing saves automatically |
| New year/customer doesn't show up | Check that `customers.json` was updated and uploaded correctly |

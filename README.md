# Assemblies — Google Sheets + Drive + Apps Script

A simple, low-cost backend for the Assemblies apartment community.

## Architecture

- GitHub Pages: public website
- Google Apps Script: backend/API
- Google Sheets: events, registrations, announcements, memories, ideas, attendance
- Google Drive: event photo storage
- Gmail via Apps Script: registration confirmation + admin notification
- No Firebase required

Designed for a small community (~15 people).

## Files

- `public/index.html` — website
- `public/styles.css` — design
- `public/app.js` — frontend logic
- `apps-script/Code.gs` — backend
- `apps-script/appsscript.json` — Apps Script manifest
- `README.md` — setup instructions

## 1. Create the Google Sheet

Create a new Google Sheet, for example `Assemblies Data`.

Copy its spreadsheet ID from the URL:

`https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit`

## 2. Create the Apps Script backend

Open the sheet, then:

Extensions → Apps Script

Delete the default code and paste the contents of `apps-script/Code.gs`.

Also open Project Settings → Script properties and add:

- `SPREADSHEET_ID` = your spreadsheet ID
- `USER_PASSWORD` = the password you chose for the `Tiny Achievers` account
- `ADMIN_PASSWORD` = the password you chose for the `admin` account
- `ADMIN_EMAIL` = your organizer email
- `DRIVE_FOLDER_ID` = optional Google Drive folder ID for photos

For your requested setup, both accounts use the same password you supplied.

IMPORTANT: passwords are stored in Script Properties, NOT in GitHub.

## 3. Initialize the database

In Apps Script, run:

`setupDatabase`

Approve the Google permissions.

This creates these sheets automatically:

- Events
- Announcements
- Memories
- Registrations
- Ideas
- Attendance

It also adds sample Assemblies content.

## 4. Deploy Apps Script

Apps Script → Deploy → New deployment

Choose:

- Type: Web app
- Execute as: Me
- Who has access: Anyone

Copy the Web app URL. It looks similar to:

`https://script.google.com/macros/s/XXXXXXXX/exec`

Open `public/app.js` and replace:

`PASTE_YOUR_APPS_SCRIPT_WEB_APP_URL_HERE`

with that URL.

## 5. GitHub Pages

Create a GitHub repository, e.g. `assemblies`.

Upload the contents of the `public` folder to the repository.

Then:

Settings → Pages → Deploy from branch → `main` → `/ (root)`

Your public site will get a free GitHub Pages address.

## Login

Requested accounts:

- User: `Tiny Achievers`
- Admin: `admin`

Both use the same password you supplied. The password is never stored in the GitHub files.

The user account can browse and register. The admin account can manage events, announcements, memories/photos, registrations, and attendance.

## Photos

Admin uploads a photo from the dashboard. Apps Script saves it to the configured Google Drive folder and stores the Drive file URL in the Memories sheet.

The Drive folder should be shared so that anyone with the link can view the photos if you want the public gallery to work without Google login.

## Email

Apps Script uses `MailApp` to send:

- participant registration confirmation
- organizer notification

The sender is the Google account that owns the Apps Script project. Gmail/Apps Script quotas apply.

## Capacity

Registration capacity is checked and incremented inside Apps Script while the registration is processed. This is the trusted backend check; the browser is not trusted with capacity enforcement.

## Security notes

- Never put the passwords in `public/app.js`.
- Never commit Script Properties or private Google credentials to GitHub.
- Do not make the Google Sheet publicly editable.
- The Apps Script web app is public, but write operations require the app's login token.
- For a small community, this is intentionally lightweight rather than enterprise authentication.

## Important

If you change the Apps Script URL after deployment, update `API_URL` in `public/app.js`.


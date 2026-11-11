# Put Sukli online with GitHub Pages (no command line)

Your Firebase keys are already filled in. Do these 3 parts in order.

## Part 1: Firebase console (about 5 minutes)
Open https://console.firebase.google.com and click your **SUKLI** project.

1. **Turn on sign-in.** Left menu > Security > Authentication > Get started.
   Enable **Email/Password**. Then enable **Google** too (pick your email as the support email).
2. **Create the database.** Left menu > Databases & Storage > Firestore > Create database.
   Edition: Standard. Location: asia-southeast1 (Singapore). Mode: **Production**.
3. **Publish the security rules.** In Firestore, open the **Rules** tab.
   Delete everything in the box, open the file `firestore.rules` from this folder in Notepad,
   copy ALL of it, paste it into the box, and click **Publish**.
   (Do not skip this. Without it the app cannot save anything.)

## Part 2: GitHub (about 5 minutes)
1. Sign in at https://github.com and click **New repository**. Name it `sukli`.
   Choose **Public** (free GitHub Pages needs a public repo). Click **Create repository**.
2. Click **uploading an existing file**.
3. Open this unzipped folder in Windows Explorer, select EVERYTHING inside it
   (index.html, css, js, icon.svg, manifest.webmanifest, firestore.rules, SETUP.md, .nojekyll)
   and drag it all into the GitHub page. Important: `index.html` must be at the top level of the repo,
   not inside another folder.
4. Click **Commit changes**.
5. Go to **Settings > Pages**. Under "Build and deployment" set Source to **Deploy from a branch**,
   Branch **main**, folder **/ (root)**, then **Save**.
6. Wait 1 to 2 minutes and refresh. GitHub shows your link:
   `https://YOUR-USERNAME.github.io/sukli/`

## Part 3: Allow your GitHub address in Firebase (required for sign-in)
Firebase console > Authentication > **Settings** tab > **Authorized domains** > **Add domain**.
Type only: `YOUR-USERNAME.github.io` (no https://, no /sukli).

## Done: first check
Open your GitHub link, create an account, add a transaction, then reload the page.
If it is still there, everything works.

If you see a red message at the bottom:
- "Firestore rejected this change": the rules from Part 1 step 3 were not published.
- "This domain is not authorised": Part 3 was not done, or the domain was typed wrong.
- "This sign-in method is not enabled": Part 1 step 1 was missed.

To update the site later: GitHub repo > open a file > pencil icon > edit > Commit changes.

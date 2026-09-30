# One More Rep

A reps journal for someone who wants to do a hundred things and ends up doing none.

Treat everything like the gym: show up, do a rep, even a weak one, and come back tomorrow. Two reps a day, every day, like learning to ride the bike, sirens or not. After 30 days you film a video about it, and the site has already written the outline.

It's a plain static website: HTML, CSS and JavaScript, with no build step, no framework and no server.

## What's inside

| Part | What it does |
|---|---|
| **Today** | The rep bench: pick a machine (Upwork, GitHub, CP / DSA…), count up or set 5/15/25/45 minutes, start. When a set ends you get **+1 · five more minutes**. Also: today's two-rep minimum, "how loud is your head", and one line for the day. |
| **Sirens mode** | For the days your brain says no. One machine, the smallest possible thing, five minutes, and it still counts. |
| **Brain dump** | Type a looping thought, press Enter, and it's parked. Ideas wait until you press **Do it now**. Anything marked "the ugly voice" has its words erased after 24 hours, and only the count stays. |
| **Look back** | Minutes-per-day chart, the 30-day grid, and a page for every day with prev/next buttons. |
| **Grand scheme** | Every machine is drawn as a barbell, and each level adds a plate. Season progress, your first rep next to your latest one, the month-video outline, a public recap page, and backups. |

## Deploy: GitHub, then Cloudflare Pages

### 1. Put it on GitHub (hand this to Claude Code)

Unzip, open the folder in Claude Code, and paste this:

> This folder is a finished static website. Please don't change any files. Initialise git here, commit everything, create a new **private** GitHub repository called `one-more-rep` under my account, and push to the `main` branch. Then give me the repository URL.

Cloudflare Pages works fine with private repos.

### 2. Connect it to Cloudflare Pages

1. In the Cloudflare dashboard go to **Workers & Pages**, then **Create application**, then **Pages**, then **Connect to Git**.
2. Sign in with GitHub, choose the `one-more-rep` repo, then **Install & Authorize** and **Begin setup**.
3. Fill in the build settings:
   - **Framework preset:** None
   - **Build command:** leave it empty
   - **Build output directory:** `public`
4. Click **Save and Deploy**. After a minute the site is live at `https://one-more-rep.pages.dev` (or a similar name).

Every time you push a change to GitHub, Cloudflare redeploys by itself.

**If the dashboard only offers a Worker** ("Import a repository" instead of Pages), ask Claude Code to add this file at the root of the repo as `wrangler.jsonc`, then deploy with the command `npx wrangler deploy`:

```jsonc
{
  "name": "one-more-rep",
  "compatibility_date": "2026-09-30",
  "assets": { "directory": "./public" }
}
```

## Put it on your phone

Open the site on your phone, then use **Add to Home Screen** (Safari's share menu, or Chrome's ⋮ menu). It opens like an app and works offline once you've loaded it once.

## Where your entries live

Everything you log is saved **in the browser you use**, on that device. Nobody else who opens the site can see it, even though the site itself is public.

That also means:

- **Save a backup** now and then (Grand scheme, then Your data). The page reminds you when it has been more than a week. Keep the `.json` file somewhere safe, like Google Drive.
- **To use it on another device**, save a backup on the first device, open the site on the second one, and use **Load a backup**. Loading only ever adds entries. It never deletes anything.
- Clearing your browser data for the site erases the diary on that device, so back up first.

## Making it a public blog

In Grand scheme, **Save recap page (.html)** makes a standalone page with your season's numbers, each machine's first rep next to its latest one, and a day-by-day list of reps. Tick the box if you want your one-line diary entries included. Head levels, the brain dump and the ugly voice are never included.

Drop the file into `public/posts/` and push. It goes live at `https://<your-site>/posts/season-1.html`.

## Change things yourself

- **Machines** (names, colours, the "smallest rep" suggestions) can all be edited on the site in Grand scheme. There's no need to touch code.
- The default machines for a fresh browser are in `DEFAULT_TRACKS` near the top of `public/app.js`.
- The weekly rules and their wording are in `WEEKS`, just below that.
- Colours and fonts are the `:root` tokens at the top of `public/styles.css`.

## Run it locally

```bash
cd public
python3 -m http.server 8000
# then open http://localhost:8000
```

## Files

```
public/
  index.html            the page
  styles.css            pastel theme, light and dark
  app.js                everything the page does
  sw.js                 offline support
  manifest.webmanifest  "Add to Home Screen" details
  _headers              Cloudflare headers (keeps sw.js fresh)
  icons/                app icons
  posts/                put public recap pages here
```

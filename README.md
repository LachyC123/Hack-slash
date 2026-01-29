# Sprite Fighter (GitHub Pages) — Start to Finish

## 0) What you need
- A GitHub account
- Your sprite sheet PNG from itch.io (the original download)

## 1) Download this project zip
Unzip it on your phone/computer.

## 2) Put your character in
Replace:
`assets/character.png`
with your itch.io PNG.

IMPORTANT: Use the original PNG (screenshots/JPEG can change the size and break the frames).
Your PNG should be **350 x 407** so each frame is **50 x 37**.

## 3) Create a GitHub repo
- GitHub → + → New repository
- Name it: `sprite-fighter` (or anything)
- Create repo

## 4) Upload the files (keep the assets folder)
On GitHub → Add file → Upload files
Upload:
- index.html
- style.css
- game.js
- assets/character.png

Then click **Commit changes**.

## 5) Turn on GitHub Pages
Repo → Settings → Pages
- Source: Deploy from branch
- Branch: main
- Folder: / (root)
Save

GitHub will show your website link on that page.

## Controls
- Move: WASD / Arrow keys
- Punch: J / Punch button
- Slide: Shift / Slide button

## Change punch animation row (optional)
In `game.js` change:
`punch: 6` → `punch: 7`
if you prefer the slash attack row.

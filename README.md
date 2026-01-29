# Sprite Fighter — Goblins v2 (Player attack row + Goblin attacks)

## Fix 1: Player attack row
In `game.js` find:
`row: { idle: 0, run: 1, attack: 7, slide: 9 }`

If the attack animation looks wrong, swap:
- `attack: 7` -> `attack: 6` (or vice versa)

## Fix 2: Goblin attacks
Goblins now play their attack animation and only damage you during the swing.

## Sprites
- `assets/player.png` = your adventurer sheet (7x11, 50x37)
- `assets/goblin.png` = your goblin sheet (12x6)

## Controls
- Mobile: joystick + Attack/Slide buttons
- Desktop: WASD/arrows, J attack, Shift slide

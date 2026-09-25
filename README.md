# STAR WARS: Hyperspace Assault

**Developed by Fahath Richvi**

A fan-made 3D space combat game that runs in your web browser. You fly a Rebel X-wing with Red Squadron against TIE fighters, TIE interceptors and an Imperial Star Destroyer.

## How to play

Double-click `index.html`. It opens in Chrome, Edge or Firefox.

- You don't need to install anything, and you don't need a server. Three.js is saved in `js/lib`, so the game works offline.
- The only thing loaded from the internet is the Google Fonts. Without a connection, the game uses fallback fonts.

Click the game screen to lock the mouse for steering. Press **Esc** or **P** to pause.

## Controls

| Input | Action |
|---|---|
| Mouse | Steer (pitch and yaw) |
| Left click / Space | Fire laser cannons |
| Right click / F | Fire a proton torpedo (lock on first for homing) |
| W / S | Throttle up / down |
| A / D | Roll |
| Arrow keys | Keyboard pitch and yaw |
| Shift | Engine boost |
| T / R | Target the nearest enemy / the enemy ahead |
| E / Q | Next / previous target |
| C | Switch between cockpit and chase camera |
| X | Center the flight stick |
| M / N | Mute all sound / toggle music |

## Missions

The campaign has 13 missions, each at a different location, plus an endless mode. Missions unlock one by one as you win them.

| # | Mission | Location | Type |
|---|---|---|---|
| 1 | Operation First Light | Kessra Belt: ringed gas giant | Dogfight |
| 2 | Operation Iron Veil | Hothar: frozen world | Dogfight against TIE interceptors |
| 3 | Operation Shattered Crown | Yavara: jungle world | Destroy a Star Destroyer |
| 4 | Operation Rockfall | Moraxa: shattered world | **Asteroid escape**: race a timer through a dense debris field to a beacon |
| 5 | Operation Lifeline | Aquilon: ocean world | **Escort**: protect 3 transports until they jump (2 must survive) |
| 6 | Operation Emberfall | Vulkar: volcanic world | **Strike**: destroy 3 guarded relay outposts |
| 7 | ☠ **Boss: The Black Wing** | Tashar: desert world with two suns | **Ace duel** with a shielded TIE Advanced that calls in reinforcements |
| 8 | Operation White Silence | Glacius: ringed ice giant | **Asteroid escape** through a collapsing ice ring while interceptors chase you |
| 9 | Operation Convoy Breaker | Toxara: poisoned world | **Intercept**: destroy Imperial freighters before they jump |
| 10 | ☠ **Boss: The Tyrant** | Crimson Void: red giant star | A Dreadnought with 4 shield generators and extra turrets |
| 11 | Operation Hold the Line | Sylvara: forest moon | **Survival**: hold out for 3 minutes against growing waves |
| 12 | Operation Nightshade | The Veiled Nebula | Dogfight in thick fog, where you have to rely on radar |
| 13 | ☠ **Final Boss: Heart of the Empire** | Imperialis: city-covered planet | Destroy 4 superlaser emitters, then hit the exhaust port with **proton torpedoes only**, before the countdown ends |
| 14 | Endless: Last Stand | Random location | Survive as many waves as you can for a high score |

## Features

- 13 locations. Each has its own planet type (ice, ocean, lava, desert, jungle, poisoned, shattered, city-covered or gas giant), clouds, rings, moons, nebula colors and suns. One is a binary star system and one is filled with fog.
- Asteroid fields where rocks drift and tumble, debris flies at you, and small rocks can be shot apart.
- Boss health bar, mission countdown timers, a beacon marker on the HUD, and radar that shows transports and large targets.
- All ships are built in code: an X-wing with an astromech droid, TIE fighters, TIE interceptors, a TIE Advanced, Rebel transports, Imperial freighters, relay outposts, and a Star Destroyer with turbolaser turrets, a command tower and engine glow. There is also a Dreadnought and a battle station with a superlaser dish.
- Opening text crawl, a hyperspace jump at the start of each mission, and the Star Destroyer's hyperspace arrival.
- Wingmen fight on their own, with radio chatter. Enemy AI leads its shots, breaks away and dodges.
- Bloom lighting, particle explosions, burning debris, shockwaves, shield flashes and camera shake.
- A gas giant with rings, a distant battle station, an asteroid field and a nebula sky.
- HUD with target brackets, a lead indicator for aiming, torpedo lock-on, radar and laser heat.
- All sound effects and music are generated in code, including blasters, the TIE engine scream, astromech beeps and the music. There are no audio files.
- Settings for mouse sensitivity, invert pitch, volume, bloom and difficulty (Cadet / Pilot / Ace). Your progress and high score are saved in the browser.

## Project layout

```
index.html        screens and HUD markup
css/style.css     UI styling
js/core.js        helpers, input, saved settings
js/audio.js       synthesized sound effects and music
js/textures.js    generated textures (hull panels, nebula, planet)
js/models.js      ship models
js/world.js       sky, stars, planet, battle station, asteroids
js/effects.js     particles, explosions, hyperspace effect
js/entities.js    fighters, AI, player controls, lasers, torpedoes
js/capital.js     the Star Destroyer
js/hud.js         heads-up display and radar
js/missions.js    mission data and radio chatter
js/game.js        main loop, game states, missions, camera
js/lib/           Three.js r147. The bloom pass was edited to use HDR buffers.
```

## License

© 2026 Fahath Richvi. All rights reserved. See [LICENSE](LICENSE).

Three.js in `js/lib/` is used under its own MIT License.

*This is a non-commercial fan tribute. It is not affiliated with Lucasfilm or Disney.*

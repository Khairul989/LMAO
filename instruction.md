Act as a Principal Game Architect and Senior Frontend Engineer utilizing the Opus 4.8 Ultracode system. Ensure the final code output is cleanly structured, optimized for immediate browser rendering, and fully compliant with the Opus 4.8 Ultracodeg HTML5, Tailwind CSS, and Three.js (via CDN). 

Execute this task by strictly adhering to the Opus 4.8 Ultracode optimization workflow:
- Monolithic Deployment: All HTML, CSS, JavaScript, asset shaders, and logic must exist in one self-contained document.
- Zero External Assets: Use Three.js geometric primitives with advanced procedural material shaders instead of external texture images. Synthesize all audio natively using the Web Audio API.
- Strict Type Safety & Edge-Case Handling: Implement robust error boundaries, explicit mathematical clamping for game loops, and full cleanup handlers for pointers and audio contexts.

Implement the following core game modules and strict mechanics:

1. ENVIRONMENT & ARCHITECTURAL LAYOUT (Three.js)
   - Construct a multi-room residential floor plan (minimum 4 distinct rooms connected by corridors).
   - Use distinct colors/procedural textures to differentiate walls, floors, and ceilings.
   - Implement an ambient lightning system: randomly trigger brief, intense ambient light flashes paired with procedurally synthesized thunder audio (low-frequency oscillator sweeps using the Web Audio API).

2. CAMERA, FIRST-PERSON PLAYER MOVEMENT, & LIGHTING
   - Implement native PointerLockControls (Mouse to look, WASD to move) with smooth velocity interpolation (damping) to prevent clipping through walls.
   - Bind a high-intensity directional Spotlight directly to the camera matrix to act as the player's flashlight. The cone should have a tight angle and high penumbra for realistic falloff.

3. RESOURCE CONSTRAINTS & ECONOMY
   - Flashlight Battery: Create an internal state variable that continuously drains the battery. Render a real-time responsive HUD bar using Tailwind CSS.
   - Pickups: Spawn 3 procedurally generated battery items (glowing cylinders) across the map. Implement bounding-box collision detection; stepping on a pickup replenishes 40% battery and triggers a synthesized audio chirp.

4. WEAPON, COMBAT, & SHOOTER MECHANICS
   - Render a 3D weapon model (or clean primitive representation) locked to the lower-right viewport.
   - Ammo System: The player starts with limited ammunition, displayed on the HUD. Scattered ammo boxes provide refills.
   - Shooting Logic: Left-click triggers a raycast from the screen center. Synthesize a muzzle flash light effect and a gunshot sound effect. If the ray intersects the monster, apply damage or stun duration.

5. ADVANCED MONSTER AI & "THE FREEZE RULE"
   - Instantiate a distinct 3D monster mesh that actively paths toward the player's global coordinates.
   - Implement "The Flashlight Freeze Rule": Calculate the dot product between the player's forward view vector and the vector pointing toward the monster. If the monster is within the flashlight's illumination cone AND the flashlight is turned ON, set the monster's velocity to zero (immobilized).
   - If the monster is outside the flashlight beam, it aggressively accelerates toward the player.
   - Game Over: If the monster's bounding box intersects the player, lock controls, display a terrifying full-screen jump-scare UI overlay with low-frequency synthesized audio noise, and provide a "Restart Game" button that resets all states.

6. WIN CONDITION
   - Hide 3 distinct "Brass Keys" (golden spheres or rings) in random rooms.
   - Track key inventory on the Tailwind HUD ("Keys Found: X/3").
   - Upon gathering all 3 keys, the player must navigate back to the initial spawn point (Front Door) to unlock it, triggering a clean "Victory Screen" UI.

Ensure the final code output is cleanly structured, optimized for immediate browser rendering, and fully compliant with the Opus 4.8 Ultracode standard.

# MEMORY.md — Arena Royale

> Fichier de mémoire pour agent IA. Contient tout le contexte du projet à injecter en début de session.

---

## Identité du projet

- **Nom** : Arena Royale (`⚡ ARENA ROYALE`)
- **Repo** : `Primoux/jeux-fun` (GitHub)
- **Type** : Shooter 2D multijoueur LAN party, top-down, temps réel
- **Version courante** : v0.8 (19 juin 2026)
- **Langage** : Node.js (serveur) + HTML5 Canvas pur (client)
- **Stack** : Express + Socket.io (serveur autoritaire, 20 ticks/s)

---

## Structure des fichiers

```
jeux-fun/
├── server.js           → logique de jeu complète (tick, physique, kills, RPS)
├── public/
│   └── index.html      → client complet (lobby, canvas, HUD, socket, fog)
├── package.json
└── .gitignore
```

---

## Constantes clés (server.js)

| Constante         | Valeur      | Rôle                                 |
|-------------------|-------------|--------------------------------------|
| `TICK_MS`         | 50ms        | Fréquence de la boucle serveur       |
| `ARENA_W/H`       | 1200×700px  | Dimensions de l'arène                |
| `PLAYER_SPEED`    | 230 px/s    | Vitesse de base                      |
| `PLAYER_RADIUS`   | 18px        | Rayon de collision joueur            |
| `BULLET_SPEED`    | 580 px/s    | Vitesse de base des balles           |
| `BULLET_DMG`      | 34          | Dégâts de base (pistolet)            |
| `BULLET_TTL`      | 2600ms      | Durée de vie d'une balle             |
| `FIRE_RATE_MS`    | 280ms       | Cadence de tir de base               |
| `RESPAWN_MS`      | 3000ms      | Délai de réapparition                |
| `MAX_KILLS`       | 15          | Score de victoire (par équipe)       |
| `BUFF_DURATION`   | 8000ms      | Durée des power-ups                  |
| `GRENADE_SPEED`   | 320 px/s    | Vitesse de lancer                    |
| `GRENADE_FUSE_MS` | 2200ms      | Fusible avant explosion              |
| `GRENADE_DMG`     | 85          | Dégâts max (centre de l'explosion)   |
| `GRENADE_BLAST_R` | 130px       | Rayon d'explosion                    |
| `GRENADE_COOLDOWN`| 6000ms      | Cooldown entre deux grenades         |
| `MAX_POWERUPS`    | 5           | Power-ups simultanés max sur la map  |

---

## Armes (server.js → `WEAPONS`)

| Arme      | Dégâts | Cadence | Vitesse | Munitions | Type              |
|-----------|--------|---------|---------|-----------|-------------------|
| `pistol`  | 25     | 200ms   | 600     | 30        | semi              |
| `smg`     | 16     | 80ms    | 550     | 35        | auto              |
| `shotgun` | 60     | 600ms   | 500     | 8         | burst (8 pellets) |
| `rifle`   | 45     | 300ms   | 650     | 20        | semi              |
| `sniper`  | 90     | 800ms   | 700     | 5         | semi              |

- Arme par défaut : `pistol`
- Munitions vides → rechargement automatique immédiat (remise à `weapon.ammo`)
- Spawn aléatoire sur la map toutes les 6s (max 8 simultanés)
- Touche client : `1-5` → `socket.emit('changeWeapon', weapon)`

---

## Personnages et stats passifs (`CHAR_STATS`)

| ID        | Niveau | Couleur    | Stat passive                                  |
|-----------|--------|------------|-----------------------------------------------|
| `classic` | 0      | `#e74c3c`  | Aucun bonus                                   |
| `shadow`  | 3      | `#7d3c98`  | `speedMult: 1.28`                             |
| `blaze`   | 7      | `#e67e22`  | `damageMult: 1.22`                            |
| `frost`   | 12     | `#2980b9`  | `slowOnHit: 2200ms` sur la cible              |
| `neon`    | 18     | `#e91e63`  | `fireRateMult: 0.68` (moins de délai)         |
| `toxic`   | 25     | `#27ae60`  | `poisonDPS: 9hp/s` pendant `3000ms`           |
| `gold`    | 35     | `#f39c12`  | `armor: 0.22` (réduit 22% des dégâts reçus)  |
| `trump`   | 0      | `#ff7518`  | Aucun bonus                                   |
| `rainbow` | 50     | `#ffffff`  | `speedMult: 1.10` + `damageMult: 1.10`        |

---

## Battle Pass (client, état en mémoire)

- 500 XP par niveau, 50 niveaux max
- 100 XP par kill personnel
- ⚠️ `localStorage` **ne doit pas être utilisé** (iframe sandboxé) → état en mémoire runtime uniquement
- Unlock de personnages par niveau (voir tableau ci-dessus)

---

## Équipes

- 2 équipes : **Rouge** (`#e74c3c`) et **Bleu** (`#3498db`)
- Auto-balance à la connexion : `tCount[0] <= tCount[1] ? 0 : 1`
- Spawns dédiés par équipe (côté gauche = Rouge, côté droit = Bleu)
- Pas de tirs amis : les balles traversent les coéquipiers
- Victoire à `MAX_KILLS = 15` kills d'équipe
- Visibilité partagée entre coéquipiers (fog of war partagé)

---

## Maps en rotation (`MAPS[]`)

| Index | Nom            | Description                                        |
|-------|----------------|----------------------------------------------------|
| 0     | `Bunkers`      | Obstacles en grille symétrique + centre            |
| 1     | `Couloirs`     | 3 lanes, 2 murs verticaux décalés                  |
| 2     | `Fort Central` | Enceinte creuse avec entrées latérales, coins       |

- Rotation automatique après chaque partie : `mapIdx = (mapIdx + 1) % 3`
- Événement socket : `'mapChange'` → `{ obstacles, mapName, mapIdx }`

---

## Événements Socket

### Client → Serveur

| Événement        | Payload                                                     |
|------------------|-------------------------------------------------------------|
| `setName`        | `String` (max 20 chars)                                     |
| `setCharacter`   | `charId: String`                                            |
| `changeWeapon`   | `weapon: String`                                            |
| `input`          | `{ up, down, left, right, shooting, angle }` (toutes les 33ms) |
| `grenade`        | `{ angle: Number }`                                         |
| `rps_pick`       | `{ cid, choice: 'rock'|'paper'|'scissors' }`                |

### Serveur → Client

| Événement        | Payload résumé                                                |
|------------------|---------------------------------------------------------------|
| `init`           | `{ id, arenaW, arenaH, obstacles, maxKills, team, mapName, mapIdx }` |
| `state`          | `{ players, bullets, powerups, weapons, grenades, gameOver, winner, teamScores }` |
| `kill`           | `{ killerId, killer, victim, killerTeam }`                    |
| `powerup`        | `{ player, type }`                                            |
| `explosion`      | `{ x, y, r }`                                                 |
| `reset`          | _(aucun payload)_                                             |
| `mapChange`      | `{ obstacles, mapName, mapIdx }`                              |
| `rps_started`    | `{ killer, victim }`                                          |
| `rps_challenge`  | `{ cid, role: 'killer'|'victim', opponent }`                  |
| `rps_result`     | `{ cid, killerChoice, victimChoice, killerName, victimName, killerWon, draw }` |

---

## Système RPS (Pierre Feuille Ciseaux)

- Déclenché à **5% de chance** sur chaque kill (`Math.random() < 0.05`)
- Le kill est mis **en attente** jusqu'à résolution
- Timeout auto : **6 secondes**, choix aléatoire si AFK
- Logique : `getRPSWinner(a, b)` → `'a'` (killer gagne) | `'b'` | `'draw'`
- Résultats : killer gagne → kill validé ; draw ou victime gagne → kill annulé

---

## Fog of War (client uniquement)

- Cône de vision : **130°** (±65°), portée **900px**
- Raycasting sur les obstacles + murs d'arène (fonction `castRay`)
- Polygone FOV calculé via `buildFOVPoly(px, py, facing)`
- Cercle de proximité immédiate : **68px** (toujours visible)
- Visibilité partagée : `isVisible()` vérifie le joueur local ET tous les coéquipiers vivants
- Coéquipiers toujours visibles entre eux

---

## Particules et effets (client)

| Événement       | Effet                                                           |
|-----------------|-----------------------------------------------------------------|
| Mort joueur     | Flash central + 28 éclats (couleur du personnage tué)           |
| Explosion grenade | 2 ondes de choc (flash orange/rouge) + 40 éclats               |

- Tableau `particles[]` mis à jour chaque frame
- Friction : `vx *= 0.88` par frame, `alpha` décroît exponentiellement
- Particules visibles par-dessus le fog of war

---

## Problèmes connus / Dette technique

| Priorité | Problème                                                  | Fichier         |
|----------|-----------------------------------------------------------|-----------------|
| 🔴 1     | `localStorage` peut crasher en iframe sandboxé            | `index.html`    |
| 🟠 2     | `inputLoop()` sans garde → double interval si reconnexion | `index.html`    |
| 🟠 3     | `requestAnimationFrame` démarre à chaque `connect()`      | `index.html`    |
| 🟡 4     | Fog of war recalculé entièrement chaque frame             | `index.html`    |
| 🟡 5     | Fond + obstacles redessinés à chaque frame                | `index.html`    |

---

## Règles de développement

1. **Serveur autoritaire** — ne jamais déplacer la logique de jeu côté client
2. **Pas de localStorage / sessionStorage** — état runtime uniquement
3. **Modifier server.js** → impacts sur le tick, les collisions, les kills, les armes
4. **Modifier public/index.html** → impacts sur le rendu, le HUD, les événements souris/clavier
5. **Tout nouvel événement socket** → documenter les deux côtés (emit + on)
6. **Collisions** → toujours via `circleRect(cx, cy, cr, rx, ry, rw, rh)`
7. **Positions** en pixels flottants, normalisées par `dt = (now - lastTick) / 1000`
8. Le pseudo par défaut `'diahrée foudroyante'` est un easter egg intentionnel — ne pas supprimer

---

## Historique des versions

| Version | Date         | Feature principale                          |
|---------|--------------|---------------------------------------------|
| v0.8    | 19 juin 2026 | Grenades clic droit + stats passives perso  |
| v0.7    | 18 juin 2026 | Particules de mort                          |
| v0.6    | 18 juin 2026 | Fog of war partagé par équipe + Patch Notes |
| v0.5    | 18 juin 2026 | 3 maps en rotation automatique              |
| v0.4    | 18 juin 2026 | Mode équipes 2v2                            |
| v0.3    | 18 juin 2026 | Fog of war raycasting                       |
| v0.2    | 18 juin 2026 | Système RPS + personnage Trump              |
| v0.1    | 18 juin 2026 | Lancement — moteur Socket.io de base        |

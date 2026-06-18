const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(express.static(path.join(__dirname, 'public')));

// ── Constants ────────────────────────────────────────────────────────────────
const TICK_MS        = 50;
const PLAYER_SPEED   = 230;
const BULLET_SPEED   = 580;
const PLAYER_RADIUS  = 18;
const BULLET_RADIUS  = 5;
const ARENA_W        = 1200;
const ARENA_H        = 700;
const MAX_KILLS      = 15;
const FIRE_RATE_MS   = 280;
const BULLET_DMG     = 34;
const RESPAWN_MS     = 3000;
const BULLET_TTL     = 2600;
const POWERUP_TYPES  = ['speed', 'rapidfire', 'damage', 'heal'];
const POWERUP_RADIUS = 14;
const MAX_POWERUPS   = 5;
const BUFF_DURATION  = 8000;

const TEAM_NAMES  = ['Rouge', 'Bleu'];
const TEAM_COLORS = ['#e74c3c', '#3498db'];

const GRENADE_SPEED    = 320;
const GRENADE_FUSE_MS  = 2200;
const GRENADE_DMG      = 85;
const GRENADE_BLAST_R  = 130;
const GRENADE_COOLDOWN = 6000;
const GRENADE_RADIUS   = 10;

// Stats passifs par personnage
const CHAR_STATS = {
  shadow:  { speedMult: 1.28 },
  blaze:   { damageMult: 1.22 },
  frost:   { slowOnHit: 2200 },
  neon:    { fireRateMult: 0.68 },
  toxic:   { poisonDPS: 9, poisonDur: 3000 },
  gold:    { armor: 0.22 },
  rainbow: { speedMult: 1.10, damageMult: 1.10 },
};

// ── Weapon system ───────────────────────────────────────────────────────────
const WEAPONS = {
  pistol:   { name: 'Pistolet',    dmg: 25,  fireRate: 200,  speed: 600,  ammo: 30,  type: 'semi' },
  smg:      { name: 'SMG',         dmg: 16,  fireRate: 80,   speed: 550,  ammo: 35,  type: 'auto' },
  shotgun:  { name: 'Shotgun',     dmg: 60,  fireRate: 600,  speed: 500,  ammo: 8,   type: 'burst', pellets: 8 },
  rifle:    { name: 'Rifle',       dmg: 45,  fireRate: 300,  speed: 650,  ammo: 20,  type: 'semi' },
  sniper:   { name: 'Sniper',      dmg: 90,  fireRate: 800,  speed: 700,  ammo: 5,   type: 'semi' },
};
const DEFAULT_WEAPON = 'pistol';const CHAR_COLORS = {
  classic:'#e74c3c', shadow:'#7d3c98', blaze:'#e67e22',
  frost:'#2980b9',   neon:'#e91e63',   toxic:'#27ae60',
  gold:'#f39c12',    rainbow:'#ffffff', trump:'#ff7518',
};

const MAPS = [
  {
    name: 'Bunkers',
    obstacles: [
      { x: 140, y: 110, w: 110, h: 110 },
      { x: 480, y: 110, w: 110, h: 110 },
      { x: 830, y: 110, w: 110, h: 110 },
      { x: 1060, y: 110, w: 110, h: 110 },
      { x: 140, y: 480, w: 110, h: 110 },
      { x: 480, y: 480, w: 110, h: 110 },
      { x: 830, y: 480, w: 110, h: 110 },
      { x: 1060, y: 480, w: 110, h: 110 },
      { x: 310, y: 290, w: 130, h: 120 },
      { x: 600, y: 270, w: 130, h: 160 },
      { x: 890, y: 290, w: 130, h: 120 },
    ],
  },
  {
    name: 'Couloirs',
    obstacles: [
      // Deux murs verticaux avec décalage pour créer 3 couloirs
      { x: 380, y:   0, w: 25, h: 240 },
      { x: 380, y: 360, w: 25, h: 340 },
      { x: 795, y: 110, w: 25, h: 250 },
      { x: 795, y: 460, w: 25, h: 240 },
      // Couvertures couloir central
      { x: 530, y:  90, w: 140, h: 70 },
      { x: 530, y: 540, w: 140, h: 70 },
      { x: 560, y: 290, w: 80,  h: 120 },
      // Couvertures couloir gauche
      { x: 170, y: 240, w: 120, h: 70 },
      { x: 170, y: 390, w: 120, h: 70 },
      // Couvertures couloir droit
      { x: 910, y: 240, w: 120, h: 70 },
      { x: 910, y: 390, w: 120, h: 70 },
    ],
  },
  {
    name: 'Fort Central',
    obstacles: [
      // Enceinte centrale creuse (entrées sur les côtés)
      { x: 450, y: 190, w: 300, h: 22 },
      { x: 450, y: 488, w: 300, h: 22 },
      { x: 450, y: 190, w: 22,  h: 140 },
      { x: 450, y: 370, w: 22,  h: 140 },
      { x: 728, y: 190, w: 22,  h: 140 },
      { x: 728, y: 370, w: 22,  h: 140 },
      // Couvertures par coin
      { x: 160, y: 110, w: 130, h: 80 },
      { x: 160, y: 510, w: 130, h: 80 },
      { x: 910, y: 110, w: 130, h: 80 },
      { x: 910, y: 510, w: 130, h: 80 },
      // Couloir mid
      { x: 260, y: 290, w: 80, h: 120 },
      { x: 860, y: 290, w: 80, h: 120 },
    ],
  },
];

let mapIdx    = 0;
let OBSTACLES = MAPS[0].obstacles;

const SPAWNS = [
  { x: 60,         y: 60         },
  { x: ARENA_W-60, y: 60         },
  { x: 60,         y: ARENA_H-60 },
  { x: ARENA_W-60, y: ARENA_H-60 },
  { x: ARENA_W/2,  y: 60         },
  { x: ARENA_W/2,  y: ARENA_H-60 },
  { x: 60,         y: ARENA_H/2  },
  { x: ARENA_W-60, y: ARENA_H/2  },
];

// Spawns côté gauche (Rouge) et droit (Bleu)
const TEAM_SPAWNS = [
  [ SPAWNS[0], SPAWNS[2], SPAWNS[6] ],
  [ SPAWNS[1], SPAWNS[3], SPAWNS[7] ],
];

// ── State ────────────────────────────────────────────────────────────────────
let players  = {};
let bullets  = [];
let bulletId = 0;
let powerups  = [];
let powerupId = 0;
let grenades  = [];
let grenadeId = 0;
let weapons   = [];
let weaponId  = 0;
let gameOver      = false;
let winner        = null;
let teamScores    = [0, 0];
let rpsChallenges = {};
let rpsId         = 0;

// ── Helpers ──────────────────────────────────────────────────────────────────
function circleRect(cx, cy, cr, rx, ry, rw, rh) {
  const nx = Math.max(rx, Math.min(cx, rx + rw));
  const ny = Math.max(ry, Math.min(cy, ry + rh));
  const dx = cx - nx, dy = cy - ny;
  return dx * dx + dy * dy < cr * cr;
}

function safeSpawn(excludeId, team = -1) {
  const pool = team >= 0 ? TEAM_SPAWNS[team] : SPAWNS;
  for (const sp of pool) {
    let ok = true;
    for (const [id, p] of Object.entries(players)) {
      if (id === excludeId) continue;
      if (!p.alive) continue;
      const dx = p.x - sp.x, dy = p.y - sp.y;
      if (dx * dx + dy * dy < 180 * 180) { ok = false; break; }
    }
    if (ok) return sp;
  }
  return pool[Math.floor(Math.random() * pool.length)];
}

function randomPowerupPos() {
  for (let i = 0; i < 60; i++) {
    const x = 60 + Math.random() * (ARENA_W - 120);
    const y = 60 + Math.random() * (ARENA_H - 120);
    let ok = true;
    for (const o of OBSTACLES) {
      if (circleRect(x, y, POWERUP_RADIUS + 24, o.x, o.y, o.w, o.h)) { ok = false; break; }
    }
    if (ok) return { x, y };
  }
  return null;
}

function awardKill(killerId, killerName, victimName) {
  const shooter = players[killerId];
  if (!shooter) return;
  shooter.score++;
  teamScores[shooter.team]++;
  io.emit('kill', { killerId, killer: killerName, victim: victimName, killerTeam: shooter.team });
  if (teamScores[shooter.team] >= MAX_KILLS) {
    gameOver = true;
    winner   = { team: shooter.team, name: TEAM_NAMES[shooter.team], color: TEAM_COLORS[shooter.team] };
    setTimeout(() => { resetGame(); io.emit('reset'); }, 5000);
  }
}

function explodeGrenade(g, now) {
  io.emit('explosion', { x: g.x, y: g.y, r: GRENADE_BLAST_R });
  for (const id in players) {
    const p = players[id];
    if (!p.alive) continue;
    if (p.team === g.team) continue;
    const dx = p.x - g.x, dy = p.y - g.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < GRENADE_BLAST_R + PLAYER_RADIUS) {
      const factor = 1 - dist / (GRENADE_BLAST_R + PLAYER_RADIUS);
      p.health -= Math.round(GRENADE_DMG * factor);
      if (p.health <= 0) {
        p.health = 0; p.alive = false; p.respawnAt = now + RESPAWN_MS;
        awardKill(g.ownerId, (players[g.ownerId] && players[g.ownerId].name) || '?', p.name);
      }
    }
  }
}

const RPS_CHOICES = ['rock', 'paper', 'scissors'];

function getRPSWinner(a, b) {
  if (a === b) return 'draw';
  if ((a==='rock'&&b==='scissors')||(a==='scissors'&&b==='paper')||(a==='paper'&&b==='rock')) return 'a';
  return 'b';
}

function resolveRPS(cid) {
  const ch = rpsChallenges[cid];
  if (!ch || ch.resolved) return;
  ch.resolved = true;
  delete rpsChallenges[cid];
  const kc  = ch.killerChoice || RPS_CHOICES[Math.floor(Math.random() * 3)];
  const vc  = ch.victimChoice || RPS_CHOICES[Math.floor(Math.random() * 3)];
  const res = getRPSWinner(kc, vc);
  io.emit('rps_result', {
    cid, killerChoice: kc, victimChoice: vc,
    killerName: ch.killerName, victimName: ch.victimName,
    killerWon: res === 'a', draw: res === 'draw',
  });
  if (res === 'a') {
    const shooter = players[ch.killerId];
    if (shooter) {
      shooter.score++;
      teamScores[shooter.team]++;
      io.emit('kill', { killerId: ch.killerId, killer: ch.killerName, victim: ch.victimName, killerTeam: shooter.team });
      if (teamScores[shooter.team] >= MAX_KILLS) {
        gameOver = true;
        winner   = { team: shooter.team, name: TEAM_NAMES[shooter.team], color: TEAM_COLORS[shooter.team] };
        setTimeout(() => { resetGame(); io.emit('reset'); }, 5000);
      }
    }
  }
}

function resetGame() {
  mapIdx    = (mapIdx + 1) % MAPS.length;
  OBSTACLES = MAPS[mapIdx].obstacles;
  gameOver   = false;
  winner     = null;
  teamScores = [0, 0];
  bullets    = [];
  powerups   = [];
  grenades   = [];
  for (const id in players) {
    const p  = players[id];
    const sp = safeSpawn(id, p.team);
    Object.assign(p, {
      score: 0, health: 100, alive: true, x: sp.x, y: sp.y,
      buffs: { speed: 0, rapidfire: 0, damage: 0 },
      poisonUntil: 0, poisonDPS: 0, poisonerId: null,
      slowUntil: 0,
    });
  }
  io.emit('mapChange', { obstacles: OBSTACLES, mapName: MAPS[mapIdx].name, mapIdx });
}

// ── Game loop ────────────────────────────────────────────────────────────────
let lastTick = Date.now();

function tick() {
  const now = Date.now();
  const dt  = (now - lastTick) / 1000;
  lastTick  = now;

  if (gameOver) return;

  for (const id in players) {
    const p = players[id];

    if (!p.alive) {
      if (now >= p.respawnAt) {
        const sp = safeSpawn(id);
        Object.assign(p, { alive: true, health: 100, x: sp.x, y: sp.y });
      }
      continue;
    }

    // Poison tick
    if (p.poisonUntil > now) {
      p.health -= p.poisonDPS * dt;
      if (p.health <= 0) {
        p.health = 0; p.alive = false; p.respawnAt = now + RESPAWN_MS;
        if (p.poisonerId) awardKill(p.poisonerId, (players[p.poisonerId] && players[p.poisonerId].name) || '?', p.name);
        continue;
      }
    }

    const cs  = CHAR_STATS[p.characterId] || {};
    const inp = p.input;
    let vx = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
    let vy = (inp.down  ? 1 : 0) - (inp.up   ? 1 : 0);
    if (vx !== 0 && vy !== 0) { vx *= 0.7071; vy *= 0.7071; }
    const spMult = (p.buffs.speed > now ? 1.65 : 1)
                 * (cs.speedMult || 1)
                 * (p.slowUntil > now ? 0.42 : 1);
    vx *= PLAYER_SPEED * spMult; vy *= PLAYER_SPEED * spMult;

    p.x += vx * dt;
    p.x  = Math.max(PLAYER_RADIUS, Math.min(ARENA_W - PLAYER_RADIUS, p.x));
    for (const o of OBSTACLES) {
      if (circleRect(p.x, p.y, PLAYER_RADIUS, o.x, o.y, o.w, o.h)) {
        p.x -= vx * dt;
        p.x  = Math.max(PLAYER_RADIUS, Math.min(ARENA_W - PLAYER_RADIUS, p.x));
        break;
      }
    }

    p.y += vy * dt;
    p.y  = Math.max(PLAYER_RADIUS, Math.min(ARENA_H - PLAYER_RADIUS, p.y));
    for (const o of OBSTACLES) {
      if (circleRect(p.x, p.y, PLAYER_RADIUS, o.x, o.y, o.w, o.h)) {
        p.y -= vy * dt;
        p.y  = Math.max(PLAYER_RADIUS, Math.min(ARENA_H - PLAYER_RADIUS, p.y));
        break;
      }
    }

    const fireRate = (p.buffs.rapidfire > now ? FIRE_RATE_MS * 0.3 : FIRE_RATE_MS) * (cs.fireRateMult || 1);
    if (inp.shooting && now - p.lastShot >= fireRate && p.ammo > 0) {
      p.lastShot = now;
      const a   = p.angle;
      const weapon = WEAPONS[p.weapon];
      const dmg = Math.round((p.buffs.damage > now ? weapon.dmg * 1.9 : weapon.dmg) * (cs.damageMult || 1));
      const speed = weapon.speed;
      
      // Handle burst fire (shotgun)
      if (weapon.pellets) {
        for (let i = 0; i < weapon.pellets; i++) {
          const spread = (Math.random() - 0.5) * 0.4;
          bullets.push({
            id: bulletId++, ownerId: id, dmg,
            x: p.x + Math.cos(a) * (PLAYER_RADIUS + 6),
            y: p.y + Math.sin(a) * (PLAYER_RADIUS + 6),
            vx: Math.cos(a + spread) * speed,
            vy: Math.sin(a + spread) * speed,
            born: now,
          });
        }
        p.ammo -= weapon.pellets;
      } else {
        bullets.push({
          id: bulletId++, ownerId: id, dmg,
          x: p.x + Math.cos(a) * (PLAYER_RADIUS + 6),
          y: p.y + Math.sin(a) * (PLAYER_RADIUS + 6),
          vx: Math.cos(a) * speed,
          vy: Math.sin(a) * speed,
          born: now,
        });
        p.ammo--;
      }
      
      // Reload when out of ammo
      if (p.ammo <= 0) {
        p.ammo = weapon.ammo;
      }
    }
  }

  // Power-up collection
  for (let i = powerups.length - 1; i >= 0; i--) {
    const pu = powerups[i];
    for (const id in players) {
      const p = players[id];
      if (!p.alive) continue;
      const dx = p.x - pu.x, dy = p.y - pu.y;
      if (dx*dx + dy*dy < (PLAYER_RADIUS + POWERUP_RADIUS)**2) {
        if (pu.type === 'heal') {
          p.health = Math.min(100, p.health + 50);
        } else {
          p.buffs[pu.type] = now + BUFF_DURATION;
        }
        io.emit('powerup', { player: p.name, type: pu.type });
        powerups.splice(i, 1);
        break;
      }
    }
  }

  // Weapon pickups
  for (let i = weapons.length - 1; i >= 0; i--) {
    const w = weapons[i];
    for (const id in players) {
      const p = players[id];
      if (!p.alive) continue;
      const dx = p.x - w.x, dy = p.y - w.y;
      if (dx*dx + dy*dy < (PLAYER_RADIUS + POWERUP_RADIUS)**2) {
        p.weapon = w.weapon;
        p.ammo = WEAPONS[w.weapon].ammo;
        io.emit('powerup', { player: p.name, type: 'weapon_' + w.weapon });
        weapons.splice(i, 1);
        break;
      }
    }
  }

  // Bullets
  const alive = [];
  for (const b of bullets) {
    if (now - b.born > BULLET_TTL) continue;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (b.x < 0 || b.x > ARENA_W || b.y < 0 || b.y > ARENA_H) continue;

    let dead = false;
    for (const o of OBSTACLES) {
      if (circleRect(b.x, b.y, BULLET_RADIUS, o.x, o.y, o.w, o.h)) { dead = true; break; }
    }
    if (dead) continue;

    let hit = false;
    for (const id in players) {
      if (id === b.ownerId) continue;
      const p = players[id];
      if (!p.alive) continue;
      // Pas de tirs amis
      const owner = players[b.ownerId];
      if (owner && owner.team === p.team) continue;
      const dx = p.x - b.x, dy = p.y - b.y;
      if (dx * dx + dy * dy < (PLAYER_RADIUS + BULLET_RADIUS) ** 2) {
        const shooter    = players[b.ownerId];
        const shooterCS  = CHAR_STATS[shooter && shooter.characterId] || {};
        const targetCS   = CHAR_STATS[p.characterId] || {};
        const actualDmg  = Math.round(b.dmg * (1 - (targetCS.armor || 0)));
        p.health -= actualDmg;
        // Débuffs de personnage
        if (shooterCS.slowOnHit)  { p.slowUntil = now + shooterCS.slowOnHit; }
        if (shooterCS.poisonDPS)  {
          p.poisonUntil = now + shooterCS.poisonDur;
          p.poisonDPS   = shooterCS.poisonDPS;
          p.poisonerId  = b.ownerId;
        }
        hit = true;
        if (p.health <= 0) {
          p.health    = 0;
          p.alive     = false;
          p.respawnAt = now + RESPAWN_MS;
          if (shooter) {
            if (Math.random() < 0.05) {
              const cid = rpsId++;
              rpsChallenges[cid] = {
                id: cid, resolved: false,
                killerId: b.ownerId, killerName: shooter.name, killerChoice: null,
                victimId: id,        victimName: p.name,       victimChoice: null,
              };
              io.to(b.ownerId).emit('rps_challenge', { cid, role:'killer', opponent: p.name });
              io.to(id).emit('rps_challenge',         { cid, role:'victim', opponent: shooter.name });
              io.emit('rps_started', { killer: shooter.name, victim: p.name });
              setTimeout(() => resolveRPS(cid), 6000);
            } else {
              awardKill(b.ownerId, shooter.name, p.name);
            }
          }
        }
        break;
      }
    }
    if (!hit) alive.push(b);
  }
  bullets = alive;

  // Grenades
  const aliveGrenades = [];
  for (const g of grenades) {
    if (now >= g.explodeAt) { explodeGrenade(g, now); continue; }
    g.x += g.vx * dt; g.y += g.vy * dt;
    g.vx *= 0.97; g.vy *= 0.97;
    // Rebond sur les murs de l'arène
    if (g.x < GRENADE_RADIUS)         { g.x = GRENADE_RADIUS;         g.vx = Math.abs(g.vx) * 0.65; }
    if (g.x > ARENA_W - GRENADE_RADIUS){ g.x = ARENA_W-GRENADE_RADIUS; g.vx = -Math.abs(g.vx) * 0.65; }
    if (g.y < GRENADE_RADIUS)         { g.y = GRENADE_RADIUS;         g.vy = Math.abs(g.vy) * 0.65; }
    if (g.y > ARENA_H - GRENADE_RADIUS){ g.y = ARENA_H-GRENADE_RADIUS; g.vy = -Math.abs(g.vy) * 0.65; }
    // Explosion sur contact obstacle
    let hitWall = false;
    for (const o of OBSTACLES) {
      if (circleRect(g.x, g.y, GRENADE_RADIUS, o.x, o.y, o.w, o.h)) { hitWall = true; break; }
    }
    if (hitWall) { explodeGrenade(g, now); continue; }
    aliveGrenades.push(g);
  }
  grenades = aliveGrenades;

  io.emit('state', {
    players: Object.fromEntries(Object.entries(players).map(([id, p]) => [id, {
      id, name: p.name, x: p.x, y: p.y, angle: p.angle,
      health: p.health, alive: p.alive, score: p.score,
      color: p.color, characterId: p.characterId,
      respawnAt: p.respawnAt, buffs: p.buffs, team: p.team,
      poisonUntil: p.poisonUntil, slowUntil: p.slowUntil,
      weapon: p.weapon, ammo: p.ammo,
    }])),
    bullets:  bullets.map(b  => ({ id: b.id, x: b.x, y: b.y, ownerId: b.ownerId })),
    powerups: powerups.map(pu => ({ id: pu.id, type: pu.type, x: pu.x, y: pu.y })),
    weapons:  weapons.map(w  => ({ id: w.id, weapon: w.weapon, x: w.x, y: w.y })),
    grenades: grenades.map(g => ({ id: g.id, x: g.x, y: g.y, explodeAt: g.explodeAt, ownerId: g.ownerId })),
    gameOver, winner, teamScores,
  });
}

setInterval(tick, TICK_MS);

setInterval(() => {
  if (gameOver) return;
  if (powerups.length < MAX_POWERUPS && Object.keys(players).length > 0) {
    const pos = randomPowerupPos();
    if (pos) {
      const type = POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)];
      powerups.push({ id: powerupId++, type, x: pos.x, y: pos.y });
    }
  }
}, 4000);

// Spawn des armes aléatoires
setInterval(() => {
  if (gameOver || weapons.length >= 8) return;
  const pos = randomPowerupPos();
  if (pos) {
    const weaponList = Object.keys(WEAPONS);
    const weapon = weaponList[Math.floor(Math.random() * weaponList.length)];
    weapons.push({ id: weaponId++, weapon, x: pos.x, y: pos.y });
  }
}, 6000);

// ── Sockets ──────────────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  // Auto-balance des équipes
  const tCounts = [0, 0];
  for (const id in players) tCounts[players[id].team]++;
  const team = tCounts[0] <= tCounts[1] ? 0 : 1;
  const sp = safeSpawn(socket.id, team);

  players[socket.id] = {
    id: socket.id, name: 'diahrée foudroyante',
    x: sp.x, y: sp.y, angle: 0,
    health: 100, alive: true, score: 0,
    color: CHAR_COLORS.classic, characterId: 'classic',
    lastShot: 0, lastGrenade: 0, respawnAt: 0, team,
    buffs: { speed: 0, rapidfire: 0, damage: 0 },
    poisonUntil: 0, poisonDPS: 0, poisonerId: null, slowUntil: 0,
    input: { up: false, down: false, left: false, right: false, shooting: false },
    weapon: DEFAULT_WEAPON, ammo: WEAPONS[DEFAULT_WEAPON].ammo,
  };

  socket.emit('init', {
    id: socket.id, arenaW: ARENA_W, arenaH: ARENA_H,
    obstacles: OBSTACLES, maxKills: MAX_KILLS, team,
    mapName: MAPS[mapIdx].name, mapIdx,
  });

  socket.on('setName', (name) => {
    if (players[socket.id])
      players[socket.id].name = String(name).slice(0, 20).trim() || 'diahrée foudroyante';
  });

  socket.on('setCharacter', (charId) => {
    const p = players[socket.id];
    if (!p) return;
    const col = CHAR_COLORS[String(charId)];
    if (!col) return;
    p.characterId = String(charId);
    p.color       = col;
  });

  socket.on('changeWeapon', (weapon) => {
    const p = players[socket.id];
    if (!p || !WEAPONS[weapon]) return;
    p.weapon = weapon;
    p.ammo = WEAPONS[weapon].ammo;
  });

  socket.on('input', (data) => {
    const p = players[socket.id];
    if (!p) return;
    p.input.up       = !!data.up;
    p.input.down     = !!data.down;
    p.input.left     = !!data.left;
    p.input.right    = !!data.right;
    p.input.shooting = !!data.shooting;
    if (typeof data.angle === 'number') p.angle = data.angle;
  });

  socket.on('grenade', (data) => {
    const p = players[socket.id];
    if (!p || !p.alive || gameOver) return;
    if (Date.now() - p.lastGrenade < GRENADE_COOLDOWN) return;
    p.lastGrenade = Date.now();
    const angle = typeof data.angle === 'number' ? data.angle : 0;
    grenades.push({
      id: grenadeId++, ownerId: socket.id, team: p.team,
      x: p.x + Math.cos(angle) * (PLAYER_RADIUS + 14),
      y: p.y + Math.sin(angle) * (PLAYER_RADIUS + 14),
      vx: Math.cos(angle) * GRENADE_SPEED,
      vy: Math.sin(angle) * GRENADE_SPEED,
      explodeAt: Date.now() + GRENADE_FUSE_MS,
    });
  });

  socket.on('rps_pick', ({ cid, choice }) => {
    const ch = rpsChallenges[cid];
    if (!ch || ch.resolved || !RPS_CHOICES.includes(choice)) return;
    if (socket.id === ch.killerId && !ch.killerChoice) ch.killerChoice = choice;
    else if (socket.id === ch.victimId && !ch.victimChoice) ch.victimChoice = choice;
    if (ch.killerChoice && ch.victimChoice) resolveRPS(cid);
  });

  socket.on('disconnect', () => { delete players[socket.id]; });
});

// ── Listen ───────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  const os   = require('os');
  const nets = os.networkInterfaces();
  let lanIp  = 'localhost';
  for (const iface of Object.values(nets)) {
    for (const addr of iface) {
      if (addr.family === 'IPv4' && !addr.internal) { lanIp = addr.address; break; }
    }
  }
  console.log('\n========================================');
  console.log('  ⚡  ARENA ROYALE  —  LAN Party');
  console.log('========================================');
  console.log(`  Local  :  http://localhost:${PORT}`);
  console.log(`  LAN    :  http://${lanIp}:${PORT}`);
  console.log('  Partage cette URL à tes potes !');
  console.log('========================================\n');
});

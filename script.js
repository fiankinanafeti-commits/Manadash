
window.onload = function() {
    const canvas = document.getElementById("manaDashCanvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    // États
    let screen = "menu"; // "menu", "playing", "shop"
    let gameMode = "infini";

    // Configuration du jeu
    const game = {
        gravity: 0.52,
        baseSpeed: 5,
        speed: 5,
        floorY: 360,
        cameraX: 0,
        time: 0,
        gameOver: false,
        shake: 0,
        bossActive: false
    };

    let bestScore = parseInt(localStorage.getItem("manaDashBest")) || 0;
    let score = 0;
    let comboCount = 0;
    let comboTimer = 0;
    const COMBO_TIMEOUT = 90;
    let comboMultiplier = 1;
    let particles = [];

    // Skins
    let playerCoins = 0;
    let currentSkin = {
        name: "default",
        mainColor: "#ff3355",
        secColor: "#d90429",
        strokeColor: "rgba(255,215,0,0.7)",
        eyeColor: "#ff9e00",
        trailColor: "rgba(255,90,0,0.25)",
        projectileColors: ["#fff", "#ffaa00", "#ff2200"]
    };

    const shopSkins = [
        {
            id: "golden", name: "Flamme Dorée", price: 500, owned: false,
            mainColor: "#ffaa00", secColor: "#cc8800", strokeColor: "rgba(255,215,0,0.9)",
            eyeColor: "#ffcc00", trailColor: "rgba(255,200,0,0.3)",
            projectileColors: ["#fff", "#ffdd00", "#ff8800"]
        },
        {
            id: "ice", name: "Flamme Glaciale", price: 500, owned: false,
            mainColor: "#3399ff", secColor: "#0055cc", strokeColor: "rgba(100,200,255,0.9)",
            eyeColor: "#00ccff", trailColor: "rgba(0,180,255,0.3)",
            projectileColors: ["#fff", "#88ddff", "#0088ff"]
        }
    ];

    const ball = {
        x: 150, realX: 150, y: 200, radius: 28, vy: 0,
        isGrounded: false, angle: 0, speedRotation: 0.08,
        trail: [], shielded: false, shieldTimer: 0,
        jumpsLeft: 2, maxJumps: 2,
        furyMode: false, furyTimer: 0
    };

    let furyMeter = 0;
    const FURY_MAX = 100;

    const OBSTACLE_NORMAL = 0, OBSTACLE_ARMORED = 1, OBSTACLE_MOVING = 2,
          OBSTACLE_TURRET = 3, OBSTACLE_HAMMER = 4, OBSTACLE_BARRIER = 5,
          OBSTACLE_SWARM = 6;

    let obstacles = [
        { realX: 650, w: 35, h: 50, type: OBSTACLE_NORMAL, hp: 1, maxHp: 1, moveDir: 1, moveRange: 0, baseY: 0, turretTimer: 0, hammerPhase: 0, hammerY: 0, barrierOn: true, barrierTimer: 0, swarmCount: 0 },
        { realX: 1150, w: 35, h: 50, type: OBSTACLE_NORMAL, hp: 1, maxHp: 1, moveDir: 1, moveRange: 0, baseY: 0, turretTimer: 0, hammerPhase: 0, hammerY: 0, barrierOn: true, barrierTimer: 0, swarmCount: 0 },
        { realX: 1600, w: 35, h: 50, type: OBSTACLE_MOVING, hp: 1, maxHp: 1, moveDir: 1, moveRange: 30, baseY: 0, turretTimer: 0, hammerPhase: 0, hammerY: 0, barrierOn: true, barrierTimer: 0, swarmCount: 0 },
        { realX: 1640, w: 35, h: 50, type: OBSTACLE_ARMORED, hp: 2, maxHp: 2, moveDir: 1, moveRange: 0, baseY: 0, turretTimer: 0, hammerPhase: 0, hammerY: 0, barrierOn: true, barrierTimer: 0, swarmCount: 0 }
    ];
    const initialObstacles = JSON.parse(JSON.stringify(obstacles));

    let turretProjectiles = [];
    let fireCard = null, shieldCard = null;
    const CARD_SIZE = 30;
    let firePower = null;
    let boss = null, bossDefeated = false;
    let bossType = 0;
    const BOSS_SCORE_TRIGGER = 300;
    let bossProjectiles = [];
    let manaCoins = [], manaOrbs = [];
    let obstacleSpawnTimer = 300;

    let buttons = [];

    // Navigation
    function goToMenu() { screen = "menu"; game.gameOver = false; }
    function goToShop() { screen = "shop"; }
    function startGame() {
        screen = "playing";
        gameMode = "infini";
        playerCoins = 1000; // pièces de test
        resetGame();
    }

    function triggerJump() {
        if (game.gameOver) { resetGame(); return; }
        if (ball.jumpsLeft > 0) {
            ball.vy = -9.2;
            ball.jumpsLeft--;
            ball.isGrounded = false;
        }
    }

    function spawnCard(type) {
        const d = 400 + Math.random() * 200;
        if (type === "fire") fireCard = { realX: ball.realX + d, collected: false };
        else shieldCard = { realX: ball.realX + d, collected: false };
    }

    function activateFirePower() {
        firePower = { x: ball.x + ball.radius + 20, y: ball.y - 10, vx: 15, radius: 20 };
        game.shake = 8;
    }

    function activateShield() { ball.shielded = true; ball.shieldTimer = 300; }

    function createExplosionParticles(x, y, c1 = "#ff6600", c2 = "#ffcc00") {
        for (let i = 0; i < 6; i++) { // 🔥 réduit de 15 à 6
            const a = Math.random() * Math.PI * 2, s = 2 + Math.random() * 3;
            particles.push({
                x, y,
                vx: Math.cos(a) * s,
                vy: Math.sin(a) * s - 2,
                life: 1,
                decay: 0.03 + Math.random() * 0.05, // 🔥 disparaît plus vite
                size: 2 + Math.random() * 2,
                color: Math.random() < 0.5 ? c1 : c2
            });
        }
    }

    function addScore(base) {
        comboCount++;
        comboTimer = COMBO_TIMEOUT;
        comboMultiplier = Math.min(comboCount, 10);
        score += base * comboMultiplier;
        if (score > bestScore) {
            bestScore = score;
            localStorage.setItem("manaDashBest", bestScore);
        }
    }

    function fillFury(amount) {
        furyMeter = Math.min(FURY_MAX, furyMeter + amount);
        if (furyMeter >= FURY_MAX && !ball.furyMode) {
            ball.furyMode = true;
            ball.furyTimer = 180;
            furyMeter = FURY_MAX;
        }
    }

    function spawnRandomObstacle() {
        const types = [OBSTACLE_NORMAL, OBSTACLE_ARMORED, OBSTACLE_MOVING, OBSTACLE_TURRET, OBSTACLE_HAMMER, OBSTACLE_BARRIER, OBSTACLE_SWARM];
        const type = types[Math.floor(Math.random() * types.length)];
        let hp = 1;
        if (type === OBSTACLE_ARMORED) hp = 2;
        if (type === OBSTACLE_TURRET) hp = 3;
        if (type === OBSTACLE_HAMMER || type === OBSTACLE_BARRIER) hp = 2;
        const newObs = {
            realX: ball.realX + 600 + Math.random() * 200,
            w: type === OBSTACLE_SWARM ? 20 : 35 + Math.floor(Math.random() * 15),
            h: type === OBSTACLE_SWARM ? 20 : (type === OBSTACLE_HAMMER ? 80 : 40 + Math.floor(Math.random() * 30)),
            type, hp, maxHp: hp,
            moveDir: Math.random() < 0.5 ? 1 : -1,
            moveRange: type === OBSTACLE_MOVING ? 20 + Math.random() * 30 : 0,
            baseY: 0,
            turretTimer: 0, hammerPhase: 0, hammerY: 0,
            barrierOn: true, barrierTimer: 0,
            swarmCount: type === OBSTACLE_SWARM ? 3 + Math.floor(Math.random() * 3) : 0
        };
        if (obstacles.length > 15) obstacles.shift(); // 🔥 limite le nombre d'obstacles
        obstacles.push(newObs);
    }

    function spawnBoss() {
        game.bossActive = true;
        bossDefeated = false;
        bossProjectiles = [];
        const type = bossType % 2;
        bossType++;
        if (type === 0) {
            boss = { realX: ball.realX + 600, y: game.floorY - 120, w: 80, h: 90, hp: 10, maxHp: 10, phase: 1, attackTimer: 120, type: 0 };
        } else {
            boss = { realX: ball.realX + 600, y: game.floorY - 120, w: 100, h: 100, hp: 14, maxHp: 14, phase: 1, attackTimer: 80, type: 1 };
        }
    }

    function applySkin(skin) {
        currentSkin = {
            name: skin.name,
            mainColor: skin.mainColor,
            secColor: skin.secColor,
            strokeColor: skin.strokeColor,
            eyeColor: skin.eyeColor,
            trailColor: skin.trailColor,
            projectileColors: skin.projectileColors
        };
    }

    function resetGame() {
        ball.y = 200; ball.realX = 150; ball.vy = 0; ball.isGrounded = false;
        ball.angle = 0; ball.trail = []; ball.shielded = false; ball.shieldTimer = 0;
        ball.jumpsLeft = ball.maxJumps; ball.furyMode = false; ball.furyTimer = 0;
        game.cameraX = 0; game.gameOver = false; game.speed = game.baseSpeed;
        game.shake = 0; game.bossActive = false;
        obstacles = JSON.parse(JSON.stringify(initialObstacles));
        fireCard = shieldCard = firePower = null;
        particles = [];
        boss = null; bossDefeated = false;
        bossProjectiles = [];
        turretProjectiles = [];
        manaCoins = []; manaOrbs = [];
        furyMeter = 0;
        obstacleSpawnTimer = 300;
        score = 0; comboCount = 0; comboTimer = 0; comboMultiplier = 1;
        spawnCard("fire"); spawnCard("shield");
    }

    window.addEventListener("keydown", (e) => {
        if (e.code === "Space" || e.code === "ArrowUp") {
            e.preventDefault();
            if (screen === "playing") triggerJump();
        }
    });

    function getScaledMouse(e) {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        return {
            mx: (e.clientX - rect.left) * scaleX,
            my: (e.clientY - rect.top) * scaleY
        };
    }

    canvas.addEventListener("mousedown", (e) => {
        e.preventDefault();
        const { mx, my } = getScaledMouse(e);

        if (screen === "menu" || screen === "shop") {
            for (let btn of buttons) {
                if (mx >= btn.x && mx <= btn.x + btn.w && my >= btn.y && my <= btn.y + btn.h) {
                    if (btn.action) btn.action();
                    break;
                }
            }
            // Achat boutique
            if (screen === "shop") {
                for (let i = 0; i < shopSkins.length; i++) {
                    const skin = shopSkins[i];
                    const y = 140 + i * 80;
                    if (mx >= 550 && mx <= 670 && my >= y+15 && my <= y+45) {
                        if (!skin.owned && playerCoins >= skin.price) {
                            playerCoins -= skin.price;
                            skin.owned = true;
                            applySkin(skin);
                        }
                        break;
                    }
                }
            }
        } else if (screen === "playing") {
            triggerJump();
        }
    });

    canvas.addEventListener("touchstart", (e) => {
        e.preventDefault();
        if (screen === "playing") triggerJump();
    }, { passive: false });

    canvas.addEventListener("contextmenu", (e) => e.preventDefault());

    spawnCard("fire"); spawnCard("shield");

    // ---------- BOUCLE PRINCIPALE ----------
    function gameLoop() {
        if (screen === "menu") {
            drawMenu();
            requestAnimationFrame(gameLoop);
            return;
        }
        if (screen === "shop") {
            drawShop();
            requestAnimationFrame(gameLoop);
            return;
        }

        if (!game.gameOver) {
            game.time += 0.05;
            game.speed = game.baseSpeed + Math.floor(score / 100) * 0.5;

            ball.vy += game.gravity;
            ball.y += ball.vy;
            ball.realX += game.speed;
            game.cameraX = ball.realX - 150;
            ball.angle += ball.speedRotation;

            if (ball.furyMode) {
                ball.furyTimer--;
                if (ball.furyTimer <= 0) { ball.furyMode = false; furyMeter = 0; }
                else {
                    if (!firePower && game.time % 20 < 1) activateFirePower();
                    ball.shielded = true;
                    ball.shieldTimer = 2;
                }
            }

            if (ball.shielded && --ball.shieldTimer <= 0) ball.shielded = false;

            if (ball.y + ball.radius >= game.floorY) {
                ball.y = game.floorY - ball.radius;
                ball.vy = 0;
                ball.isGrounded = true;
                ball.jumpsLeft = ball.maxJumps;
            }

            ball.trail.push({ x: ball.x, y: ball.y });
            if (ball.trail.length > 10) ball.trail.shift();

            if (--obstacleSpawnTimer <= 0) {
                obstacleSpawnTimer = 300 + Math.floor(Math.random() * 120);
                spawnRandomObstacle();
            }

            for (let o of obstacles) {
                if (o.type === OBSTACLE_MOVING) {
                    if (o.baseY === 0) o.baseY = game.floorY - o.h;
                    o.baseY += o.moveDir * 1.5;
                    if (o.baseY < game.floorY - o.h - o.moveRange || o.baseY > game.floorY - o.h) o.moveDir *= -1;
                } else if (o.type === OBSTACLE_TURRET) {
                    if (++o.turretTimer >= 50) {
                        o.turretTimer = 0;
                        turretProjectiles.push({ x: o.realX - game.cameraX, y: game.floorY - o.h / 2, vx: -5, vy: 0, radius: 5, life: 200 });
                    }
                } else if (o.type === OBSTACLE_HAMMER) {
                    if (!o.hammerY) o.hammerY = game.floorY - o.h;
                    if (o.hammerPhase === 0) {
                        o.hammerY += 6;
                        if (o.hammerY >= game.floorY) { o.hammerY = game.floorY; o.hammerPhase = 1; }
                    } else {
                        o.hammerY -= 3;
                        if (o.hammerY <= game.floorY - o.h) { o.hammerY = game.floorY - o.h; o.hammerPhase = 0; }
                    }
                } else if (o.type === OBSTACLE_BARRIER) {
                    if (++o.barrierTimer >= 30) { o.barrierTimer = 0; o.barrierOn = !o.barrierOn; }
                }
            }

            for (let i = turretProjectiles.length - 1; i >= 0; i--) {
                let p = turretProjectiles[i];
                p.x += p.vx; p.life--;
                if (p.life <= 0 || p.x < -50) turretProjectiles.splice(i, 1);
            }

            if (!ball.shielded) {
                for (let o of obstacles) {
                    let sx = o.realX - game.cameraX;
                    let obsY = (o.type === OBSTACLE_MOVING) ? o.baseY : (o.type === OBSTACLE_HAMMER) ? o.hammerY : game.floorY - o.h;
                    if (o.type === OBSTACLE_BARRIER && !o.barrierOn) continue;
                    if (o.type === OBSTACLE_SWARM) {
                        for (let s = 0; s < o.swarmCount; s++) {
                            let sx2 = sx + s * 15;
                            let clX = Math.max(sx2, Math.min(ball.x, sx2 + 10));
                            let clY = Math.max(obsY, Math.min(ball.y, obsY + 10));
                            if ((ball.x - clX) ** 2 + (ball.y - clY) ** 2 < ball.radius ** 2) game.gameOver = true;
                        }
                    } else {
                        let clX = Math.max(sx, Math.min(ball.x, sx + o.w));
                        let clY = Math.max(obsY, Math.min(ball.y, game.floorY));
                        if ((ball.x - clX) ** 2 + (ball.y - clY) ** 2 < ball.radius ** 2) game.gameOver = true;
                    }
                }
                for (let p of turretProjectiles) {
                    if ((ball.x - p.x) ** 2 + (ball.y - p.y) ** 2 < (ball.radius + p.radius) ** 2) game.gameOver = true;
                }
                if (boss && !bossDefeated) {
                    let bx = boss.realX - game.cameraX;
                    if (ball.x + ball.radius > bx && ball.x - ball.radius < bx + boss.w &&
                        ball.y + ball.radius > boss.y && ball.y - ball.radius < boss.y + boss.h) game.gameOver = true;
                    for (let p of bossProjectiles) {
                        if ((ball.x - p.x) ** 2 + (ball.y - p.y) ** 2 < (ball.radius + p.radius) ** 2) game.gameOver = true;
                    }
                }
            }

            if (comboTimer > 0) { comboTimer--; if (comboTimer === 0) { comboCount = 0; comboMultiplier = 1; } }

            if (fireCard && !fireCard.collected) {
                let cx = (fireCard.realX - game.cameraX) + CARD_SIZE / 2, cy = game.floorY - 60;
                if (Math.hypot(ball.x - cx, ball.y - cy) < ball.radius + CARD_SIZE / 2) {
                    addScore(50); fireCard.collected = true; fireCard = null;
                    activateFirePower();
                    setTimeout(() => { if (!game.gameOver) spawnCard("fire"); }, 2000);
                }
            }
            if (shieldCard && !shieldCard.collected) {
                let cx = (shieldCard.realX - game.cameraX) + CARD_SIZE / 2, cy = game.floorY - 60;
                if (Math.hypot(ball.x - cx, ball.y - cy) < ball.radius + CARD_SIZE / 2) {
                    addScore(30); shieldCard.collected = true; shieldCard = null;
                    activateShield();
                    setTimeout(() => { if (!game.gameOver) spawnCard("shield"); }, 4000);
                }
            }

            for (let i = manaCoins.length - 1; i >= 0; i--) {
                let c = manaCoins[i];
                let dx = ball.x - (c.realX - game.cameraX), dy = ball.y - c.y;
                if (dx * dx + dy * dy < (ball.radius + 10) ** 2) {
                    score += 5 * comboMultiplier;
                    fillFury(8);
                    playerCoins += 10;
                    manaCoins.splice(i, 1);
                }
            }
            for (let i = manaOrbs.length - 1; i >= 0; i--) {
                let orb = manaOrbs[i];
                let dx = ball.x - (orb.realX - game.cameraX), dy = ball.y - orb.y;
                if (dx * dx + dy * dy < (ball.radius + 12) ** 2) {
                    fillFury(25);
                    score += 15 * comboMultiplier;
                    playerCoins += 30;
                    createExplosionParticles(orb.realX - game.cameraX, orb.y, "#00ffff", "#ffffff");
                    manaOrbs.splice(i, 1);
                }
            }

            if (!game.bossActive && score >= BOSS_SCORE_TRIGGER && !bossDefeated) spawnBoss();
            if (boss && !bossDefeated) {
                boss.y = game.floorY - 120 + Math.sin(game.time * 2) * 40;
                if (boss.hp <= boss.maxHp / 2 && boss.phase === 1) { boss.phase = 2; boss.attackTimer = 60; game.shake = 12; }
                if (boss.attackTimer > 0) boss.attackTimer--;
                else {
                    if (boss.type === 0) boss.attackTimer = boss.phase === 1 ? 120 : 70;
                    else boss.attackTimer = boss.phase === 1 ? 80 : 50;
                    game.shake = 12;
                    let bx = boss.realX - game.cameraX;
                    if (boss.type === 1) bossProjectiles.push({ x: bx, y: boss.y + boss.h / 2, vx: -4, vy: 0, radius: 8 });
                    else if (boss.type === 0 && boss.phase === 2) bossProjectiles.push({ x: bx, y: boss.y + 20, vx: -3, vy: 2, radius: 6 });
                }
                for (let i = bossProjectiles.length - 1; i >= 0; i--) {
                    let p = bossProjectiles[i];
                    p.x += p.vx; p.y += p.vy;
                    if (p.x < -50 || p.x > canvas.width + 50 || p.y < -50 || p.y > canvas.height + 50) bossProjectiles.splice(i, 1);
                    if (firePower && (firePower.x - p.x) ** 2 + (firePower.y - p.y) ** 2 < (firePower.radius + p.radius) ** 2) {
                        createExplosionParticles(p.x, p.y, "#ff8800", "#ffff00");
                        bossProjectiles.splice(i, 1);
                        firePower = null;
                    }
                }
                if (firePower) {
                    let bx = boss.realX - game.cameraX;
                    if (firePower.x + firePower.radius > bx && firePower.x - firePower.radius < bx + boss.w &&
                        firePower.y + firePower.radius > boss.y && firePower.y - firePower.radius < boss.y + boss.h) {
                        boss.hp--;
                        
                        createExplosionParticles(firePower.x, firePower.y, "#ff0000", "#ff8800");
                        firePower = null;
                        game.shake = 6;
                        if (boss.hp <= 0) {
                            bossDefeated = true; game.bossActive = false;
                            addScore(250);
                            fillFury(40);
                            createExplosionParticles(bx + boss.w / 2, boss.y + boss.h / 2, "#ffdd00", "#ff4400");
                            boss = null; game.shake = 15;
                            bossProjectiles = [];
                            if (!fireCard) spawnCard("fire");
                            if (!shieldCard) spawnCard("shield");
                        }
                    }
                }
            }

            // Projectile de feu vs obstacles et projectiles ennemis
            if (firePower) {
                firePower.x += firePower.vx;
                for (let i = obstacles.length - 1; i >= 0; i--) {
                    let o = obstacles[i];
                    let sx = o.realX - game.cameraX;
                    let obsY = (o.type === OBSTACLE_MOVING) ? o.baseY : (o.type === OBSTACLE_HAMMER) ? o.hammerY : game.floorY - o.h;
                    if (o.type === OBSTACLE_BARRIER && !o.barrierOn) continue;
                    if (o.type === OBSTACLE_SWARM) {
                        for (let s = 0; s < o.swarmCount; s++) {
                            let sx2 = sx + s * 15;
                            let clX = Math.max(sx2, Math.min(firePower.x, sx2 + 10));
                            let clY = Math.max(obsY, Math.min(firePower.y, obsY + 10));
                            if ((firePower.x - clX) ** 2 + (firePower.y - clY) ** 2 < firePower.radius ** 2) {
                                o.hp--;
                                createExplosionParticles(firePower.x, firePower.y, "#aaaaaa", "#ffffff");
                                firePower = null;
                                break;
                            }
                        }
                        if (firePower === null) break;
                    } else {
                        let clX = Math.max(sx, Math.min(firePower.x, sx + o.w));
                        let clY = Math.max(obsY, Math.min(firePower.y, game.floorY));
                        if ((firePower.x - clX) ** 2 + (firePower.y - clY) ** 2 < firePower.radius ** 2) {
                            o.hp--;
                            if (o.hp <= 0) {
                                createExplosionParticles(sx + o.w / 2, obsY + o.h / 2);
                                for (let c = 0; c < 3; c++) manaCoins.push({ realX: o.realX + Math.random() * o.w, y: obsY + Math.random() * 20 });
                                if (Math.random() < 0.15) manaOrbs.push({ realX: o.realX + o.w / 2, y: obsY - 10 });
                                obstacles.splice(i, 1);
                                addScore(10); fillFury(3);
                            } else {
                                createExplosionParticles(firePower.x, firePower.y, "#aaaaaa", "#ffffff");
                                firePower = null;
                            }
                            if (firePower === null) break;
                        }
                    }
                }
                if (firePower) {
                    for (let i = turretProjectiles.length - 1; i >= 0; i--) {
                        let p = turretProjectiles[i];
                        if ((firePower.x - p.x) ** 2 + (firePower.y - p.y) ** 2 < (firePower.radius + p.radius) ** 2) {
                            createExplosionParticles(p.x, p.y, "#ff8800", "#ffff00");
                            turretProjectiles.splice(i, 1);
                            firePower = null;
                            break;
                        }
                    }
                }
                if (firePower && firePower.x > canvas.width + 50) firePower = null;
            }

            // Particules (optimisées)
            for (let i = particles.length - 1; i >= 0; i--) {
                let p = particles[i];
                p.x += p.vx;
                p.y += p.vy;
                p.vy += 0.2; // 🔥 chute plus rapide
                p.life -= p.decay;
                if (p.life <= 0) particles.splice(i, 1);
            }

            if (game.shake > 0) { game.shake *= 0.9; if (game.shake < 0.5) game.shake = 0; }

            for (let i = manaCoins.length - 1; i >= 0; i--) { if (manaCoins[i].realX - game.cameraX < -50) manaCoins.splice(i, 1); }
            for (let i = manaOrbs.length - 1; i >= 0; i--) { if (manaOrbs[i].realX - game.cameraX < -50) manaOrbs.splice(i, 1); }
        }

        // ---------- RENDU ----------
        let shakeX = 0, shakeY = 0;
        if (game.shake > 0) {
            shakeX = (Math.random() - 0.5) * game.shake * 2;
            shakeY = (Math.random() - 0.5) * game.shake * 2;
        }
        ctx.save();
        ctx.translate(shakeX, shakeY);
        ctx.clearRect(-5, -5, canvas.width + 10, canvas.height + 10);

        let bg1 = ball.furyMode ? "#140001" : "#090201";
        let bg2 = ball.furyMode ? "#3a0000" : "#2b0f04";
        let bg3 = ball.furyMode ? "#200000" : "#150601";
        let bgGrad = ctx.createLinearGradient(0, 0, 0, game.floorY);
        bgGrad.addColorStop(0, bg1); bgGrad.addColorStop(0.75, bg2); bgGrad.addColorStop(1, bg3);
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, canvas.width, game.floorY);

        ctx.strokeStyle = "rgba(255,140,0,0.08)";
        ctx.lineWidth = 1;
        let offX = game.cameraX % 60;
        for (let x = -offX; x < canvas.width; x += 60) {
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, game.floorY); ctx.stroke();
        }

        for (let o of obstacles) {
            let sx = o.realX - game.cameraX;
            if (sx > -50 && sx < canvas.width + 50) {
                let obsY = (o.type === OBSTACLE_MOVING) ? o.baseY : (o.type === OBSTACLE_HAMMER) ? o.hammerY : game.floorY - o.h;
                if (o.type === OBSTACLE_BARRIER) {
                    if (!o.barrierOn) continue;
                    ctx.save();
                    ctx.globalAlpha = 0.6 + Math.sin(game.time * 10) * 0.3;
                    ctx.shadowBlur = 15; ctx.shadowColor = "#aa00ff";
                    ctx.strokeStyle = "#cc44ff"; ctx.lineWidth = 4;
                    ctx.beginPath(); ctx.moveTo(sx + o.w / 2, game.floorY); ctx.lineTo(sx + o.w / 2, game.floorY - o.h); ctx.stroke();
                    ctx.restore();
                } else if (o.type === OBSTACLE_TURRET) {
                    ctx.save();
                    ctx.shadowBlur = 10; ctx.shadowColor = "#00ff00";
                    ctx.fillStyle = "#1a1a1a"; ctx.fillRect(sx, game.floorY - 15, o.w, 15);
                    ctx.fillStyle = "#00ff00"; ctx.fillRect(sx + o.w / 2 - 4, game.floorY - 25, 8, 10);
                    ctx.restore();
                } else if (o.type === OBSTACLE_HAMMER) {
                    ctx.save();
                    ctx.shadowBlur = 12; ctx.shadowColor = "#888888";
                    ctx.fillStyle = "#555"; ctx.fillRect(sx, obsY, o.w, o.h);
                    ctx.fillStyle = "#aaa"; ctx.fillRect(sx - 5, obsY - 10, o.w + 10, 10);
                    ctx.restore();
                } else if (o.type === OBSTACLE_SWARM) {
                    for (let s = 0; s < o.swarmCount; s++) {
                        let sx2 = sx + s * 15;
                        ctx.save();
                        ctx.shadowBlur = 8; ctx.shadowColor = "#ff0000";
                        ctx.fillStyle = "#440000";
                        ctx.beginPath(); ctx.moveTo(sx2, game.floorY); ctx.lineTo(sx2 + 5, game.floorY - 12); ctx.lineTo(sx2 + 10, game.floorY); ctx.closePath(); ctx.fill();
                        ctx.restore();
                    }
                } else {
                    ctx.save();
                    ctx.shadowBlur = 12;
                    ctx.shadowColor = o.type === OBSTACLE_ARMORED ? "#ff8800" : "#ff5500";
                    ctx.beginPath(); ctx.moveTo(sx, game.floorY); ctx.lineTo(sx + o.w / 2, obsY); ctx.lineTo(sx + o.w, game.floorY); ctx.closePath();
                    ctx.fillStyle = o.type === OBSTACLE_ARMORED ? "#2a2a2a" : "#140c0a";
                    ctx.fill();
                    ctx.strokeStyle = o.type === OBSTACLE_ARMORED ? "#cc8800" : "#ff6a00";
                    ctx.lineWidth = o.type === OBSTACLE_ARMORED ? 3.5 : 2.5;
                    ctx.stroke();
                    if (o.type === OBSTACLE_ARMORED && o.hp > 0) {
                        ctx.fillStyle = "#fff"; ctx.font = "10px monospace";
                        ctx.fillText(o.hp, sx + o.w / 2 - 3, obsY + 15);
                    }
                    ctx.restore();
                }
            }
        }

        for (let p of turretProjectiles) {
            ctx.save(); ctx.shadowBlur = 6; ctx.shadowColor = "#00ff00";
            ctx.fillStyle = "#ccff00"; ctx.beginPath(); ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
        }

        for (let c of manaCoins) {
            let sx = c.realX - game.cameraX;
            ctx.save(); ctx.shadowBlur = 8; ctx.shadowColor = "#ffd700";
            ctx.fillStyle = "#ffcc00"; ctx.beginPath(); ctx.arc(sx, c.y, 5, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(sx - 1, c.y - 1, 2, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
        }
        for (let orb of manaOrbs) {
            let sx = orb.realX - game.cameraX;
            ctx.save(); ctx.shadowBlur = 15; ctx.shadowColor = "#00ffff";
            ctx.fillStyle = "#00ccff"; ctx.beginPath(); ctx.arc(sx, orb.y, 8, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = "#ffffff"; ctx.beginPath(); ctx.arc(sx - 2, orb.y - 2, 3, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
        }

        for (let p of bossProjectiles) {
            ctx.save(); ctx.shadowBlur = 10; ctx.shadowColor = "#ff0000";
            ctx.fillStyle = "#ff3300"; ctx.beginPath(); ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
        }

        if (boss && !bossDefeated) {
            let bx = boss.realX - game.cameraX;
            ctx.save(); ctx.shadowBlur = 20; ctx.shadowColor = boss.type === 0 ? "#ff0000" : "#ff8800";
            ctx.fillStyle = boss.type === 0 ? "#1a0505" : "#2a0a00";
            ctx.strokeStyle = boss.type === 0 ? "#ff3300" : "#ff6600"; ctx.lineWidth = 4;
            ctx.beginPath(); ctx.rect(bx, boss.y, boss.w, boss.h); ctx.fill(); ctx.stroke();
            ctx.fillStyle = "#fff"; ctx.beginPath();
            ctx.arc(bx + 25, boss.y + 25, 10, 0, Math.PI * 2); ctx.arc(bx + 55, boss.y + 25, 10, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = boss.phase === 2 ? "#ffff00" : "#ff0000"; ctx.beginPath();
            ctx.arc(bx + 25, boss.y + 25, 5, 0, Math.PI * 2); ctx.arc(bx + 55, boss.y + 25, 5, 0, Math.PI * 2); ctx.fill();
            let hpR = boss.hp / boss.maxHp;
            ctx.fillStyle = "#333"; ctx.fillRect(bx, boss.y - 15, boss.w, 8);
            ctx.fillStyle = boss.phase === 2 ? "#ffaa00" : "#ff0000"; ctx.fillRect(bx, boss.y - 15, boss.w * hpR, 8);
            ctx.restore();
        }

        for (let p of particles) {
            ctx.save(); ctx.globalAlpha = p.life; ctx.fillStyle = p.color;
            ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
        }

        ctx.fillStyle = "#0a0402";
        ctx.fillRect(0, game.floorY, canvas.width, canvas.height - game.floorY);
        ctx.save(); ctx.shadowBlur = 15; ctx.shadowColor = "#ff9e00";
        ctx.fillStyle = "#ff9e00"; ctx.fillRect(0, game.floorY, canvas.width, 4);
        ctx.restore();

        if (fireCard && !fireCard.collected) {
            let cx = fireCard.realX - game.cameraX, cy = game.floorY - 60;
            ctx.save(); ctx.shadowBlur = 10; ctx.shadowColor = "#ffaa00";
            ctx.fillStyle = "#1a0a00"; ctx.strokeStyle = "#ff6600"; ctx.lineWidth = 3;
            ctx.fillRect(cx, cy, CARD_SIZE, CARD_SIZE * 1.4); ctx.strokeRect(cx, cy, CARD_SIZE, CARD_SIZE * 1.4);
            ctx.translate(cx + CARD_SIZE / 2, cy + CARD_SIZE / 2);
            ctx.fillStyle = "#ff3300"; ctx.beginPath(); ctx.moveTo(0, -12); ctx.quadraticCurveTo(8, -4, 4, 8); ctx.quadraticCurveTo(0, 4, 0, 10); ctx.quadraticCurveTo(0, 4, -4, 8); ctx.quadraticCurveTo(-8, -4, 0, -12); ctx.fill();
            ctx.fillStyle = "#ffcc00"; ctx.beginPath(); ctx.moveTo(0, -6); ctx.quadraticCurveTo(4, -1, 2, 6); ctx.quadraticCurveTo(0, 3, 0, 7); ctx.quadraticCurveTo(0, 3, -2, 6); ctx.quadraticCurveTo(-4, -1, 0, -6); ctx.fill();
            ctx.restore();
        }
        if (shieldCard && !shieldCard.collected) {
            let cx = shieldCard.realX - game.cameraX, cy = game.floorY - 60;
            ctx.save(); ctx.shadowBlur = 10; ctx.shadowColor = "#00aaff";
            ctx.fillStyle = "#001a2a"; ctx.strokeStyle = "#0088ff"; ctx.lineWidth = 3;
            ctx.fillRect(cx, cy, CARD_SIZE, CARD_SIZE * 1.4); ctx.strokeRect(cx, cy, CARD_SIZE, CARD_SIZE * 1.4);
            ctx.translate(cx + CARD_SIZE / 2, cy + CARD_SIZE / 2);
            ctx.strokeStyle = "#00ccff"; ctx.lineWidth = 2.5;
            ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(8, -4); ctx.lineTo(8, 4); ctx.lineTo(0, 10); ctx.lineTo(-8, 4); ctx.lineTo(-8, -4); ctx.closePath(); ctx.stroke();
            ctx.restore();
        }

        if (firePower) {
            ctx.save();
            ctx.shadowBlur = 20; ctx.shadowColor = "#ff4400";
            let grad = ctx.createRadialGradient(firePower.x - 3, firePower.y - 3, 2, firePower.x, firePower.y, firePower.radius);
            grad.addColorStop(0, currentSkin.projectileColors[0]); grad.addColorStop(0.3, currentSkin.projectileColors[1]); grad.addColorStop(0.7, currentSkin.projectileColors[2]); grad.addColorStop(1, "rgba(180,0,0,0)");
            ctx.beginPath(); ctx.arc(firePower.x, firePower.y, firePower.radius, 0, Math.PI * 2);
            ctx.fillStyle = grad; ctx.fill();
            ctx.restore();
        }

        ctx.save();
        for (let i = 0; i < ball.trail.length; i++) {
            let p = ball.trail[i], op = i / ball.trail.length;
            ctx.beginPath(); ctx.arc(p.x, p.y, ball.radius * (0.3 + op * 0.7), 0, Math.PI * 2);
            ctx.fillStyle = currentSkin.trailColor.replace(/[\d.]+\)$/g, (op * 0.25) + ')');
            ctx.fill();
        }
        ctx.restore();

        ctx.save();
        let pulse = 20 + Math.sin(game.time * 3) * 6;
        let ac1 = ball.shielded ? "rgba(0,180,255,0.7)" : ball.furyMode ? "rgba(255,0,0,0.8)" : `rgba(${hexToRgb(currentSkin.mainColor)},0.65)`;
        let ac2 = ball.shielded ? "rgba(0,100,255,0.3)" : ball.furyMode ? "rgba(255,100,0,0.5)" : `rgba(${hexToRgb(currentSkin.mainColor)},0.3)`;
        let aura = ctx.createRadialGradient(ball.x, ball.y, ball.radius - 4, ball.x, ball.y, ball.radius + pulse);
        aura.addColorStop(0, ac1); aura.addColorStop(0.5, ac2); aura.addColorStop(1, "rgba(0,0,0,0)");
        ctx.beginPath(); ctx.arc(ball.x, ball.y, ball.radius + pulse, 0, Math.PI * 2);
        ctx.fillStyle = aura; ctx.fill();
        ctx.restore();

        ctx.save(); ctx.translate(ball.x, ball.y);
        ctx.save(); ctx.rotate(ball.angle);
        let mainCol = ball.furyMode ? "#ff0000" : (ball.shielded ? "#39f" : currentSkin.mainColor);
        let secCol = ball.furyMode ? "#aa0000" : (ball.shielded ? "#05c" : currentSkin.secColor);
        let ballGrad = ctx.createRadialGradient(-9, -9, 2, -3, -3, ball.radius);
        ballGrad.addColorStop(0, "#fff"); ballGrad.addColorStop(0.2, mainCol); ballGrad.addColorStop(0.7, secCol); ballGrad.addColorStop(1, "#260003");
        ctx.beginPath(); ctx.arc(0, 0, ball.radius, 0, Math.PI * 2); ctx.fillStyle = ballGrad; ctx.fill();
        ctx.strokeStyle = ball.furyMode ? "rgba(255,200,0,0.9)" : (ball.shielded ? "rgba(100,200,255,0.8)" : currentSkin.strokeColor);
        ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(0, -ball.radius + 7); ctx.lineTo(ball.radius - 7, 0); ctx.lineTo(0, ball.radius - 7); ctx.lineTo(-ball.radius + 7, 0); ctx.closePath(); ctx.stroke();
        ctx.restore();
        ctx.fillStyle = "#fff";
        ctx.beginPath(); ctx.ellipse(-9, -4, 5.5, 3.5, Math.PI / 12, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(9, -4, 5.5, 3.5, -Math.PI / 12, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = ball.furyMode ? "#ffff00" : (ball.shielded ? "#0cf" : currentSkin.eyeColor);
        ctx.beginPath(); ctx.arc(-8, -4, 2.8, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(8, -4, 2.8, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#000";
        ctx.beginPath(); ctx.arc(-8, -4, 1.3, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(8, -4, 1.3, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "#000"; ctx.lineWidth = 2.2;
        ctx.beginPath(); ctx.moveTo(-15, -9); ctx.lineTo(-4, -6); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(15, -9); ctx.lineTo(4, -6); ctx.stroke();
        ctx.restore();

        ctx.restore(); // fin shake

        // Jauge de furie
        ctx.fillStyle = "#333";
        ctx.fillRect(20, 110, 100, 12);
        let furyColor = ball.furyMode ? "#ff0000" : "#ffaa00";
        ctx.fillStyle = furyColor; ctx.fillRect(20, 110, furyMeter, 12);
        ctx.strokeStyle = "#fff"; ctx.lineWidth = 1; ctx.strokeRect(20, 110, 100, 12);
        ctx.fillStyle = "#fff"; ctx.font = "10px monospace"; ctx.fillText("FURIE", 45, 120);

        // Score / Combo / Record
        ctx.fillStyle = "#ff9e00";
        ctx.font = "bold 20px 'Courier New', monospace";
        ctx.textAlign = "left";
        ctx.fillText("Score: " + score, 20, 40);
        if (comboMultiplier > 1) {
            ctx.fillStyle = "#ffdd00";
            ctx.font = "bold 18px 'Courier New', monospace";
            ctx.fillText("Combo x" + comboMultiplier, 20, 70);
        }
        ctx.fillStyle = "#aaa";
        ctx.font = "14px 'Courier New', monospace";
        ctx.fillText("Record: " + bestScore, 20, 95);

        // Game Over
        if (game.gameOver) {
            ctx.fillStyle = "rgba(0,0,0,0.75)";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = "#ff3c00";
            ctx.font = "bold 32px ui-sans-serif, system-ui, sans-serif";
            ctx.textAlign = "center";
            ctx.fillText("ÉNERGIE DISSIPÉE", canvas.width / 2, canvas.height / 2 - 10);
            ctx.fillStyle = "#fff";
            ctx.font = "16px ui-sans-serif, system-ui, sans-serif";
            ctx.fillText("Cliquez ou Espace pour renaître", canvas.width / 2, canvas.height / 2 + 25);
        }

        requestAnimationFrame(gameLoop);
    }

    // ---------- MENU / BOUTIQUE ----------
    function drawMenu() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#090201"; ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#ff9e00"; ctx.font = "bold 48px 'Courier New', monospace"; ctx.textAlign = "center";
        ctx.fillText("MANADASH", canvas.width / 2, 120);
        buttons = [];
        drawButton(canvas.width / 2 - 100, 200, 200, 50, "Jouer", startGame);
        drawButton(canvas.width / 2 - 100, 270, 200, 50, "Boutique", goToShop);
    }

    function drawButton(x, y, w, h, text, action) {
        ctx.fillStyle = "#ff6600"; ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = "#ffaa00"; ctx.lineWidth = 2; ctx.strokeRect(x, y, w, h);
        ctx.fillStyle = "#fff"; ctx.font = "20px 'Courier New', monospace"; ctx.textAlign = "center";
        ctx.fillText(text, x + w / 2, y + h / 2 + 6);
        buttons.push({ x, y, w, h, action });
    }

    function drawShop() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    
ctx.fillStyle = "#090201"; ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#ff9e00"; ctx.font = "bold 32px 'Courier New', monospace"; ctx.textAlign = "center";
        ctx.fillText("BOUTIQUE", canvas.width / 2, 60);
        ctx.fillStyle = "#ffcc00"; ctx.font = "18px 'Courier New', monospace";
        ctx.fillText("Pièces : " + playerCoins, canvas.width / 2, 100);
        buttons = [];
        for (let i = 0; i < shopSkins.length; i++) {
            let skin = shopSkins[i];
            let y = 140 + i * 80;
            ctx.fillStyle = "#1a0a00"; ctx.fillRect(100, y, 600, 60);
            ctx.strokeStyle = "#ff6600"; ctx.strokeRect(100, y, 600, 60);
            ctx.fillStyle = "#fff"; ctx.font = "20px 'Courier New', monospace"; ctx.textAlign = "left";
            ctx.fillText(skin.name, 120, y + 35);
            if (skin.owned) {
                ctx.fillStyle = "#00cc44"; ctx.fillRect(550, y + 15, 120, 30);
                ctx.fillStyle = "#fff"; ctx.fillText("Équipé", 610, y + 35);
            } else {
                ctx.fillStyle = "#ffaa00"; ctx.fillRect(550, y + 15, 120, 30);
                ctx.fillStyle = "#000"; ctx.fillText(playerCoins >= skin.price ? "Acheter " + skin.price : "Pas assez", 610, y + 35);
            }
        }
        drawButton(canvas.width / 2 - 50, 400, 100, 40, "Retour", goToMenu);
    }

    function hexToRgb(hex) {
        let r = parseInt(hex.slice(1, 3), 16),
            g = parseInt(hex.slice(3, 5), 16),
            b = parseInt(hex.slice(5, 7), 16);
        return `${r},${g},${b}`;
    }

    gameLoop();
};
      

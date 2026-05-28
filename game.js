(() => {
  "use strict";

  const STORAGE_KEY = "stair-rush-kids-best";
  const GRAVITY = 1700;
  const BASE_SCROLL_SPEED = 120;
  const MAX_PLATFORMS = 16;

  const state = {
    mode: "start", // start | playing | paused | gameOver
    score: 0,
    bestScore: Number(localStorage.getItem(STORAGE_KEY) || 0),
    lives: 3,
    elapsed: 0,
  };

  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");
  const overlay = document.getElementById("overlay");
  const panelStart = document.getElementById("panelStart");
  const panelPaused = document.getElementById("panelPaused");
  const panelGameOver = document.getElementById("panelGameOver");

  const scoreValue = document.getElementById("scoreValue");
  const bestValue = document.getElementById("bestValue");
  const livesValue = document.getElementById("livesValue");
  const finalScore = document.getElementById("finalScore");

  const input = { left: false, right: false };

  const player = {
    x: 0,
    y: 0,
    width: 34,
    height: 42,
    vx: 0,
    vy: 0,
    speed: 280,
    bouncePower: -520,
    invincibleUntil: 0,
  };

  let world = { width: 0, height: 0 };
  let platforms = [];
  let lastTime = 0;
  let brokenQueue = [];

  const PLATFORM_TYPES = {
    normal: { color: "#7bd389" },
    broken: { color: "#ffcf6e" },
    bounce: { color: "#7db7ff" },
    danger: { color: "#ff6b8a" },
  };

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    world.width = rect.width;
    world.height = rect.height;
  }

  function randomType() {
    const r = Math.random();
    if (r < 0.6) return "normal";
    if (r < 0.78) return "broken";
    if (r < 0.9) return "bounce";
    return "danger";
  }

  function createPlatform(y) {
    const width = 80 + Math.random() * 56;
    return {
      x: Math.random() * (world.width - width),
      y,
      width,
      height: 14,
      type: randomType(),
      brokenAt: 0,
      active: true,
    };
  }

  function resetGame() {
    state.mode = "start";
    state.score = 0;
    state.lives = 3;
    state.elapsed = 0;
    brokenQueue = [];
    platforms = [];

    const step = world.height / MAX_PLATFORMS;
    for (let i = 0; i < MAX_PLATFORMS; i++) {
      platforms.push(createPlatform(i * step));
    }

    player.x = world.width / 2 - player.width / 2;
    player.y = 40;
    player.vx = 0;
    player.vy = 0;
    player.invincibleUntil = 0;
    updateHUD();
    showPanel("start");
  }

  function showPanel(mode) {
    const isVisible = mode !== "playing";
    overlay.classList.toggle("hidden", !isVisible);
    panelStart.classList.toggle("hidden", mode !== "start");
    panelPaused.classList.toggle("hidden", mode !== "paused");
    panelGameOver.classList.toggle("hidden", mode !== "gameOver");
  }

  function startPlaying() {
    state.mode = "playing";
    showPanel("playing");
  }

  function togglePause() {
    if (state.mode === "playing") {
      state.mode = "paused";
      showPanel("paused");
    } else if (state.mode === "paused") {
      startPlaying();
    }
  }

  function applyInput() {
    if (input.left === input.right) {
      player.vx = 0;
      return;
    }
    player.vx = input.left ? -player.speed : player.speed;
  }

  function updatePlayer(dt, nowMs) {
    applyInput();
    player.vy += GRAVITY * dt;
    player.x += player.vx * dt;
    player.y += player.vy * dt;

    if (player.x < 0) player.x = 0;
    if (player.x + player.width > world.width) player.x = world.width - player.width;

    if (player.y > world.height + 12) {
      loseLife(nowMs, "掉出畫面");
      return;
    }

    const prevBottom = player.y - player.vy * dt + player.height;
    const nextBottom = player.y + player.height;

    for (const p of platforms) {
      if (!p.active) continue;
      const isFalling = player.vy > 0;
      const overlapsX = player.x + player.width > p.x && player.x < p.x + p.width;
      const crossesY = prevBottom <= p.y && nextBottom >= p.y;
      if (isFalling && overlapsX && crossesY) {
        player.y = p.y - player.height;
        player.vy = 0;
        onPlatformStep(p, nowMs);
        break;
      }
    }

    if (nowMs < player.invincibleUntil) {
      state.elapsed += dt;
    }
  }

  function onPlatformStep(platform, nowMs) {
    if (platform.type === "broken" && platform.brokenAt === 0) {
      platform.brokenAt = nowMs;
      brokenQueue.push(platform);
    }

    if (platform.type === "bounce") {
      player.vy = player.bouncePower;
    }

    if (platform.type === "danger" && nowMs > player.invincibleUntil) {
      loseLife(nowMs, "碰到危險平台");
    }
  }

  function loseLife(nowMs) {
    state.lives -= 1;
    player.invincibleUntil = nowMs + 1200;
    player.vy = -280;
    if (state.lives <= 0) {
      gameOver();
    }
    updateHUD();
  }

  function updatePlatforms(dt, nowMs) {
    const difficulty = 1 + Math.min(state.score / 2500, 1.4);
    const scrollSpeed = BASE_SCROLL_SPEED * difficulty;

    for (const p of platforms) {
      p.y -= scrollSpeed * dt;
      if (p.brokenAt && nowMs - p.brokenAt > 400) {
        p.active = false;
      }
    }

    platforms = platforms.filter((p) => p.y + p.height > -20 && p.active);

    while (platforms.length < MAX_PLATFORMS) {
      const maxY = Math.max(...platforms.map((p) => p.y), world.height);
      const newP = createPlatform(maxY + 52 + Math.random() * 58);
      if (state.score > 800) {
        if (Math.random() < 0.16) newP.type = "danger";
      }
      platforms.push(newP);
    }

    state.score += dt * 45 + scrollSpeed * dt * 0.2;
    if (state.score > state.bestScore) {
      state.bestScore = Math.floor(state.score);
      localStorage.setItem(STORAGE_KEY, String(state.bestScore));
    }
    updateHUD();
  }

  function drawBackground() {
    ctx.clearRect(0, 0, world.width, world.height);
    ctx.fillStyle = "#d6f3ff";
    ctx.fillRect(0, 0, world.width, world.height);

    // 可愛雲朵
    ctx.fillStyle = "#ffffffaa";
    for (let i = 0; i < 6; i++) {
      const x = (i * 130 + (state.elapsed * 18) % 780) % (world.width + 120) - 60;
      const y = 30 + (i % 3) * 40;
      ctx.beginPath();
      ctx.arc(x, y, 18, 0, Math.PI * 2);
      ctx.arc(x + 18, y + 4, 14, 0, Math.PI * 2);
      ctx.arc(x - 16, y + 5, 12, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawPlatform(p) {
    ctx.fillStyle = PLATFORM_TYPES[p.type].color;
    ctx.fillRect(p.x, p.y, p.width, p.height);

    if (p.type === "broken") {
      ctx.strokeStyle = "#9a6d00";
      ctx.beginPath();
      ctx.moveTo(p.x + 8, p.y + 4);
      ctx.lineTo(p.x + p.width - 8, p.y + 10);
      ctx.stroke();
    } else if (p.type === "danger") {
      ctx.fillStyle = "#fff";
      for (let i = 0; i < p.width; i += 14) {
        ctx.fillRect(p.x + i, p.y, 7, p.height);
      }
    } else if (p.type === "bounce") {
      ctx.fillStyle = "#fff";
      ctx.fillRect(p.x + p.width / 2 - 8, p.y + 2, 16, 10);
    }
  }

  function drawPlayer(nowMs) {
    const flashing = nowMs < player.invincibleUntil && Math.floor(nowMs / 100) % 2 === 0;
    if (flashing) return;

    // 身體
    ctx.fillStyle = "#2a9d8f";
    ctx.fillRect(player.x, player.y + 12, player.width, player.height - 12);

    // 頭
    ctx.fillStyle = "#ffd6a5";
    ctx.beginPath();
    ctx.arc(player.x + player.width / 2, player.y + 9, 9, 0, Math.PI * 2);
    ctx.fill();

    // 眼睛
    ctx.fillStyle = "#2b2d42";
    ctx.fillRect(player.x + 11, player.y + 8, 2, 2);
    ctx.fillRect(player.x + 20, player.y + 8, 2, 2);
  }

  function render(nowMs) {
    drawBackground();
    platforms.forEach(drawPlatform);
    drawPlayer(nowMs);
  }

  function gameOver() {
    state.mode = "gameOver";
    finalScore.textContent = `你的分數：${Math.floor(state.score)}`;
    showPanel("gameOver");
  }

  function updateHUD() {
    scoreValue.textContent = String(Math.floor(state.score));
    bestValue.textContent = String(Math.floor(state.bestScore));
    livesValue.textContent = String(state.lives);
  }

  function loop(nowMs) {
    if (!lastTime) lastTime = nowMs;
    const dt = Math.min((nowMs - lastTime) / 1000, 0.033);
    lastTime = nowMs;

    if (state.mode === "playing") {
      state.elapsed += dt;
      updatePlayer(dt, nowMs);
      updatePlatforms(dt, nowMs);
    }

    render(nowMs);
    requestAnimationFrame(loop);
  }

  function bindInputs() {
    window.addEventListener("keydown", (e) => {
      const key = e.key.toLowerCase();
      if (["arrowleft", "arrowright", "a", "d", "p", " "].includes(key)) {
        e.preventDefault();
      }
      if (key === "arrowleft" || key === "a") input.left = true;
      if (key === "arrowright" || key === "d") input.right = true;
      if (key === "p") togglePause();
      if (key === " " && (state.mode === "start" || state.mode === "gameOver")) {
        startPlaying();
      }
    });

    window.addEventListener("keyup", (e) => {
      const key = e.key.toLowerCase();
      if (key === "arrowleft" || key === "a") input.left = false;
      if (key === "arrowright" || key === "d") input.right = false;
    });

    canvas.addEventListener("pointerdown", (e) => {
      if (state.mode !== "playing") return;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      input.left = x < rect.width / 2;
      input.right = !input.left;
    });

    canvas.addEventListener("pointerup", () => {
      input.left = false;
      input.right = false;
    });

    canvas.addEventListener("pointercancel", () => {
      input.left = false;
      input.right = false;
    });

    document.getElementById("startBtn").addEventListener("click", startPlaying);
    document.getElementById("resumeBtn").addEventListener("click", startPlaying);
    document.getElementById("retryBtn").addEventListener("click", () => {
      resetGame();
      startPlaying();
    });
    document.getElementById("restartBtn").addEventListener("click", () => {
      resetGame();
      startPlaying();
    });
    document.getElementById("pauseBtn").addEventListener("click", togglePause);

    window.addEventListener("resize", () => {
      resizeCanvas();
      resetGame();
    });
  }

  function init() {
    resizeCanvas();
    bindInputs();
    updateHUD();
    resetGame();
    requestAnimationFrame(loop);
  }

  init();
})();

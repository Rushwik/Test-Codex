const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const scoreEl = document.getElementById("score");
const ballsLeftEl = document.getElementById("balls-left");
const restartBtn = document.getElementById("restart-btn");

const gravity = 0.24;
const friction = 0.995;
const bounce = 0.87;
const bumperBounce = 1.06;

const walls = {
  left: 22,
  right: canvas.width - 22,
  top: 22,
  bottomDrain: canvas.height - 12,
};

const bumpers = [
  { x: 160, y: 180, r: 28, score: 100 },
  { x: 320, y: 180, r: 28, score: 100 },
  { x: 240, y: 290, r: 34, score: 150 },
  { x: 125, y: 340, r: 26, score: 120 },
  { x: 355, y: 340, r: 26, score: 120 },
];

const leftSlingshot = [
  { x: 60, y: 500 },
  { x: 150, y: 470 },
  { x: 108, y: 558 },
];

const rightSlingshot = [
  { x: 420, y: 500 },
  { x: 330, y: 470 },
  { x: 372, y: 558 },
];

const flipperConfig = {
  length: 88,
  width: 16,
  leftPivot: { x: 176, y: 625 },
  rightPivot: { x: 304, y: 625 },
  restLeft: 0.55,
  activeLeft: -0.28,
  restRight: Math.PI - 0.55,
  activeRight: Math.PI + 0.28,
};

const launchLane = {
  x: canvas.width - 46,
  width: 28,
  top: 34,
  bottom: canvas.height - 60,
};

const gameState = {
  score: 0,
  ballsLeft: 3,
  leftPressed: false,
  rightPressed: false,
  launcherPower: 0,
  chargingLauncher: false,
  lost: false,
};

const ball = {
  x: launchLane.x + launchLane.width / 2,
  y: launchLane.bottom,
  vx: 0,
  vy: 0,
  r: 10,
  inPlay: false,
};

const flippers = {
  left: { angle: flipperConfig.restLeft },
  right: { angle: flipperConfig.restRight },
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function resetBall() {
  ball.x = launchLane.x + launchLane.width / 2;
  ball.y = launchLane.bottom;
  ball.vx = 0;
  ball.vy = 0;
  ball.inPlay = false;
  gameState.launcherPower = 0;
}

function resetGame() {
  gameState.score = 0;
  gameState.ballsLeft = 3;
  gameState.lost = false;
  resetBall();
  updateHud();
}

function updateHud() {
  scoreEl.textContent = String(gameState.score);
  ballsLeftEl.textContent = String(gameState.ballsLeft);
}

function rotateToward(current, target, speed = 0.18) {
  return current + (target - current) * speed;
}

function distance(ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  return Math.hypot(dx, dy);
}

function ballVsCircle(cx, cy, cr, power = 1, scoreValue = 0) {
  const d = distance(ball.x, ball.y, cx, cy);
  const overlap = ball.r + cr - d;
  if (overlap > 0) {
    const nx = (ball.x - cx) / d;
    const ny = (ball.y - cy) / d;

    ball.x += nx * overlap;
    ball.y += ny * overlap;

    const dot = ball.vx * nx + ball.vy * ny;
    ball.vx -= 2 * dot * nx;
    ball.vy -= 2 * dot * ny;
    ball.vx *= power;
    ball.vy *= power;

    if (scoreValue > 0) {
      gameState.score += scoreValue;
      updateHud();
    }
  }
}

function closestPointOnSegment(px, py, ax, ay, bx, by) {
  const abx = bx - ax;
  const aby = by - ay;
  const abLenSq = abx * abx + aby * aby;
  const t = clamp(((px - ax) * abx + (py - ay) * aby) / abLenSq, 0, 1);
  return { x: ax + abx * t, y: ay + aby * t };
}

function collideTriangle(triangle, kick = 1.03) {
  for (let i = 0; i < triangle.length; i += 1) {
    const a = triangle[i];
    const b = triangle[(i + 1) % triangle.length];
    const p = closestPointOnSegment(ball.x, ball.y, a.x, a.y, b.x, b.y);

    const dx = ball.x - p.x;
    const dy = ball.y - p.y;
    const dist = Math.hypot(dx, dy);
    if (dist < ball.r) {
      const nx = dx / (dist || 0.0001);
      const ny = dy / (dist || 0.0001);
      const overlap = ball.r - dist;
      ball.x += nx * overlap;
      ball.y += ny * overlap;

      const dot = ball.vx * nx + ball.vy * ny;
      ball.vx -= 2 * dot * nx;
      ball.vy -= 2 * dot * ny;
      ball.vx *= kick;
      ball.vy *= kick;
      gameState.score += 30;
      updateHud();
    }
  }
}

function collideFlipper(isLeft) {
  const pivot = isLeft ? flipperConfig.leftPivot : flipperConfig.rightPivot;
  const angle = isLeft ? flippers.left.angle : flippers.right.angle;
  const tipX = pivot.x + Math.cos(angle) * flipperConfig.length;
  const tipY = pivot.y + Math.sin(angle) * flipperConfig.length;

  const p = closestPointOnSegment(ball.x, ball.y, pivot.x, pivot.y, tipX, tipY);
  const dx = ball.x - p.x;
  const dy = ball.y - p.y;
  const dist = Math.hypot(dx, dy);

  if (dist < ball.r + flipperConfig.width / 2) {
    const nx = dx / (dist || 0.0001);
    const ny = dy / (dist || 0.0001);
    const overlap = ball.r + flipperConfig.width / 2 - dist;

    ball.x += nx * overlap;
    ball.y += ny * overlap;

    const dot = ball.vx * nx + ball.vy * ny;
    ball.vx -= 2 * dot * nx;
    ball.vy -= 2 * dot * ny;

    const movingUp = isLeft ? gameState.leftPressed : gameState.rightPressed;
    if (movingUp) {
      ball.vx += Math.cos(angle) * 1.5;
      ball.vy += Math.sin(angle) * 1.5;
      ball.vy -= 5.8;
      gameState.score += 20;
      updateHud();
    }
  }
}

function handlePhysics() {
  if (!ball.inPlay || gameState.lost) return;

  ball.vy += gravity;
  ball.vx *= friction;
  ball.vy *= friction;

  ball.x += ball.vx;
  ball.y += ball.vy;

  if (ball.x - ball.r < walls.left) {
    ball.x = walls.left + ball.r;
    ball.vx *= -bounce;
  }

  if (ball.x + ball.r > walls.right && ball.x < launchLane.x - 2) {
    ball.x = walls.right - ball.r;
    ball.vx *= -bounce;
  }

  if (ball.y - ball.r < walls.top) {
    ball.y = walls.top + ball.r;
    ball.vy *= -bounce;
  }

  if (
    ball.inPlay &&
    ball.x > launchLane.x &&
    ball.x < launchLane.x + launchLane.width &&
    ball.y > launchLane.top
  ) {
    ball.x = clamp(ball.x, launchLane.x + ball.r, launchLane.x + launchLane.width - ball.r);
  }

  bumpers.forEach((bumper) => ballVsCircle(bumper.x, bumper.y, bumper.r, bumperBounce, bumper.score));

  collideTriangle(leftSlingshot, 1.04);
  collideTriangle(rightSlingshot, 1.04);
  collideFlipper(true);
  collideFlipper(false);

  if (ball.y - ball.r > walls.bottomDrain) {
    gameState.ballsLeft -= 1;
    updateHud();

    if (gameState.ballsLeft <= 0) {
      gameState.lost = true;
    }

    resetBall();
  }
}

function updateFlippers() {
  const leftTarget = gameState.leftPressed ? flipperConfig.activeLeft : flipperConfig.restLeft;
  const rightTarget = gameState.rightPressed ? flipperConfig.activeRight : flipperConfig.restRight;

  flippers.left.angle = rotateToward(flippers.left.angle, leftTarget, 0.32);
  flippers.right.angle = rotateToward(flippers.right.angle, rightTarget, 0.32);
}

function updateLauncher() {
  if (gameState.chargingLauncher && !ball.inPlay && !gameState.lost) {
    gameState.launcherPower = clamp(gameState.launcherPower + 0.35, 0, 18);
  }
}

function drawPolygon(points, fillStyle) {
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i += 1) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.closePath();
  ctx.fillStyle = fillStyle;
  ctx.fill();
}

function drawFlipper(isLeft) {
  const pivot = isLeft ? flipperConfig.leftPivot : flipperConfig.rightPivot;
  const angle = isLeft ? flippers.left.angle : flippers.right.angle;

  ctx.save();
  ctx.translate(pivot.x, pivot.y);
  ctx.rotate(angle);

  ctx.beginPath();
  ctx.roundRect(0, -flipperConfig.width / 2, flipperConfig.length, flipperConfig.width, 8);
  ctx.fillStyle = isLeft ? "#84d4ff" : "#ff8cc3";
  ctx.fill();

  ctx.restore();

  ctx.beginPath();
  ctx.arc(pivot.x, pivot.y, 8, 0, Math.PI * 2);
  ctx.fillStyle = "#d8e4ff";
  ctx.fill();
}

function drawBoard() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "rgba(255,255,255,0.07)";
  ctx.fillRect(launchLane.x, launchLane.top, launchLane.width, launchLane.bottom - launchLane.top);

  ctx.strokeStyle = "rgba(220, 232, 255, 0.5)";
  ctx.lineWidth = 2;
  ctx.strokeRect(walls.left, walls.top, walls.right - walls.left, walls.bottomDrain - walls.top);

  bumpers.forEach((bumper) => {
    const gradient = ctx.createRadialGradient(
      bumper.x - 4,
      bumper.y - 6,
      8,
      bumper.x,
      bumper.y,
      bumper.r
    );
    gradient.addColorStop(0, "#fff69c");
    gradient.addColorStop(1, "#ff8a3d");

    ctx.beginPath();
    ctx.arc(bumper.x, bumper.y, bumper.r, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(bumper.x, bumper.y, bumper.r + 4, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255, 205, 120, 0.7)";
    ctx.stroke();
  });

  drawPolygon(leftSlingshot, "#7ec6ff");
  drawPolygon(rightSlingshot, "#ff84bf");

  drawFlipper(true);
  drawFlipper(false);

  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
  ctx.fillStyle = "#f5f8ff";
  ctx.fill();

  if (!ball.inPlay && !gameState.lost) {
    const meterHeight = 120;
    const percent = gameState.launcherPower / 18;
    ctx.fillStyle = "rgba(14, 26, 48, 0.85)";
    ctx.fillRect(launchLane.x - 16, launchLane.bottom - meterHeight, 10, meterHeight);
    ctx.fillStyle = "#84ffd0";
    ctx.fillRect(
      launchLane.x - 16,
      launchLane.bottom - meterHeight + (1 - percent) * meterHeight,
      10,
      percent * meterHeight
    );
  }

  if (gameState.lost) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.textAlign = "center";
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 36px system-ui";
    ctx.fillText("Game Over", canvas.width / 2, canvas.height / 2 - 20);
    ctx.font = "20px system-ui";
    ctx.fillText(`Final Score: ${gameState.score}`, canvas.width / 2, canvas.height / 2 + 20);
  }
}

function gameLoop() {
  updateFlippers();
  updateLauncher();
  handlePhysics();
  drawBoard();
  requestAnimationFrame(gameLoop);
}

window.addEventListener("keydown", (event) => {
  if (event.repeat) return;

  if (event.code === "ArrowLeft") {
    gameState.leftPressed = true;
  } else if (event.code === "ArrowRight") {
    gameState.rightPressed = true;
  } else if (event.code === "Space") {
    event.preventDefault();
    if (!ball.inPlay && !gameState.lost) {
      gameState.chargingLauncher = true;
    }
  }
});

window.addEventListener("keyup", (event) => {
  if (event.code === "ArrowLeft") {
    gameState.leftPressed = false;
  } else if (event.code === "ArrowRight") {
    gameState.rightPressed = false;
  } else if (event.code === "Space") {
    if (!ball.inPlay && !gameState.lost) {
      ball.inPlay = true;
      ball.vy = -Math.max(7, gameState.launcherPower);
      ball.vx = -1.2;
      gameState.launcherPower = 0;
    }
    gameState.chargingLauncher = false;
  }
});

restartBtn.addEventListener("click", resetGame);

resetGame();
gameLoop();

(function () {
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');

  const scoreEl = document.getElementById('score');
  const livesEl = document.getElementById('lives');
  const levelEl = document.getElementById('level');
  const overlay = document.getElementById('overlay');
  const overlayTitle = document.getElementById('overlayTitle');
  const overlaySub = document.getElementById('overlaySub');
  const startBtn = document.getElementById('startBtn');
  const pauseBtn = document.getElementById('pauseBtn');

  const WIDTH = canvas.width;
  const HEIGHT = canvas.height;

  const BRICK_ROWS = 5;
  const BRICK_COLS = 8;
  const BRICK_WIDTH = 68;
  const BRICK_HEIGHT = 20;
  const BRICK_GAP = 6;
  const BRICK_OFFSET_TOP = 50;
  const BRICK_OFFSET_LEFT = (WIDTH - (BRICK_COLS * (BRICK_WIDTH + BRICK_GAP) - BRICK_GAP)) / 2;

  const ROW_COLORS = ['#f87171', '#fb923c', '#facc15', '#4ade80', '#38bdf8'];

  let paddle, ball, bricks;
  let score = 0;
  let lives = 3;
  let level = 1;
  let running = false;
  let paused = false;
  let animId = null;

  function createPaddle() {
    return {
      width: 90,
      height: 12,
      x: (WIDTH - 90) / 2,
      y: HEIGHT - 30,
      speed: 7,
      dx: 0
    };
  }

  function createBall() {
    return {
      x: WIDTH / 2,
      y: HEIGHT - 45,
      radius: 7,
      speed: 4.5 + (level - 1) * 0.4,
      dx: (4.5 + (level - 1) * 0.4) * (Math.random() > 0.5 ? 1 : -1),
      dy: -(4.5 + (level - 1) * 0.4)
    };
  }

  function createBricks() {
    const arr = [];
    for (let r = 0; r < BRICK_ROWS; r++) {
      const row = [];
      for (let c = 0; c < BRICK_COLS; c++) {
        row.push({
          x: BRICK_OFFSET_LEFT + c * (BRICK_WIDTH + BRICK_GAP),
          y: BRICK_OFFSET_TOP + r * (BRICK_HEIGHT + BRICK_GAP),
          width: BRICK_WIDTH,
          height: BRICK_HEIGHT,
          alive: true,
          color: ROW_COLORS[r % ROW_COLORS.length],
          points: (BRICK_ROWS - r) * 10
        });
      }
      arr.push(row);
    }
    return arr;
  }

  function resetBoard(keepScore) {
    paddle = createPaddle();
    ball = createBall();
    bricks = createBricks();
    if (!keepScore) {
      score = 0;
      lives = 3;
      level = 1;
    }
    updateHud();
  }

  function updateHud() {
    scoreEl.textContent = score;
    livesEl.textContent = lives;
    levelEl.textContent = level;
  }

  function showOverlay(title, sub) {
    overlayTitle.textContent = title;
    overlaySub.textContent = sub;
    overlay.classList.remove('hidden');
  }

  function hideOverlay() {
    overlay.classList.add('hidden');
  }

  function drawPaddle() {
    const grad = ctx.createLinearGradient(paddle.x, 0, paddle.x + paddle.width, 0);
    grad.addColorStop(0, '#38bdf8');
    grad.addColorStop(1, '#0ea5e9');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(paddle.x, paddle.y, paddle.width, paddle.height, 6);
    ctx.fill();
  }

  function drawBall() {
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
    ctx.fillStyle = '#facc15';
    ctx.shadowColor = '#facc15';
    ctx.shadowBlur = 10;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.closePath();
  }

  function drawBricks() {
    bricks.forEach((row) => {
      row.forEach((b) => {
        if (!b.alive) return;
        ctx.fillStyle = b.color;
        ctx.beginPath();
        ctx.roundRect(b.x, b.y, b.width, b.height, 4);
        ctx.fill();
      });
    });
  }

  function drawBackground() {
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
  }

  function collideBrick() {
    bricks.forEach((row) => {
      row.forEach((b) => {
        if (!b.alive) return;
        if (
          ball.x + ball.radius > b.x &&
          ball.x - ball.radius < b.x + b.width &&
          ball.y + ball.radius > b.y &&
          ball.y - ball.radius < b.y + b.height
        ) {
          b.alive = false;
          score += b.points;
          updateHud();

          const overlapLeft = ball.x + ball.radius - b.x;
          const overlapRight = b.x + b.width - (ball.x - ball.radius);
          const overlapTop = ball.y + ball.radius - b.y;
          const overlapBottom = b.y + b.height - (ball.y - ball.radius);
          const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);

          if (minOverlap === overlapTop || minOverlap === overlapBottom) {
            ball.dy *= -1;
          } else {
            ball.dx *= -1;
          }
        }
      });
    });
  }

  function allBricksCleared() {
    return bricks.every((row) => row.every((b) => !b.alive));
  }

  function update() {
    // paddle movement
    paddle.x += paddle.dx;
    if (paddle.x < 0) paddle.x = 0;
    if (paddle.x + paddle.width > WIDTH) paddle.x = WIDTH - paddle.width;

    // ball movement
    ball.x += ball.dx;
    ball.y += ball.dy;

    // wall collisions
    if (ball.x - ball.radius < 0) {
      ball.x = ball.radius;
      ball.dx *= -1;
    } else if (ball.x + ball.radius > WIDTH) {
      ball.x = WIDTH - ball.radius;
      ball.dx *= -1;
    }
    if (ball.y - ball.radius < 0) {
      ball.y = ball.radius;
      ball.dy *= -1;
    }

    // paddle collision
    if (
      ball.y + ball.radius >= paddle.y &&
      ball.y + ball.radius <= paddle.y + paddle.height &&
      ball.x >= paddle.x &&
      ball.x <= paddle.x + paddle.width &&
      ball.dy > 0
    ) {
      const hitPos = (ball.x - (paddle.x + paddle.width / 2)) / (paddle.width / 2);
      const angle = hitPos * (Math.PI / 3); // max 60 degrees
      const speed = Math.hypot(ball.dx, ball.dy);
      ball.dx = speed * Math.sin(angle);
      ball.dy = -Math.abs(speed * Math.cos(angle));
    }

    collideBrick();

    // bottom - lose life
    if (ball.y - ball.radius > HEIGHT) {
      lives--;
      updateHud();
      if (lives <= 0) {
        endGame(false);
        return;
      } else {
        ball = createBall();
        paddle = createPaddle();
      }
    }

    if (allBricksCleared()) {
      level++;
      bricks = createBricks();
      ball = createBall();
      paddle = createPaddle();
      updateHud();
      showOverlay('레벨 ' + level + '!', '3초 후 계속됩니다...');
      paused = true;
      setTimeout(() => {
        if (running) {
          hideOverlay();
          paused = false;
        }
      }, 2000);
    }
  }

  function draw() {
    drawBackground();
    drawBricks();
    drawPaddle();
    drawBall();
  }

  function loop() {
    if (!running) return;
    if (!paused) {
      update();
      draw();
    }
    animId = requestAnimationFrame(loop);
  }

  function startGame() {
    if (running) return;
    resetBoard(false);
    running = true;
    paused = false;
    hideOverlay();
    draw();
    animId = requestAnimationFrame(loop);
  }

  function endGame(won) {
    running = false;
    if (animId) cancelAnimationFrame(animId);
    if (won) {
      showOverlay('승리!', '점수: ' + score);
    } else {
      showOverlay('게임 오버', '최종 점수: ' + score + ' — 다시 시작하려면 시작 버튼을 누르세요');
    }
  }

  function togglePause() {
    if (!running) return;
    paused = !paused;
    if (paused) {
      showOverlay('일시정지', '일시정지 버튼을 눌러 계속하세요');
    } else {
      hideOverlay();
    }
  }

  // controls
  const keys = {};
  document.addEventListener('keydown', (e) => {
    keys[e.key] = true;
    if (e.key === 'ArrowLeft') paddle && (paddle.dx = -paddle.speed);
    if (e.key === 'ArrowRight') paddle && (paddle.dx = paddle.speed);
  });
  document.addEventListener('keyup', (e) => {
    keys[e.key] = false;
    if ((e.key === 'ArrowLeft' && paddle.dx < 0) || (e.key === 'ArrowRight' && paddle.dx > 0)) {
      paddle.dx = 0;
    }
  });

  canvas.addEventListener('mousemove', (e) => {
    if (!paddle) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    paddle.x = Math.min(Math.max(mouseX - paddle.width / 2, 0), WIDTH - paddle.width);
  });

  startBtn.addEventListener('click', startGame);
  pauseBtn.addEventListener('click', togglePause);

  // initial board render (idle)
  resetBoard(false);
  draw();
})();

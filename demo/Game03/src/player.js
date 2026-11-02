import {
  PLAYER_SPEED,
  PLAYER_WIDTH,
  PLAYER_HEIGHT,
  PLAYER_START_LIVES,
  PLAYER_INVINCIBLE_TIME,
  ZAP_COOLDOWN,
  BOMB_COOLDOWN,
  BOMB_LEAD_DISTANCE,
  BOMB_BASE_RADIUS,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
} from "./constants.js";
import { ZapBullet, Bomb } from "./bullet.js";

export class Player {
  constructor() {
    this.x = CANVAS_WIDTH / 2;
    this.y = CANVAS_HEIGHT - 100;
    this.w = PLAYER_WIDTH;
    this.h = PLAYER_HEIGHT;
    this.lives = PLAYER_START_LIVES;
    this.invincibleTimer = 0;
    this.zapTimer = 0;
    this.bombTimer = 0;
    this.shotLevel = 0;
    this.bombRadiusBonus = 0;
    this.animTime = 0;
  }

  get crosshairX() {
    return this.x;
  }

  get crosshairY() {
    return this.y - BOMB_LEAD_DISTANCE;
  }

  get hitbox() {
    return { x: this.x, y: this.y, w: this.w * 0.6, h: this.h * 0.6 };
  }

  update(dt, input) {
    let dx = 0;
    let dy = 0;
    if (input.isDown("ArrowLeft") || input.isDown("KeyA")) dx -= 1;
    if (input.isDown("ArrowRight") || input.isDown("KeyD")) dx += 1;
    if (input.isDown("ArrowUp") || input.isDown("KeyW")) dy -= 1;
    if (input.isDown("ArrowDown") || input.isDown("KeyS")) dy += 1;
    if (dx !== 0 && dy !== 0) {
      dx *= Math.SQRT1_2;
      dy *= Math.SQRT1_2;
    }
    this.x += dx * PLAYER_SPEED * dt;
    this.y += dy * PLAYER_SPEED * dt;
    this.x = Math.max(this.w / 2, Math.min(CANVAS_WIDTH - this.w / 2, this.x));
    this.y = Math.max(this.h / 2, Math.min(CANVAS_HEIGHT - this.h / 2, this.y));

    if (this.zapTimer > 0) this.zapTimer -= dt;
    if (this.bombTimer > 0) this.bombTimer -= dt;
    if (this.invincibleTimer > 0) this.invincibleTimer -= dt;
    this.animTime += dt;
  }

  tryZap(input) {
    const firing = input.isDown("Space") || input.isDown("KeyZ");
    if (!firing || this.zapTimer > 0) return [];
    this.zapTimer = ZAP_COOLDOWN;
    const muzzleY = this.y - this.h / 2;
    if (this.shotLevel >= 2) {
      return [
        new ZapBullet(this.x, muzzleY, -70),
        new ZapBullet(this.x, muzzleY),
        new ZapBullet(this.x, muzzleY, 70),
      ];
    }
    if (this.shotLevel === 1) {
      return [new ZapBullet(this.x - 8, muzzleY), new ZapBullet(this.x + 8, muzzleY)];
    }
    return [new ZapBullet(this.x, muzzleY)];
  }

  tryBomb(input) {
    const firing =
      input.isDown("ShiftLeft") || input.isDown("ShiftRight") || input.isDown("KeyX");
    if (!firing || this.bombTimer > 0) return null;
    this.bombTimer = BOMB_COOLDOWN;
    return new Bomb(
      this.x,
      this.y,
      this.crosshairX,
      this.crosshairY,
      BOMB_BASE_RADIUS + this.bombRadiusBonus
    );
  }

  hit() {
    if (this.invincibleTimer > 0) return false;
    this.lives -= 1;
    this.invincibleTimer = PLAYER_INVINCIBLE_TIME;
    return true;
  }

  draw(ctx) {
    if (this.invincibleTimer > 0 && Math.floor(this.invincibleTimer * 12) % 2 === 0) {
      this.drawCrosshair(ctx);
      return;
    }
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.scale(1.3, 1.3);

    const w = this.w;
    const h = this.h;
    const flame = 5 + Math.sin(this.animTime * 22) * 2.5;

    const flameGrad = ctx.createLinearGradient(0, h / 2 - 2, 0, h / 2 + flame + 8);
    flameGrad.addColorStop(0, "rgba(255,230,140,0.95)");
    flameGrad.addColorStop(1, "rgba(255,110,40,0)");
    ctx.fillStyle = flameGrad;
    ctx.beginPath();
    ctx.moveTo(-4, h / 2 - 3);
    ctx.lineTo(4, h / 2 - 3);
    ctx.lineTo(0, h / 2 + flame + 8);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#3f7fb0";
    ctx.beginPath();
    ctx.moveTo(-2, 1);
    ctx.lineTo(-w / 2 - 5, h / 2 - 3);
    ctx.lineTo(-7, h / 2 - 6);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(2, 1);
    ctx.lineTo(w / 2 + 5, h / 2 - 3);
    ctx.lineTo(7, h / 2 - 6);
    ctx.closePath();
    ctx.fill();

    const bodyGrad = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
    bodyGrad.addColorStop(0, "#3f8fc0");
    bodyGrad.addColorStop(0.5, "#cdf3ff");
    bodyGrad.addColorStop(1, "#3f8fc0");
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.moveTo(0, -h / 2 - 3);
    ctx.quadraticCurveTo(w / 3, -h / 8, w / 4.5, h / 2 - 2);
    ctx.lineTo(-w / 4.5, h / 2 - 2);
    ctx.quadraticCurveTo(-w / 3, -h / 8, 0, -h / 2 - 3);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(15,50,80,0.6)";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = "#0a2a3a";
    ctx.beginPath();
    ctx.ellipse(0, -h / 6, 3, 6.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.beginPath();
    ctx.ellipse(-1, -h / 6 - 2.5, 1.2, 2.6, 0, 0, Math.PI * 2);
    ctx.fill();

    const blink = Math.sin(this.animTime * 6) > 0;
    ctx.fillStyle = blink ? "#ff5050" : "#661010";
    ctx.beginPath();
    ctx.arc(-w / 2 - 5, h / 2 - 3, 1.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = blink ? "#50ff70" : "#106622";
    ctx.beginPath();
    ctx.arc(w / 2 + 5, h / 2 - 3, 1.7, 0, Math.PI * 2);
    ctx.fill();

    if (this.shotLevel >= 1) {
      ctx.fillStyle = "#ffdd55";
      ctx.fillRect(-w / 2 - 3, h / 5, 3, 7);
      ctx.fillRect(w / 2, h / 5, 3, 7);
    }
    if (this.shotLevel >= 2) {
      ctx.fillStyle = "#ffb020";
      ctx.beginPath();
      ctx.moveTo(0, -h / 2 - 3);
      ctx.lineTo(-3, -h / 2 + 4);
      ctx.lineTo(3, -h / 2 + 4);
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();

    this.drawCrosshair(ctx);
  }

  drawCrosshair(ctx) {
    ctx.strokeStyle = "#ff5";
    ctx.lineWidth = 2;
    const cx = this.crosshairX;
    const cy = this.crosshairY;
    ctx.beginPath();
    ctx.moveTo(cx - 8, cy);
    ctx.lineTo(cx + 8, cy);
    ctx.moveTo(cx, cy - 8);
    ctx.lineTo(cx, cy + 8);
    ctx.stroke();
  }
}

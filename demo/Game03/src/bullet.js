import { ZAP_SPEED, ZAP_WIDTH, ZAP_HEIGHT, ENEMY_BULLET_SPEED, BOMB_TRAVEL_TIME } from "./constants.js";

export class ZapBullet {
  constructor(x, y, vx = 0) {
    this.x = x;
    this.y = y;
    this.w = ZAP_WIDTH;
    this.h = ZAP_HEIGHT;
    this.vx = vx;
    this.vy = -ZAP_SPEED;
    this.alive = true;
  }

  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (this.y < -20) this.alive = false;
  }

  draw(ctx) {
    ctx.fillStyle = "#8ff";
    ctx.fillRect(this.x - this.w / 2, this.y - this.h / 2, this.w, this.h);
  }
}

export class EnemyBullet {
  constructor(x, y, dirX, dirY) {
    this.x = x;
    this.y = y;
    this.w = 6;
    this.h = 6;
    const len = Math.hypot(dirX, dirY) || 1;
    this.vx = (dirX / len) * ENEMY_BULLET_SPEED;
    this.vy = (dirY / len) * ENEMY_BULLET_SPEED;
    this.alive = true;
  }

  update(dt, bounds) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (
      this.y > bounds.height + 20 ||
      this.y < -20 ||
      this.x < -20 ||
      this.x > bounds.width + 20
    ) {
      this.alive = false;
    }
  }

  draw(ctx) {
    ctx.fillStyle = "#f55";
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.w / 2, 0, Math.PI * 2);
    ctx.fill();
  }
}

export class Bomb {
  constructor(startX, startY, targetX, targetY, radius) {
    this.startX = startX;
    this.startY = startY;
    this.targetX = targetX;
    this.targetY = targetY;
    this.x = startX;
    this.y = startY;
    this.t = 0;
    this.duration = BOMB_TRAVEL_TIME;
    this.radius = radius;
    this.scale = 1;
    this.exploded = false;
    this.explosionTimer = 0;
    this.alive = true;
    this.w = 8;
    this.h = 8;
  }

  update(dt) {
    if (!this.exploded) {
      this.t += dt;
      const p = Math.min(this.t / this.duration, 1);
      this.x = this.startX + (this.targetX - this.startX) * p;
      this.y = this.startY + (this.targetY - this.startY) * p;
      this.scale = 1 - 0.5 * Math.sin(p * Math.PI);
      if (p >= 1) this.exploded = true;
    } else {
      this.explosionTimer += dt;
      if (this.explosionTimer > 0.25) this.alive = false;
    }
  }

  draw(ctx) {
    if (!this.exploded) {
      ctx.fillStyle = "#ffd23f";
      ctx.beginPath();
      ctx.arc(this.x, this.y, 5 * this.scale, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    const p = this.explosionTimer / 0.25;
    ctx.strokeStyle = `rgba(255,180,60,${1 - p})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius * p, 0, Math.PI * 2);
    ctx.stroke();
  }
}

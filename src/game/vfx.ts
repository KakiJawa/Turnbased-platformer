export interface Particle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  gravity: number;
}

export interface FloatingPopup {
  active: boolean;
  x: number;
  y: number;
  vy: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
  scale: number;
}

export interface ShockwaveRing {
  active: boolean;
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  color: string;
  life: number;
  maxLife: number;
}

export class VfxManager {
  private particles: Particle[];
  private particleHead = 0;
  private popups: FloatingPopup[];
  private popupHead = 0;
  private rings: ShockwaveRing[];
  private ringHead = 0;

  public hitstop = 0;
  public trauma = 0;
  public flashAlpha = 0;
  public flashColor = '#ffffff';

  constructor(particleCapacity = 160, popupCapacity = 24, ringCapacity = 12) {
    this.particles = Array.from({ length: particleCapacity }, () => ({
      active: false,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      life: 0,
      maxLife: 1,
      size: 2,
      color: '#ffffff',
      gravity: 0,
    }));
    this.popups = Array.from({ length: popupCapacity }, () => ({
      active: false,
      x: 0,
      y: 0,
      vy: -20,
      text: '',
      color: '#ffffff',
      life: 0,
      maxLife: 1,
      scale: 1,
    }));
    this.rings = Array.from({ length: ringCapacity }, () => ({
      active: false,
      x: 0,
      y: 0,
      radius: 2,
      maxRadius: 32,
      color: '#ffffff',
      life: 0,
      maxLife: 0.35,
    }));
  }

  public addTrauma(amount: number) {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  public triggerHitstop(seconds: number) {
    this.hitstop = Math.max(this.hitstop, seconds);
  }

  public triggerFlash(color: string, alpha = 0.45) {
    this.flashColor = color;
    this.flashAlpha = Math.max(this.flashAlpha, alpha);
  }

  public spawnBurst(
    x: number,
    y: number,
    count: number,
    color: string,
    speed = 70,
    gravity = 130,
    size = 2
  ) {
    for (let i = 0; i < count; i++) {
      const p = this.particles[this.particleHead];
      this.particleHead = (this.particleHead + 1) % this.particles.length;
      const angle = Math.random() * Math.PI * 2;
      const spd = speed * (0.35 + Math.random() * 0.85);
      p.active = true;
      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * spd;
      p.vy = Math.sin(angle) * spd - 20;
      p.maxLife = 0.25 + Math.random() * 0.35;
      p.life = p.maxLife;
      p.size = size + (Math.random() > 0.7 ? 1 : 0);
      p.color = color;
      p.gravity = gravity;
    }
  }

  public spawnPopup(
    x: number,
    y: number,
    text: string,
    color = '#ffffff',
    scale = 1
  ) {
    const pop = this.popups[this.popupHead];
    this.popupHead = (this.popupHead + 1) % this.popups.length;
    pop.active = true;
    pop.x = x + (Math.random() - 0.5) * 14;
    pop.y = y;
    pop.vy = -26;
    pop.text = text;
    pop.color = color;
    pop.maxLife = 0.85;
    pop.life = 0.85;
    pop.scale = scale;
  }

  public spawnRing(x: number, y: number, maxRadius: number, color: string) {
    const r = this.rings[this.ringHead];
    this.ringHead = (this.ringHead + 1) % this.rings.length;
    r.active = true;
    r.x = x;
    r.y = y;
    r.radius = 4;
    r.maxRadius = maxRadius;
    r.color = color;
    r.maxLife = 0.32;
    r.life = 0.32;
  }

  public update(dt: number) {
    if (this.hitstop > 0) {
      this.hitstop = Math.max(0, this.hitstop - dt);
    }
    this.trauma = Math.max(0, this.trauma - dt * 1.9);
    this.flashAlpha = Math.max(0, this.flashAlpha - dt * 2.8);

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        continue;
      }
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }

    for (let i = 0; i < this.popups.length; i++) {
      const pop = this.popups[i];
      if (!pop.active) continue;
      pop.life -= dt;
      if (pop.life <= 0) {
        pop.active = false;
        continue;
      }
      pop.y += pop.vy * dt;
      pop.vy *= 0.94;
    }

    for (let i = 0; i < this.rings.length; i++) {
      const r = this.rings[i];
      if (!r.active) continue;
      r.life -= dt;
      if (r.life <= 0) {
        r.active = false;
        continue;
      }
      const prog = 1 - r.life / r.maxLife;
      r.radius = 4 + (r.maxRadius - 4) * prog;
    }
  }

  public getShakeOffset(): { ox: number; oy: number } {
    if (this.trauma <= 0.001) return { ox: 0, oy: 0 };
    const mag = this.trauma * this.trauma * 7;
    return {
      ox: Math.round((Math.random() * 2 - 1) * mag),
      oy: Math.round((Math.random() * 2 - 1) * mag),
    };
  }

  public render(ctx: CanvasRenderingContext2D) {
    // Shockwave rings
    for (let i = 0; i < this.rings.length; i++) {
      const r = this.rings[i];
      if (!r.active) continue;
      ctx.save();
      ctx.globalAlpha = Math.max(0, r.life / r.maxLife);
      ctx.strokeStyle = r.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(Math.round(r.x), Math.round(r.y), Math.round(r.radius), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Crisp pixel particles
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      if (!p.active) continue;
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
    }

    // Floating combat popups
    for (let i = 0; i < this.popups.length; i++) {
      const pop = this.popups[i];
      if (!pop.active) continue;
      ctx.save();
      ctx.globalAlpha = Math.min(1, (pop.life / pop.maxLife) * 1.5);
      const px = Math.round(pop.x);
      const py = Math.round(pop.y);
      ctx.font = `bold ${Math.round(9 * pop.scale)}px "Silkscreen", monospace`;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#0e0b16';
      ctx.fillText(pop.text, px + 1, py + 1);
      ctx.fillText(pop.text, px - 1, py);
      ctx.fillStyle = pop.color;
      ctx.fillText(pop.text, px, py);
      ctx.restore();
    }

    if (this.flashAlpha > 0.01) {
      ctx.save();
      ctx.globalAlpha = this.flashAlpha;
      ctx.fillStyle = this.flashColor;
      ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      ctx.restore();
    }
  }
}

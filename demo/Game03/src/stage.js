import { CANVAS_WIDTH } from "./constants.js";
import {
  createAirDrone,
  createAirGunner,
  createGroundTurret,
  createGroundMover,
  createGroundBase,
  createAirBoss,
} from "./enemy.js";

function stage1Script() {
  return [
    { time: 1.0, spawn: () => [createAirDrone(80, -30), createAirDrone(160, -60), createAirDrone(240, -30)] },
    { time: 3.5, spawn: () => [createGroundTurret(120, -30), createGroundTurret(360, -30)] },
    { time: 6.0, spawn: () => [createAirDrone(60, -30), createAirDrone(420, -30)] },
    { time: 8.5, spawn: () => [createGroundMover(200, -30)] },
    { time: 11.0, spawn: () => [createAirGunner(100, -30), createAirGunner(380, -30)] },
    { time: 13.5, spawn: () => [createGroundBase(240, -60)] },
    { time: 17.0, spawn: () => [createAirDrone(120, -30), createAirDrone(240, -30), createAirDrone(360, -30)] },
    { time: 20.0, boss: () => createAirBoss(CANVAS_WIDTH / 2, -80, 1) },
  ];
}

function stage2Script() {
  return [
    { time: 1.0, spawn: () => [createAirGunner(80, -30), createAirGunner(400, -30)] },
    { time: 3.0, spawn: () => [createGroundTurret(80, -30), createGroundMover(240, -30), createGroundTurret(400, -30)] },
    { time: 6.0, spawn: () => [createAirDrone(60, -30), createAirDrone(150, -60), createAirDrone(330, -60), createAirDrone(420, -30)] },
    { time: 9.0, spawn: () => [createGroundBase(140, -60), createGroundBase(340, -60)] },
    { time: 12.5, spawn: () => [createAirGunner(240, -30)] },
    { time: 15.0, spawn: () => [createGroundMover(100, -30), createGroundMover(380, -30)] },
    { time: 18.0, spawn: () => [createAirDrone(80, -30), createAirDrone(200, -30), createAirDrone(320, -30), createAirDrone(420, -30)] },
    { time: 22.0, boss: () => createAirBoss(CANVAS_WIDTH / 2, -80, 1.4) },
  ];
}

function stage3Script() {
  return [
    { time: 1.0, spawn: () => [createAirGunner(100, -30), createAirGunner(240, -30), createAirGunner(380, -30)] },
    { time: 4.0, spawn: () => [createGroundTurret(60, -30), createGroundTurret(200, -30), createGroundTurret(340, -30), createGroundTurret(420, -30)] },
    { time: 7.0, spawn: () => [createAirDrone(80, -30), createAirDrone(160, -60), createAirDrone(320, -60), createAirDrone(400, -30)] },
    { time: 10.0, spawn: () => [createGroundBase(120, -60), createGroundBase(360, -60)] },
    { time: 13.5, spawn: () => [createAirGunner(140, -30), createAirGunner(340, -30)] },
    { time: 16.5, spawn: () => [createGroundMover(80, -30), createGroundMover(240, -30), createGroundMover(400, -30)] },
    { time: 20.0, spawn: () => [createAirDrone(60, -30), createAirDrone(140, -30), createAirDrone(220, -30), createAirDrone(300, -30), createAirDrone(380, -30)] },
    { time: 24.0, boss: () => createAirBoss(CANVAS_WIDTH / 2, -80, 1.8) },
  ];
}

const STAGE_SCRIPTS = [stage1Script, stage2Script, stage3Script];

export const STAGE_COUNT = STAGE_SCRIPTS.length;

export class StageManager {
  constructor(stageIndex) {
    this.stageIndex = stageIndex;
    this.timeline = STAGE_SCRIPTS[stageIndex]();
    this.timer = 0;
    this.nextEventIndex = 0;
    this.bossSpawned = false;
    this.boss = null;
    this.cleared = false;
  }

  update(dt, onSpawn) {
    this.timer += dt;
    while (
      this.nextEventIndex < this.timeline.length &&
      this.timeline[this.nextEventIndex].time <= this.timer
    ) {
      const event = this.timeline[this.nextEventIndex];
      if (event.boss) {
        this.boss = event.boss();
        this.bossSpawned = true;
        onSpawn([this.boss]);
      } else if (event.spawn) {
        onSpawn(event.spawn());
      }
      this.nextEventIndex += 1;
    }
    if (this.bossSpawned && this.boss && !this.boss.alive) {
      this.cleared = true;
    }
  }

  get isFinished() {
    return this.cleared;
  }
}

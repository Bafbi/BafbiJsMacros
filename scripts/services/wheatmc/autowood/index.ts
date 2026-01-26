import { Logger, LogLevel } from "../../../utils/debug";

// services start with minecraft, when enabled and are meant to be persistent scripts.
JsMacros.assertEvent(event, "Service");

// Auto-miner configuration
const CONFIG = {
  TARGET_BLOCKS: [
    "minecraft:oak_log",
    "minecraft:birch_log",
    "minecraft:spruce_log",
    "minecraft:jungle_log",
    "minecraft:acacia_log",
    "minecraft:dark_oak_log",
    "minecraft:mangrove_log",
    "minecraft:cherry_log",
    "minecraft:oak_wood",
    "minecraft:birch_wood",
    "minecraft:spruce_wood",
    "minecraft:jungle_wood",
    "minecraft:acacia_wood",
    "minecraft:dark_oak_wood",
    "minecraft:mangrove_wood",
    "minecraft:cherry_wood",
  ],
  RANGE: 4.5,
  DEBUG: true,
  INTERPOLATION_SPEED: 0.35, // 0.0 to 1.0 (higher = faster)
  INTERPOLATION_THRESHOLD: 40.0, // Degrees away before we start interpolating
};

const logger = new Logger(
  "AutoWood",
  CONFIG.DEBUG ? LogLevel.TRACE : LogLevel.INFO,
);
const draw2d = Hud.createDraw2D();
const draw3d = Hud.createDraw3D();
let debugText = null;

// Track state across ticks
let lastMinedPos = null;
let lastMinedTime = 0;
const VEIN_TIMEOUT_MS = 5000; // Stop prioritizing vein after 5s of inactivity

draw2d.setOnInit(
  JavaWrapper.methodToJava(() => {
    // draw2d automatically clears on init
    debugText = draw2d.addText(
      "AutoWood: Initializing...",
      10,
      10,
      0xffffff,
      true,
    );
  }),
);

/**
 * Checks if a block is visible from the player's eyes.
 * Uses World.rayTraceBlock to find if anything is obstructing the path.
 */
function isVisible(eyePos, tx, ty, tz) {
  const cx = tx + 0.5;
  const cy = ty + 0.5;
  const cz = tz + 0.5;

  const hitBlock = World.rayTraceBlock(
    eyePos.x,
    eyePos.y,
    eyePos.z,
    cx,
    cy,
    cz,
    false,
  );

  if (!hitBlock) return true; // No solid blocks in the way

  const hp = hitBlock.getBlockPos();
  return (
    hp.getX() === tx &&
    hp.getY() === ty &&
    hp.getZ() === tz
  );
}

/**
 * Main loop logic.
 */
const onTick = JavaWrapper.methodToJava(() => {
  const mc = Client.getMinecraft();
  if (!World.isWorldLoaded()) return;

  try {
    const player = Player.getPlayer();
    const interactionManager = Player.getInteractionManager();
    const eyePos = player.getEyePos();

    // Reset 3D visuals
    draw3d.clear();

    // 1. Scan for targets
    const targets = [];
    const centerPos = player.getBlockPos();
    const intRange = Math.ceil(CONFIG.RANGE);

    World.iterateSphere(
      centerPos,
      intRange,
      true,
      JavaWrapper.methodToJava((block) => {
        const id = block.getId();
        if (CONFIG.TARGET_BLOCKS.indexOf(id) !== -1) {
          const bp = block.getBlockPos();
          const tx = bp.getX();
          const ty = bp.getY();
          const tz = bp.getZ();
          
          const cx = tx + 0.5;
          const cy = ty + 0.5;
          const cz = tz + 0.5;

          // Only add if within actual reach and visible
          const distSq = getDistanceSq(eyePos, { x: cx, y: cy, z: cz });
          if (
            distSq <= CONFIG.RANGE * CONFIG.RANGE &&
            isVisible(eyePos, tx, ty, tz)
          ) {
            targets.push({
              id: id + "",
              x: tx,
              y: ty,
              z: tz,
              cx: cx,
              cy: cy,
              cz: cz
            });
          }
        }
      }),
    );

    if (targets.length === 0) {
      if (debugText) {
        debugText.setText("AutoWood: Scanning...");
        debugText.setColor(0xffff00);
      }
      return;
    }

    // 2. Select target using Vein Mining heuristic
    const now = Date.now();
    const useVein = lastMinedPos && now - lastMinedTime < VEIN_TIMEOUT_MS;

    targets.sort((a, b) => {
      if (useVein) {
        const distToLastA = getDistanceSq(lastMinedPos, { x: a.cx, y: a.cy, z: a.cz });
        const distToLastB = getDistanceSq(lastMinedPos, { x: b.cx, y: b.cy, z: b.cz });
        if (Math.abs(distToLastA - distToLastB) > 0.1) {
          return distToLastA - distToLastB;
        }
      }

      const distA = getDistanceSq(eyePos, { x: a.cx, y: a.cy, z: a.cz });
      const distB = getDistanceSq(eyePos, { x: b.cx, y: b.cy, z: b.cz });
      return distA - distB;
    });

    const target = targets[0];

    // 3. Visualization for all candidates
    for (const t of targets) {
      draw3d.addBox(
        t.x, t.y, t.z,
        t.x + 1, t.y + 1, t.z + 1,
        0xffa500,
        0xffa500,
        false,
      );
    }

    // 4. Aim with Interpolation
    const targetRot = getRotations(eyePos, { x: target.cx, y: target.cy, z: target.cz });
    const currentYaw = player.getYaw();
    const currentPitch = player.getPitch();

    const nextYaw = interpolateAngle(currentYaw, targetRot.yaw, CONFIG.INTERPOLATION_SPEED);
    const nextPitch = interpolateAngle(currentPitch, targetRot.pitch, CONFIG.INTERPOLATION_SPEED);

    // Only apply interpolation if we are within the threshold
    const yawDiff = getAngleDiff(currentYaw, targetRot.yaw);
    const pitchDiff = getAngleDiff(currentPitch, targetRot.pitch);
    const totalDiff = Math.sqrt(yawDiff * yawDiff + pitchDiff * pitchDiff);

    if (totalDiff <= CONFIG.INTERPOLATION_THRESHOLD) {
      player.lookAt(nextYaw, nextPitch);
    }

    // 5. Verification: Are we looking at the target?
    const lookedAtPos = interactionManager.getTargetedBlock();
    const isLookingAtTarget =
      lookedAtPos &&
      lookedAtPos.getX() === target.x &&
      lookedAtPos.getY() === target.y &&
      lookedAtPos.getZ() === target.z;

    // 6. Update Debug Visuals
    if (debugText) {
      const dist = Math.sqrt(getDistanceSq(eyePos, { x: target.cx, y: target.cy, z: target.cz }));
      debugText.setText(
        `Target: ${target.id} (${dist.toFixed(1)}m)${isLookingAtTarget ? " §7[Locked]" : ""}${useVein ? " §b[Vein]" : ""}`,
      );
      debugText.setColor(isLookingAtTarget ? 0x00ff00 : 0x00aaff);
    }

    draw3d.addTraceLine(target.cx, target.cy, target.cz, 0x00ff00);
    draw3d.addBox(
      target.x, target.y, target.z,
      target.x + 1, target.y + 1, target.z + 1,
      0x00ff00,
      0x00ff00,
      false,
    );
  } catch (e) {
    logger.error("Loop Error: " + e);
  }
});

/**
 * Listener for AttackBlock event.
 * Updates the vein state when the player manually starts attacking a block.
 */
const onAttackBlock = JavaWrapper.methodToJava((event: any) => {
  const block = event.block;
  if (CONFIG.TARGET_BLOCKS.indexOf(block.getId()) !== -1) {
    updateVeinAnchor(block.getX(), block.getY(), block.getZ(), "AttackBlock");
  }
});

/**
 * Listener for BlockUpdate event.
 * Updates the vein state when a block is broken (turns to air) near the player.
 */
const onBlockUpdate = JavaWrapper.methodToJava((event: any) => {
  const block = event.block;
  // If a block turns to air, it might have been our target breaking
  if (block.getId() === "minecraft:air") {
    const player = Player.getPlayer();
    if (!player) return;
    
    const bx = block.getX();
    const by = block.getY();
    const bz = block.getZ();
    
    // Check if it's within reach distance to avoid reacting to random world updates
    const distSq = getDistanceSq(player.getEyePos(), { x: bx + 0.5, y: by + 0.5, z: bz + 0.5 });
    if (distSq <= (CONFIG.RANGE + 1) * (CONFIG.RANGE + 1)) {
        updateVeinAnchor(bx, by, bz, "BlockUpdate (Break)");
    }
  }
});

/**
 * Helper to update the vein mining anchor point.
 */
function updateVeinAnchor(x: number, y: number, z: number, source: string) {
  lastMinedPos = { x: x + 0.5, y: y + 0.5, z: z + 0.5 };
  lastMinedTime = Date.now();
  logger.trace(`Vein anchor updated from ${source} at [${x}, ${y}, ${z}]`);
}

/**
 * Calculates yaw and pitch to face a target.
 */
function getRotations(eyePos, targetPos) {
  const dX = targetPos.x - eyePos.x;
  const dY = targetPos.y - eyePos.y;
  const dZ = targetPos.z - eyePos.z;
  const dist = Math.sqrt(dX * dX + dZ * dZ);
  
  // Minecraft Yaw is shifted 90 degrees
  const yaw = (Math.atan2(dZ, dX) * 180.0) / Math.PI - 90.0;
  const pitch = -((Math.atan2(dY, dist) * 180.0) / Math.PI);
  
  return { yaw, pitch };
}

/**
 * Interpolates between two angles, handling the 360-degree wrap-around.
 */
function interpolateAngle(current, target, factor) {
  const diff = getAngleDiff(current, target);
  return current + diff * factor;
}

/**
 * Gets the shortest difference between two angles.
 */
function getAngleDiff(current, target) {
  let diff = target - current;
  while (diff < -180) diff += 360;
  while (diff > 180) diff -= 360;
  return diff;
}

/**
 * Squared distance helper.
 */
function getDistanceSq(pos1, pos2) {
  const dX = pos1.x - pos2.x;
  const dY = pos1.y - pos2.y;
  const dZ = pos1.z - pos2.z;
  return dX * dX + dY * dY + dZ * dZ;
}

// --- Startup ---
draw2d.register();
draw3d.register();
const tickListener = JsMacros.on("Tick", onTick);
const attackListener = JsMacros.on("AttackBlock", onAttackBlock);
const blockListener = JsMacros.on("BlockUpdate", onBlockUpdate);
logger.info("AutoWood Service Started (Smart Aim Assist)");

// --- Shutdown ---
event.stopListener = JavaWrapper.methodToJava(() => {
  draw2d.unregister();
  draw3d.unregister();
  JsMacros.off(tickListener);
  JsMacros.off(attackListener);
  JsMacros.off(blockListener);
  logger.info("AutoWood Service Stopped");
});

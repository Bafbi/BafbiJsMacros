import { Logger, LogLevel } from "../../../utils/debug";
import {
  getDistanceSq,
  getRotations,
  getClosestFace,
} from "../../../utils/math";
import { sortTargets } from "./vein";
import { AimController } from "./AimController";
import {
  EventUtils,
  EVENT_MINE_BLOCK,
  MineBlockEvent,
} from "../../../utils/events";

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
    "minecraft:coal_ore",
    "minecraft:iron_ore",
  ],
  RANGE: 4.5,
  DEBUG: false,
  INTERPOLATION_SPEED: 0.6, // 0.0 to 1.0 (higher = faster)
  INTERPOLATION_THRESHOLD: 1.5, // Degrees away before we consider "locked"
  MIN_ROTATION_SPEED: 0.5, // Minimum degrees per tick
  MAX_ROTATION_SPEED: 180.0, // Max degrees per tick
  SWAY_AMPLITUDE: 0.15, // Degrees of "breathing" sway
  SWAY_FREQUENCY: 1.0, // Speed of sway
  AIM_STIFFNESS: 0.4, // Acceleration factor for physics aim (reduced for control)
  AIM_DAMPING: 0.5, // Inertia factor (friction) for physics aim (reduced to make it feel stiffer/heavier)
  MIN_PITCH: -45, // Minimum vertical angle (up)
  MAX_PITCH: 45, // Maximum vertical angle (down)
};

const logger = new Logger(
  "AutoWood",
  CONFIG.DEBUG ? LogLevel.TRACE : LogLevel.INFO,
);
const draw2d = Hud.createDraw2D();
const draw3d = Hud.createDraw3D();
const aimController = new AimController();
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
      200,
      0xffffff,
      true,
    );
  }),
);

/**
 * Checks if a specific point is visible from the player's eyes.
 * Uses World.rayTraceBlock to find if anything is obstructing the path.
 */
function isVisible(eyePos, tx, ty, tz, aimX, aimY, aimZ) {
  const hitBlock = World.rayTraceBlock(
    eyePos.x,
    eyePos.y,
    eyePos.z,
    aimX,
    aimY,
    aimZ,
    false,
  );

  if (!hitBlock) return true; // No solid blocks in the way

  const hp = hitBlock.getBlockPos();
  return hp.getX() === tx && hp.getY() === ty && hp.getZ() === tz;
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
    const centerPos = player.getBlockPos().offset(0, 1, 0);
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

          // Target the closest face center instead of the block center
          const aimPos = getClosestFace(eyePos, tx, ty, tz);

          // Only add if within actual reach, visible, and within pitch limits
          const distSq = getDistanceSq(eyePos, aimPos);
          const rotations = getRotations(eyePos, aimPos);

          if (
            distSq <= CONFIG.RANGE * CONFIG.RANGE &&
            rotations.pitch >= CONFIG.MIN_PITCH &&
            rotations.pitch <= CONFIG.MAX_PITCH &&
            isVisible(eyePos, tx, ty, tz, aimPos.x, aimPos.y, aimPos.z)
          ) {
            targets.push({
              id: id + "",
              x: tx,
              y: ty,
              z: tz,
              cx: aimPos.x,
              cy: aimPos.y,
              cz: aimPos.z,
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

    const sortedTargets = sortTargets(
      targets,
      player,
      useVein ? lastMinedPos : null,
      aimController.getVelocity(),
    );
    const target = sortedTargets[0];

    // 3. Visualization for all candidates
    for (const t of targets) {
      draw3d.addBox(
        t.x,
        t.y,
        t.z,
        t.x + 1,
        t.y + 1,
        t.z + 1,
        0xffa500,
        0xffa500,
        false,
      );
    }

    // 4. Aim with Humanized Controller
    // Only update aim if the player is holding the attack key (typically Left-Click)
    const attackKey = KeyBind.getKeyBindings().get("key.attack");
    const isAttackPressed =
      attackKey && KeyBind.getPressedKeys().contains(attackKey);

    if (isAttackPressed) {
      aimController.update(player, target, CONFIG);
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
      const dist = Math.sqrt(
        getDistanceSq(eyePos, { x: target.cx, y: target.cy, z: target.cz }),
      );
      const status = isAttackPressed ? "§6[Aiming]" : "§7[Ready]";
      debugText.setText(
        `Target: ${target.id} (${dist.toFixed(1)}m) ${status}${isLookingAtTarget ? " §7[Locked]" : ""}${useVein ? " §b[Vein]" : ""}`,
      );
      debugText.setColor(isLookingAtTarget ? 0x00ff00 : 0x00aaff);
    }

    draw3d.addTraceLine(target.cx, target.cy, target.cz, 0x00ff00);
    draw3d.addBox(
      target.x,
      target.y,
      target.z,
      target.x + 1,
      target.y + 1,
      target.z + 1,
      0x00ff00,
      0x00ff00,
      false,
    );
  } catch (e) {
    logger.error("Loop Error: " + e);
  }
});

/**
 * Listener for MineBlock event.
 * Updates the vein state when our target block is broken.
 */
const onMineBlock = (data: MineBlockEvent) => {
  updateVeinAnchor(data.pos.x, data.pos.y, data.pos.z, "MineBlockEvent");
};

/**
 * Helper to update the vein mining anchor point.
 */
function updateVeinAnchor(x: number, y: number, z: number, source: string) {
  lastMinedPos = { x: x + 0.5, y: y + 0.5, z: z + 0.5 };
  lastMinedTime = Date.now();
  logger.trace(`Vein anchor updated from ${source} at [${x}, ${y}, ${z}]`);
}

// --- Startup ---
draw2d.register();
draw3d.register();
const tickListener = JsMacros.on("Tick", onTick);
const mineBlockListener = EventUtils.onCustom<MineBlockEvent>(
  EVENT_MINE_BLOCK,
  onMineBlock,
);
logger.info("AutoWood Service Started (Smart Aim Assist)");

// --- Shutdown ---
(event as Events.Service).stopListener = JavaWrapper.methodToJava(() => {
  draw2d.unregister();
  draw3d.unregister();
  JsMacros.off(tickListener);
  JsMacros.off(mineBlockListener);
  logger.info("AutoWood Service Stopped");
});

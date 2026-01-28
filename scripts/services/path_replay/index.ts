import { Logger, LogLevel } from "../../utils/debug";
import { getDistanceSq } from "../../utils/math";

/**
 * Path Replay Service
 *
 * Allows recording manual waypoints and replaying them strictly using Baritone.
 */

interface Waypoint {
  x: number;
  y: number;
  z: number;
}

interface PathData {
  name: string;
  waypoints: Waypoint[];
}

const logger = new Logger("PathReplay", LogLevel.INFO);
const PATHS_DIR = "./path_replay_data/";

// Ensure directory exists
if (!FS.exists(PATHS_DIR)) {
  FS.makeDir(PATHS_DIR);
}

// --- Baritone API Helpers ---
let baritoneInstance: any = null;
try {
  const BaritoneAPI = Java.type("baritone.api.BaritoneAPI") as any;
  baritoneInstance = BaritoneAPI.getProvider().getPrimaryBaritone();
} catch (e) {
  logger.error("Baritone API not found. Please ensure Baritone is installed.");
}

const GoalBlockClass = Reflection.getClass(
  "baritone.api.pathing.goals.GoalBlock",
);

function setBaritoneGoal(x: number, y: number, z: number) {
  if (!baritoneInstance) return;
  try {
    const blockPos = (PositionCommon as any).createBlockPos(
      Math.floor(x),
      Math.floor(y),
      Math.floor(z),
    ).getRaw();
    const goal = Reflection.newInstance(GoalBlockClass as any, blockPos);
    baritoneInstance.getCustomGoalProcess().setGoalAndPath(goal);
  } catch (e) {
    logger.error(`Failed to set Baritone goal: ${e}`);
  }
}

function stopBaritone() {
  if (!baritoneInstance) return;
  baritoneInstance.getPathingBehavior().cancelEverything();
}

function isBaritonePathing(): boolean {
  if (!baritoneInstance) return false;
  return baritoneInstance.getPathingBehavior().isPathing();
}

function applySpeed() {
  try {
    const BaritoneAPI = Java.type("baritone.api.BaritoneAPI") as any;
    const settings = BaritoneAPI.getSettings();
    if (originalAllowSprint === null) {
      originalAllowSprint = settings.allowSprint.value;
    }
    settings.allowSprint.value = replaySpeed === "sprint";
    logger.debug(`Applied speed: ${replaySpeed} (allowSprint: ${settings.allowSprint.value})`);
  } catch (e) {
    logger.error(`Failed to apply speed: ${e}`);
  }
}

function restoreSpeed() {
  if (originalAllowSprint === null) return;
  try {
    const BaritoneAPI = Java.type("baritone.api.BaritoneAPI") as any;
    const settings = BaritoneAPI.getSettings();
    settings.allowSprint.value = originalAllowSprint;
    originalAllowSprint = null;
    logger.debug(`Restored speed setting: allowSprint=${settings.allowSprint.value}`);
  } catch (e) {
    logger.error(`Failed to restore speed: ${e}`);
  }
}

// --- Service State ---
let currentPath: Waypoint[] = [];
let loadedPathName: string | null = null;
let isRecording = false;
let isReplaying = false;
let isLooping = false;
let currentWaypointIndex = -1;

// --- Double Sneak State ---
let lastSneakTime = 0;
let wasSneaking = false;

// --- Speed Control ---
let replaySpeed: "walk" | "sprint" = "walk";
let originalAllowSprint: boolean | null = null;

// --- HUDs ---
const draw3d = Hud.createDraw3D();
const draw2d = Hud.createDraw2D();
let statusTextElement: any = null;

draw2d.setOnInit(
  JavaWrapper.methodToJava(() => {
    statusTextElement = draw2d.addText("", 10, 10, 0xffffff, true);
  }),
);

function updateHUD() {
  draw3d.clear();

  // 3D Path Lines
  if (currentPath.length > 0) {
    for (let i = 0; i < currentPath.length; i++) {
      const p1 = currentPath[i];

      // Draw waypoint box
      const isTarget = isReplaying && i === currentWaypointIndex;
      const boxColor = isTarget ? 0x5555ff : 0x55ff55;
      draw3d.addBox(
        p1.x - 0.2,
        p1.y,
        p1.z - 0.2,
        p1.x + 0.2,
        p1.y + 0.4,
        p1.z + 0.2,
        boxColor,
        50,
        boxColor,
        200,
        true,
      );

      // Draw line to next waypoint
      if (i < currentPath.length - 1) {
        const p2 = currentPath[i + 1];
        const lineColor =
          isReplaying && i === currentWaypointIndex - 1 ? 0x5555ff : 0x55ff55;
        draw3d.addLine(
          p1.x,
          p1.y + 0.2,
          p1.z,
          p2.x,
          p2.y + 0.2,
          p2.z,
          lineColor,
          255,
        );
      }
    }
  }

  // 2D Status Overlay
  if (statusTextElement) {
    let statusText = "§7Path: " + (loadedPathName || "§8None");
    if (isRecording) {
      statusText = "§c● RECORDING §7- Points: §f" + currentPath.length;
    } else if (isReplaying) {
      const playerPos = Player.getPlayer().getPos();
      const targetWp = currentPath[currentWaypointIndex];
      const dist = targetWp ? Math.sqrt(getDistanceSq(playerPos, targetWp)) : 0;
      const loopStr = isLooping ? " (LOOP)" : "";
      const speedStr = ` [${replaySpeed.toUpperCase()}]`;
      statusText = `§b▶ REPLAYING${loopStr}${speedStr} §f[${currentWaypointIndex + 1}/${currentPath.length}] §7- Dist: §f${dist.toFixed(1)}m`;
    }
    statusTextElement.setText(statusText);
  }
}

// --- Logic ---
function savePath(name: string) {
  if (currentPath.length === 0) {
    logger.warn("Cannot save empty path.");
    return;
  }
  const data: PathData = { name, waypoints: currentPath };
  FS.open(PATHS_DIR + name + ".json").write(JSON.stringify(data, null, 2));
  logger.info(`Path §b${name}§f saved with §b${currentPath.length}§f points.`);
}

function loadPath(name: string) {
  const file = PATHS_DIR + name + ".json";
  if (!FS.exists(file)) {
    logger.error(`Path §b${name}§f not found.`);
    return;
  }
  try {
    const data: PathData = JSON.parse(FS.open(file).read());
    currentPath = data.waypoints;
    loadedPathName = name;
    logger.info(
      `Loaded path §b${name}§f with §b${currentPath.length}§f points.`,
    );
    updateHUD();
  } catch (e) {
    logger.error(`Failed to load path §b${name}§f: ${e}`);
  }
}

function startReplay(loop: boolean = false) {
  if (currentPath.length === 0) {
    logger.warn("No path loaded to replay.");
    return;
  }
  isReplaying = true;
  isLooping = loop;
  currentWaypointIndex = 0;
  applySpeed();
  logger.info(`Starting replay${loop ? " (looping)" : ""} at ${replaySpeed} speed...`);
  moveToNextWaypoint();
}

function moveToNextWaypoint() {
  if (!isReplaying) return;

  if (currentWaypointIndex >= currentPath.length) {
    if (isLooping) {
      currentWaypointIndex = 0;
      logger.info("Path finished, looping back to start.");
    } else {
      stopEverything();
      logger.info("Replay finished.");
      return;
    }
  }
  const wp = currentPath[currentWaypointIndex];
  setBaritoneGoal(wp.x, wp.y, wp.z);
  logger.debug(
    `Moving to waypoint ${currentWaypointIndex + 1}/${currentPath.length} at ${Logger.formatPos(wp)}`,
  );
}

function stopEverything() {
  isRecording = false;
  isReplaying = false;
  isLooping = false;
  currentWaypointIndex = -1;
  restoreSpeed();
  stopBaritone();
  updateHUD();
}

// --- Command ---
const cmd = Chat.getCommandManager()
  .createCommandBuilder("path")
  .literalArg("record")
  .literalArg("start")
    .wordArg("name")
    .executes(
      JavaWrapper.methodToJava((ctx: any) => {
        const name = ctx.getArg("name");
        currentPath = [];
        loadedPathName = name;
        isRecording = true;
        isReplaying = false;
        logger.info(`Started recording path: §b${name}`);
        updateHUD();
      }),
    )
    .or()
    .or()
    .literalArg("add")
    .executes(
      JavaWrapper.methodToJava(() => {
        if (!isRecording) {
          logger.warn("Not recording. Use §b/path record start <name>§f first.");
          return;
        }
        const pos = Player.getPlayer().getPos();
        currentPath.push({ x: pos.x, y: pos.y, z: pos.z });
        logger.info(
          `Added waypoint §b#${currentPath.length}§f at ${Logger.formatPos(pos)}`,
        );
        updateHUD();
      }),
    )
    .or()
    .literalArg("remove")
    .executes(
      JavaWrapper.methodToJava(() => {
        if (!isRecording) {
          logger.warn("Not recording.");
          return;
        }
        if (currentPath.length > 0) {
          const removed = currentPath.pop();
          logger.info(`Removed last waypoint at ${Logger.formatPos(removed!)}`);
          updateHUD();
        }
      }),
    )
    .or()
    .literalArg("stop")
    .executes(
      JavaWrapper.methodToJava(() => {
        if (isRecording) {
          savePath(loadedPathName || "unnamed");
        }
        stopEverything();
        logger.info("Stopped recording/replay.");
      }),
    )
    .or()
    .or()
    .literalArg("load")
    .wordArg("name")
    .executes(
      JavaWrapper.methodToJava((ctx: any) => {
        loadPath(ctx.getArg("name"));
      }),
    )
    .or()
    .or()
    .literalArg("speed")
    .literalArg("walk")
    .executes(
      JavaWrapper.methodToJava(() => {
        replaySpeed = "walk";
        if (isReplaying) applySpeed();
        logger.info("Replay speed set to: §bWALK");
        updateHUD();
      }),
    )
    .or()
    .literalArg("sprint")
    .executes(
      JavaWrapper.methodToJava(() => {
        replaySpeed = "sprint";
        if (isReplaying) applySpeed();
        logger.info("Replay speed set to: §bSPRINT");
        updateHUD();
      }),
    )
    .or()
    .or()
    .or()
    .literalArg("play")
  .executes(
    JavaWrapper.methodToJava(() => {
      startReplay(false);
    }),
  )
  .literalArg("loop")
  .executes(
    JavaWrapper.methodToJava(() => {
      startReplay(true);
    }),
  )
  .or()
  .or()
  .literalArg("clear")
  .executes(
    JavaWrapper.methodToJava(() => {
      currentPath = [];
      loadedPathName = null;
      stopEverything();
      logger.info("Path cleared.");
    }),
  )
  .or()
  .literalArg("list")
  .executes(
    JavaWrapper.methodToJava(() => {
      const files = FS.list(PATHS_DIR);
      if (!files || files.length === 0) {
        logger.info("No saved paths found.");
        return;
      }
      logger.info("Saved paths:");
      files.forEach((f) => {
        if (f.endsWith(".json")) {
          logger.info(` - §b${f.replace(".json", "")}`);
        }
      });
    }),
  )
  .or()
  .literalArg("stop")
  .executes(
    JavaWrapper.methodToJava(() => {
      if (isRecording) {
        savePath(loadedPathName || "unnamed");
      }
      stopEverything();
      logger.info("Stopped recording/replay.");
    }),
  )
  .or();

// --- Lifecycle ---
cmd.register();
draw3d.register();
draw2d.register();

const tickListener = JsMacros.on(
  "Tick",
  JavaWrapper.methodToJava(() => {
    // Double Sneak Detection
    const isSneaking = Player.getPlayer().isSneaking();
    if (isSneaking && !wasSneaking) {
      const now = Date.now();
      if (now - lastSneakTime < 500) {
        if (isRecording || isReplaying) {
          if (isRecording) savePath(loadedPathName || "unnamed");
          stopEverything();
          logger.info("Double-sneak detected, stopping.");
        }
      }
      lastSneakTime = now;
    }
    wasSneaking = isSneaking;

    if (isReplaying && currentWaypointIndex < currentPath.length) {
      const playerPos = Player.getPlayer().getPos();
      const targetWp = currentPath[currentWaypointIndex];

      // Check if reached waypoint (within 1.5 blocks horizontal, 2 blocks vertical)
      const dSq = getDistanceSq(playerPos, targetWp);
      if (dSq < 2.25) {
        // 1.5 blocks radius
        logger.debug(`Reached waypoint ${currentWaypointIndex + 1}`);
        currentWaypointIndex++;
        moveToNextWaypoint();
      } else {
        // Ensure baritone is still going (check every 20 ticks)
        if (World.getTime() % 20 === 0 && !isBaritonePathing()) {
          setBaritoneGoal(targetWp.x, targetWp.y, targetWp.z);
        }
      }
    }

    // Low frequency HUD update (every 5 ticks)
    if (World.getTime() % 5 === 0) {
      updateHUD();
    }
  }),
);

(event as any).stopListener = JavaWrapper.methodToJava(() => {
  cmd.unregister();
  draw3d.unregister();
  draw2d.unregister();
  JsMacros.off(tickListener);
  stopBaritone();
  logger.info("Service stopped.");
});

logger.info("Path Replay Service initialized. Use §b/path§f to start.");

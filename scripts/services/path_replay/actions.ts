import { Logger, LogLevel } from "../../utils/debug";
import { getDistanceSq } from "../../utils/math";
import { state } from "./state";
import { setBaritoneGoal, stopBaritone, isBaritonePathing, applySpeed, restoreSpeed } from "./baritone";
import { updateHUD } from "./hud";
import { savePath } from "./storage";

const logger = new Logger("PathReplay:Actions", LogLevel.INFO);

export function startReplay(loop: boolean = false) {
  if (state.currentPath.length === 0) {
    logger.warn("No path loaded to replay.");
    return;
  }
  state.isReplaying = true;
  state.isLooping = loop;
  state.currentWaypointIndex = 0;
  applySpeed();
  logger.info(`Starting replay${loop ? " (looping)" : ""} at ${state.replaySpeed} speed...`);
  moveToNextWaypoint();
}

export function moveToNextWaypoint() {
  if (!state.isReplaying) return;

  if (state.currentWaypointIndex >= state.currentPath.length) {
    if (state.isLooping) {
      state.currentWaypointIndex = 0;
      logger.info("Path finished, looping back to start.");
    } else {
      stopEverything();
      logger.info("Replay finished.");
      return;
    }
  }
  const wp = state.currentPath[state.currentWaypointIndex];
  setBaritoneGoal(wp.x, wp.y, wp.z);
  logger.debug(
    `Moving to waypoint ${state.currentWaypointIndex + 1}/${state.currentPath.length} at ${Logger.formatPos(wp)}`,
  );
}

export function stopEverything() {
  state.isRecording = false;
  state.isReplaying = false;
  state.isLooping = false;
  state.isEditing = false;
  state.currentWaypointIndex = -1;
  state.selectedWaypointIndex = -1;
  restoreSpeed();
  stopBaritone();
  updateHUD();
}

export function toggleEditMode() {
  if (state.isRecording || state.isReplaying) {
    logger.warn("Cannot edit while recording or replaying.");
    return;
  }
  state.isEditing = !state.isEditing;
  if (!state.isEditing) {
    state.selectedWaypointIndex = -1;
    savePath(state.loadedPathName || "unnamed");
  }
  logger.info(`Edit mode: §b${state.isEditing ? "ENABLED" : "DISABLED (saved)"}`);
  updateHUD();
}

export function editMoveSelected() {
  if (!state.isEditing || state.selectedWaypointIndex === -1) return;
  const pos = Player.getPlayer().getPos();
  state.currentPath[state.selectedWaypointIndex] = { x: pos.x, y: pos.y, z: pos.z };
  logger.info(`Moved waypoint §b#${state.selectedWaypointIndex + 1}§f to current position.`);
  updateHUD();
}

export function editDeleteSelected() {
  if (!state.isEditing || state.selectedWaypointIndex === -1) return;
  const index = state.selectedWaypointIndex;
  state.currentPath.splice(index, 1);
  state.selectedWaypointIndex = -1;
  logger.info(`Deleted waypoint §b#${index + 1}§f.`);
  updateHUD();
}

export function editInsert(after: boolean) {
  if (!state.isEditing || state.selectedWaypointIndex === -1) return;
  const pos = Player.getPlayer().getPos();
  const index = after ? state.selectedWaypointIndex + 1 : state.selectedWaypointIndex;
  state.currentPath.splice(index, 0, { x: pos.x, y: pos.y, z: pos.z });
  logger.info(`Inserted waypoint at §b#${index + 1}§f.`);
  updateHUD();
}

export function handleKey(event: any) {
  // Only detect "Press" action (1)
  if (event.action !== 1) return;

  const sneakBinding = (KeyBind.getKeyBindings() as any).get("key.sneak");
  if (event.key === sneakBinding) {
    const now = Date.now();
    if (now - state.lastSneakTime < 500) {
      if (state.isRecording || state.isReplaying || state.isEditing) {
        if (state.isRecording || state.isEditing) savePath(state.loadedPathName || "unnamed");
        stopEverything();
        logger.info("Double-sneak detected, stopping.");
      }
    }
    state.lastSneakTime = now;
  }
}

export function handleTick() {
  // Proximity Selection in Edit Mode
  if (state.isEditing && state.currentPath.length > 0) {
    const playerPos = Player.getPlayer().getPos();
    let minDSq = Infinity;
    let closestIndex = -1;
    
    for (let i = 0; i < state.currentPath.length; i++) {
      const dSq = getDistanceSq(playerPos, state.currentPath[i]);
      if (dSq < minDSq) {
        minDSq = dSq;
        closestIndex = i;
      }
    }
    
    if (closestIndex !== state.selectedWaypointIndex) {
      state.selectedWaypointIndex = closestIndex;
      // We don't call updateHUD here to avoid flickering, 
      // it will be called by the low frequency update below
    }
  }

  if (state.isReplaying && state.currentWaypointIndex < state.currentPath.length) {
    const playerPos = Player.getPlayer().getPos();
    const targetWp = state.currentPath[state.currentWaypointIndex];

    // Check if reached waypoint
    const dSq = getDistanceSq(playerPos, targetWp);
    if (dSq < 2.25) {
      logger.debug(`Reached waypoint ${state.currentWaypointIndex + 1}`);
      state.currentWaypointIndex++;
      moveToNextWaypoint();
    } else {
      // Ensure baritone is still going
      if (World.getTime() % 20 === 0 && !isBaritonePathing()) {
        setBaritoneGoal(targetWp.x, targetWp.y, targetWp.z);
      }
    }
  }

  // Low frequency HUD update
  if (World.getTime() % 5 === 0) {
    updateHUD();
  }
}

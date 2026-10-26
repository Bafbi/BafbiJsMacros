import { Logger, LogLevel } from "../../utils/debug";
import { state } from "./state";

const logger = new Logger("PathReplay:Baritone", LogLevel.INFO);

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

export function setBaritoneGoal(x: number, y: number, z: number) {
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

export function stopBaritone() {
  if (!baritoneInstance) return;
  baritoneInstance.getPathingBehavior().cancelEverything();
}

export function isBaritonePathing(): boolean {
  if (!baritoneInstance) return false;
  return baritoneInstance.getPathingBehavior().isPathing();
}

export function applySpeed() {
  try {
    const BaritoneAPI = Java.type("baritone.api.BaritoneAPI") as any;
    const settings = BaritoneAPI.getSettings();
    if (state.originalAllowSprint === null) {
      state.originalAllowSprint = settings.allowSprint.value;
    }
    settings.allowSprint.value = state.replaySpeed === "sprint";
    logger.debug(`Applied speed: ${state.replaySpeed} (allowSprint: ${settings.allowSprint.value})`);
  } catch (e) {
    logger.error(`Failed to apply speed: ${e}`);
  }
}

export function restoreSpeed() {
  if (state.originalAllowSprint === null) return;
  try {
    const BaritoneAPI = Java.type("baritone.api.BaritoneAPI") as any;
    const settings = BaritoneAPI.getSettings();
    settings.allowSprint.value = state.originalAllowSprint;
    state.originalAllowSprint = null;
    logger.debug(`Restored speed setting: allowSprint=${settings.allowSprint.value}`);
  } catch (e) {
    logger.error(`Failed to restore speed: ${e}`);
  }
}

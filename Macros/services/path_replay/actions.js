"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startReplay = startReplay;
exports.moveToNextWaypoint = moveToNextWaypoint;
exports.stopEverything = stopEverything;
exports.toggleEditMode = toggleEditMode;
exports.editMoveSelected = editMoveSelected;
exports.editDeleteSelected = editDeleteSelected;
exports.editInsert = editInsert;
exports.handleKey = handleKey;
exports.handleTick = handleTick;
const debug_1 = require("../../utils/debug");
const math_1 = require("../../utils/math");
const state_1 = require("./state");
const baritone_1 = require("./baritone");
const hud_1 = require("./hud");
const storage_1 = require("./storage");
const logger = new debug_1.Logger("PathReplay:Actions", debug_1.LogLevel.INFO);
function startReplay(loop = false) {
    if (state_1.state.currentPath.length === 0) {
        logger.warn("No path loaded to replay.");
        return;
    }
    state_1.state.isReplaying = true;
    state_1.state.isLooping = loop;
    state_1.state.currentWaypointIndex = 0;
    (0, baritone_1.applySpeed)();
    logger.info(`Starting replay${loop ? " (looping)" : ""} at ${state_1.state.replaySpeed} speed...`);
    moveToNextWaypoint();
}
function moveToNextWaypoint() {
    if (!state_1.state.isReplaying)
        return;
    if (state_1.state.currentWaypointIndex >= state_1.state.currentPath.length) {
        if (state_1.state.isLooping) {
            state_1.state.currentWaypointIndex = 0;
            logger.info("Path finished, looping back to start.");
        }
        else {
            stopEverything();
            logger.info("Replay finished.");
            return;
        }
    }
    const wp = state_1.state.currentPath[state_1.state.currentWaypointIndex];
    (0, baritone_1.setBaritoneGoal)(wp.x, wp.y, wp.z);
    logger.debug(`Moving to waypoint ${state_1.state.currentWaypointIndex + 1}/${state_1.state.currentPath.length} at ${debug_1.Logger.formatPos(wp)}`);
}
function stopEverything() {
    state_1.state.isRecording = false;
    state_1.state.isReplaying = false;
    state_1.state.isLooping = false;
    state_1.state.isEditing = false;
    state_1.state.currentWaypointIndex = -1;
    state_1.state.selectedWaypointIndex = -1;
    (0, baritone_1.restoreSpeed)();
    (0, baritone_1.stopBaritone)();
    (0, hud_1.updateHUD)();
}
function toggleEditMode() {
    if (state_1.state.isRecording || state_1.state.isReplaying) {
        logger.warn("Cannot edit while recording or replaying.");
        return;
    }
    state_1.state.isEditing = !state_1.state.isEditing;
    if (!state_1.state.isEditing) {
        state_1.state.selectedWaypointIndex = -1;
        (0, storage_1.savePath)(state_1.state.loadedPathName || "unnamed");
    }
    logger.info(`Edit mode: §b${state_1.state.isEditing ? "ENABLED" : "DISABLED (saved)"}`);
    (0, hud_1.updateHUD)();
}
function editMoveSelected() {
    if (!state_1.state.isEditing || state_1.state.selectedWaypointIndex === -1)
        return;
    const pos = Player.getPlayer().getPos();
    state_1.state.currentPath[state_1.state.selectedWaypointIndex] = { x: pos.x, y: pos.y, z: pos.z };
    logger.info(`Moved waypoint §b#${state_1.state.selectedWaypointIndex + 1}§f to current position.`);
    (0, hud_1.updateHUD)();
}
function editDeleteSelected() {
    if (!state_1.state.isEditing || state_1.state.selectedWaypointIndex === -1)
        return;
    const index = state_1.state.selectedWaypointIndex;
    state_1.state.currentPath.splice(index, 1);
    state_1.state.selectedWaypointIndex = -1;
    logger.info(`Deleted waypoint §b#${index + 1}§f.`);
    (0, hud_1.updateHUD)();
}
function editInsert(after) {
    if (!state_1.state.isEditing || state_1.state.selectedWaypointIndex === -1)
        return;
    const pos = Player.getPlayer().getPos();
    const index = after ? state_1.state.selectedWaypointIndex + 1 : state_1.state.selectedWaypointIndex;
    state_1.state.currentPath.splice(index, 0, { x: pos.x, y: pos.y, z: pos.z });
    logger.info(`Inserted waypoint at §b#${index + 1}§f.`);
    (0, hud_1.updateHUD)();
}
function handleKey(event) {
    // Only detect "Press" action (1)
    if (event.action !== 1)
        return;
    const sneakBinding = KeyBind.getKeyBindings().get("key.sneak");
    if (event.key === sneakBinding) {
        const now = Date.now();
        if (now - state_1.state.lastSneakTime < 500) {
            if (state_1.state.isRecording || state_1.state.isReplaying || state_1.state.isEditing) {
                if (state_1.state.isRecording || state_1.state.isEditing)
                    (0, storage_1.savePath)(state_1.state.loadedPathName || "unnamed");
                stopEverything();
                logger.info("Double-sneak detected, stopping.");
            }
        }
        state_1.state.lastSneakTime = now;
    }
}
function handleTick() {
    // Proximity Selection in Edit Mode
    if (state_1.state.isEditing && state_1.state.currentPath.length > 0) {
        const playerPos = Player.getPlayer().getPos();
        let minDSq = Infinity;
        let closestIndex = -1;
        for (let i = 0; i < state_1.state.currentPath.length; i++) {
            const dSq = (0, math_1.getDistanceSq)(playerPos, state_1.state.currentPath[i]);
            if (dSq < minDSq) {
                minDSq = dSq;
                closestIndex = i;
            }
        }
        if (closestIndex !== state_1.state.selectedWaypointIndex) {
            state_1.state.selectedWaypointIndex = closestIndex;
            // We don't call updateHUD here to avoid flickering, 
            // it will be called by the low frequency update below
        }
    }
    if (state_1.state.isReplaying && state_1.state.currentWaypointIndex < state_1.state.currentPath.length) {
        const playerPos = Player.getPlayer().getPos();
        const targetWp = state_1.state.currentPath[state_1.state.currentWaypointIndex];
        // Check if reached waypoint
        const dSq = (0, math_1.getDistanceSq)(playerPos, targetWp);
        if (dSq < 2.25) {
            logger.debug(`Reached waypoint ${state_1.state.currentWaypointIndex + 1}`);
            state_1.state.currentWaypointIndex++;
            moveToNextWaypoint();
        }
        else {
            // Ensure baritone is still going
            if (World.getTime() % 20 === 0 && !(0, baritone_1.isBaritonePathing)()) {
                (0, baritone_1.setBaritoneGoal)(targetWp.x, targetWp.y, targetWp.z);
            }
        }
    }
    // Low frequency HUD update
    if (World.getTime() % 5 === 0) {
        (0, hud_1.updateHUD)();
    }
}

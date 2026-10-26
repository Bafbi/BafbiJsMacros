"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setBaritoneGoal = setBaritoneGoal;
exports.stopBaritone = stopBaritone;
exports.isBaritonePathing = isBaritonePathing;
exports.applySpeed = applySpeed;
exports.restoreSpeed = restoreSpeed;
const debug_1 = require("../../utils/debug");
const state_1 = require("./state");
const logger = new debug_1.Logger("PathReplay:Baritone", debug_1.LogLevel.INFO);
let baritoneInstance = null;
try {
    const BaritoneAPI = Java.type("baritone.api.BaritoneAPI");
    baritoneInstance = BaritoneAPI.getProvider().getPrimaryBaritone();
}
catch (e) {
    logger.error("Baritone API not found. Please ensure Baritone is installed.");
}
const GoalBlockClass = Reflection.getClass("baritone.api.pathing.goals.GoalBlock");
function setBaritoneGoal(x, y, z) {
    if (!baritoneInstance)
        return;
    try {
        const blockPos = PositionCommon.createBlockPos(Math.floor(x), Math.floor(y), Math.floor(z)).getRaw();
        const goal = Reflection.newInstance(GoalBlockClass, blockPos);
        baritoneInstance.getCustomGoalProcess().setGoalAndPath(goal);
    }
    catch (e) {
        logger.error(`Failed to set Baritone goal: ${e}`);
    }
}
function stopBaritone() {
    if (!baritoneInstance)
        return;
    baritoneInstance.getPathingBehavior().cancelEverything();
}
function isBaritonePathing() {
    if (!baritoneInstance)
        return false;
    return baritoneInstance.getPathingBehavior().isPathing();
}
function applySpeed() {
    try {
        const BaritoneAPI = Java.type("baritone.api.BaritoneAPI");
        const settings = BaritoneAPI.getSettings();
        if (state_1.state.originalAllowSprint === null) {
            state_1.state.originalAllowSprint = settings.allowSprint.value;
        }
        settings.allowSprint.value = state_1.state.replaySpeed === "sprint";
        logger.debug(`Applied speed: ${state_1.state.replaySpeed} (allowSprint: ${settings.allowSprint.value})`);
    }
    catch (e) {
        logger.error(`Failed to apply speed: ${e}`);
    }
}
function restoreSpeed() {
    if (state_1.state.originalAllowSprint === null)
        return;
    try {
        const BaritoneAPI = Java.type("baritone.api.BaritoneAPI");
        const settings = BaritoneAPI.getSettings();
        settings.allowSprint.value = state_1.state.originalAllowSprint;
        state_1.state.originalAllowSprint = null;
        logger.debug(`Restored speed setting: allowSprint=${settings.allowSprint.value}`);
    }
    catch (e) {
        logger.error(`Failed to restore speed: ${e}`);
    }
}

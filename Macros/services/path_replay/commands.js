"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cmd = void 0;
const debug_1 = require("../../utils/debug");
const state_1 = require("./state");
const actions_1 = require("./actions");
const storage_1 = require("./storage");
const baritone_1 = require("./baritone");
const hud_1 = require("./hud");
const logger = new debug_1.Logger("PathReplay:Commands", debug_1.LogLevel.INFO);
exports.cmd = Chat.getCommandManager()
    .createCommandBuilder("path")
    .literalArg("record")
    .literalArg("start")
    .wordArg("name")
    .executes(JavaWrapper.methodToJava((ctx) => {
    const name = ctx.getArg("name");
    state_1.state.currentPath = [];
    state_1.state.loadedPathName = name;
    state_1.state.isRecording = true;
    state_1.state.isReplaying = false;
    logger.info(`Started recording path: §b${name}`);
    (0, hud_1.updateHUD)();
}))
    .or()
    .or()
    .literalArg("add")
    .executes(JavaWrapper.methodToJava(() => {
    if (!state_1.state.isRecording) {
        logger.warn("Not recording. Use §b/path record start <name>§f first.");
        return;
    }
    const pos = Player.getPlayer().getPos();
    state_1.state.currentPath.push({ x: pos.x, y: pos.y, z: pos.z });
    logger.info(`Added waypoint §b#${state_1.state.currentPath.length}§f at ${debug_1.Logger.formatPos(pos)}`);
    (0, hud_1.updateHUD)();
}))
    .or()
    .literalArg("remove")
    .executes(JavaWrapper.methodToJava(() => {
    if (!state_1.state.isRecording) {
        logger.warn("Not recording.");
        return;
    }
    if (state_1.state.currentPath.length > 0) {
        const removed = state_1.state.currentPath.pop();
        logger.info(`Removed last waypoint at ${debug_1.Logger.formatPos(removed)}`);
        (0, hud_1.updateHUD)();
    }
}))
    .or()
    .literalArg("stop")
    .executes(JavaWrapper.methodToJava(() => {
    if (state_1.state.isRecording) {
        (0, storage_1.savePath)(state_1.state.loadedPathName || "unnamed");
    }
    (0, actions_1.stopEverything)();
    logger.info("Stopped recording/replay.");
}))
    .or()
    .or()
    .literalArg("load")
    .wordArg("name")
    .executes(JavaWrapper.methodToJava((ctx) => {
    if ((0, storage_1.loadPath)(ctx.getArg("name"))) {
        (0, hud_1.updateHUD)();
    }
}))
    .or()
    .or()
    .literalArg("edit")
    .executes(JavaWrapper.methodToJava(() => {
    (0, actions_1.toggleEditMode)();
}))
    .literalArg("move")
    .executes(JavaWrapper.methodToJava(() => {
    (0, actions_1.editMoveSelected)();
}))
    .or()
    .literalArg("delete")
    .executes(JavaWrapper.methodToJava(() => {
    (0, actions_1.editDeleteSelected)();
}))
    .or()
    .literalArg("insert")
    .literalArg("after")
    .executes(JavaWrapper.methodToJava(() => {
    (0, actions_1.editInsert)(true);
}))
    .or()
    .literalArg("before")
    .executes(JavaWrapper.methodToJava(() => {
    (0, actions_1.editInsert)(false);
}))
    .or()
    .or()
    .or()
    .literalArg("speed")
    .literalArg("walk")
    .executes(JavaWrapper.methodToJava(() => {
    state_1.state.replaySpeed = "walk";
    if (state_1.state.isReplaying)
        (0, baritone_1.applySpeed)();
    logger.info("Replay speed set to: §bWALK");
    (0, hud_1.updateHUD)();
}))
    .or()
    .literalArg("sprint")
    .executes(JavaWrapper.methodToJava(() => {
    state_1.state.replaySpeed = "sprint";
    if (state_1.state.isReplaying)
        (0, baritone_1.applySpeed)();
    logger.info("Replay speed set to: §bSPRINT");
    (0, hud_1.updateHUD)();
}))
    .otherwise()
    .or()
    .literalArg("play")
    .executes(JavaWrapper.methodToJava(() => {
    (0, actions_1.startReplay)(false);
}))
    .literalArg("loop")
    .executes(JavaWrapper.methodToJava(() => {
    (0, actions_1.startReplay)(true);
}))
    .or()
    .or()
    .literalArg("clear")
    .executes(JavaWrapper.methodToJava(() => {
    state_1.state.currentPath = [];
    state_1.state.loadedPathName = null;
    (0, actions_1.stopEverything)();
    logger.info("Path cleared.");
}))
    .or()
    .literalArg("list")
    .executes(JavaWrapper.methodToJava(() => {
    const paths = (0, storage_1.listPaths)();
    if (paths.length === 0) {
        logger.info("No saved paths found.");
        return;
    }
    logger.info("Saved paths:");
    paths.forEach((p) => {
        logger.info(` - §b${p}`);
    });
}))
    .or()
    .literalArg("stop")
    .executes(JavaWrapper.methodToJava(() => {
    if (state_1.state.isRecording) {
        (0, storage_1.savePath)(state_1.state.loadedPathName || "unnamed");
    }
    (0, actions_1.stopEverything)();
    logger.info("Stopped recording/replay.");
}))
    .or();

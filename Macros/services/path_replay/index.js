"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const debug_1 = require("../../utils/debug");
const actions_1 = require("./actions");
const commands_1 = require("./commands");
const hud_1 = require("./hud");
const storage_1 = require("./storage");
const logger = new debug_1.Logger("PathReplay", debug_1.LogLevel.INFO);
// Initialize
(0, storage_1.ensureDirectory)();
commands_1.cmd.register();
(0, hud_1.registerHUDs)();
const tickListener = JsMacros.on("Tick", JavaWrapper.methodToJava(actions_1.handleTick));
const keyListener = JsMacros.on("Key", JavaWrapper.methodToJava(actions_1.handleKey));
event.stopListener = JavaWrapper.methodToJava(() => {
    commands_1.cmd.unregister();
    (0, hud_1.unregisterHUDs)();
    JsMacros.off(tickListener);
    JsMacros.off(keyListener);
    (0, actions_1.stopEverything)();
    logger.info("Service stopped.");
});
logger.info("Path Replay Service initialized. Use §b/path§f to start.");

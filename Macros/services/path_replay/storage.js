"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureDirectory = ensureDirectory;
exports.savePath = savePath;
exports.loadPath = loadPath;
exports.listPaths = listPaths;
const debug_1 = require("../../utils/debug");
const state_1 = require("./state");
const logger = new debug_1.Logger("PathReplay:Storage", debug_1.LogLevel.INFO);
function ensureDirectory() {
    if (!FS.exists(state_1.PATHS_DIR)) {
        FS.makeDir(state_1.PATHS_DIR);
    }
}
function savePath(name) {
    if (state_1.state.currentPath.length === 0) {
        logger.warn("Cannot save empty path.");
        return;
    }
    const data = { name, waypoints: state_1.state.currentPath };
    FS.open(state_1.PATHS_DIR + name + ".json").write(JSON.stringify(data, null, 2));
    logger.info(`Path §b${name}§f saved with §b${state_1.state.currentPath.length}§f points.`);
}
function loadPath(name) {
    const file = state_1.PATHS_DIR + name + ".json";
    if (!FS.exists(file)) {
        logger.error(`Path §b${name}§f not found.`);
        return false;
    }
    try {
        const data = JSON.parse(FS.open(file).read());
        state_1.state.currentPath = data.waypoints;
        state_1.state.loadedPathName = name;
        logger.info(`Loaded path §b${name}§f with §b${state_1.state.currentPath.length}§f points.`);
        return true;
    }
    catch (e) {
        logger.error(`Failed to load path §b${name}§f: ${e}`);
        return false;
    }
}
function listPaths() {
    const files = FS.list(state_1.PATHS_DIR);
    if (!files)
        return [];
    return files.filter(f => f.endsWith(".json")).map(f => f.replace(".json", ""));
}

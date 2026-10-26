"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.draw2d = exports.draw3d = void 0;
exports.updateHUD = updateHUD;
exports.registerHUDs = registerHUDs;
exports.unregisterHUDs = unregisterHUDs;
const state_1 = require("./state");
const math_1 = require("../../utils/math");
exports.draw3d = Hud.createDraw3D();
exports.draw2d = Hud.createDraw2D();
let statusTextElement = null;
exports.draw2d.setOnInit(JavaWrapper.methodToJava(() => {
    statusTextElement = exports.draw2d.addText("", 10, 50, 0xffffff, true);
}));
function updateHUD() {
    exports.draw3d.clear();
    // 3D Path Lines
    if (state_1.state.currentPath.length > 0) {
        for (let i = 0; i < state_1.state.currentPath.length; i++) {
            const p1 = state_1.state.currentPath[i];
            // Draw waypoint box
            const isTarget = state_1.state.isReplaying && i === state_1.state.currentWaypointIndex;
            const isSelected = state_1.state.isEditing && i === state_1.state.selectedWaypointIndex;
            let boxColor = 0x55ff55; // Default Green
            if (isTarget)
                boxColor = 0x5555ff; // Replaying Target Blue
            if (isSelected)
                boxColor = 0xffaa00; // Editing Selected Orange
            exports.draw3d.addBox(p1.x - 0.2, p1.y, p1.z - 0.2, p1.x + 0.2, p1.y + 0.4, p1.z + 0.2, boxColor, isSelected ? 100 : 50, boxColor, 200, true);
            // Draw line to next waypoint
            if (i < state_1.state.currentPath.length - 1) {
                const p2 = state_1.state.currentPath[i + 1];
                const lineColor = state_1.state.isReplaying && i === state_1.state.currentWaypointIndex - 1
                    ? 0x5555ff
                    : 0x55ff55;
                exports.draw3d.addLine(p1.x, p1.y + 0.2, p1.z, p2.x, p2.y + 0.2, p2.z, lineColor, 255);
            }
        }
    }
    // 2D Status Overlay
    if (statusTextElement) {
        let statusText = "§7Path: " + (state_1.state.loadedPathName || "§8None");
        if (state_1.state.isRecording) {
            statusText = "§c● RECORDING §7- Points: §f" + state_1.state.currentPath.length;
        }
        else if (state_1.state.isEditing) {
            statusText = `§6✎ EDITING §f[${state_1.state.selectedWaypointIndex + 1}/${state_1.state.currentPath.length}]`;
        }
        else if (state_1.state.isReplaying) {
            const playerPos = Player.getPlayer().getPos();
            const targetWp = state_1.state.currentPath[state_1.state.currentWaypointIndex];
            const dist = targetWp ? Math.sqrt((0, math_1.getDistanceSq)(playerPos, targetWp)) : 0;
            const loopStr = state_1.state.isLooping ? " (LOOP)" : "";
            const speedStr = ` [${state_1.state.replaySpeed.toUpperCase()}]`;
            statusText = `§b▶ REPLAYING${loopStr}${speedStr} §f[${state_1.state.currentWaypointIndex + 1}/${state_1.state.currentPath.length}] §7- Dist: §f${dist.toFixed(1)}m`;
        }
        statusTextElement.setText(statusText);
    }
}
function registerHUDs() {
    exports.draw3d.register();
    exports.draw2d.register();
}
function unregisterHUDs() {
    exports.draw3d.unregister();
    exports.draw2d.unregister();
}

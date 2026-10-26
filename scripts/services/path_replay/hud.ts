import { state } from "./state";
import { getDistanceSq } from "../../utils/math";

export const draw3d = Hud.createDraw3D();
export const draw2d = Hud.createDraw2D();
let statusTextElement: any = null;

draw2d.setOnInit(
  JavaWrapper.methodToJava(() => {
    statusTextElement = draw2d.addText("", 10, 50, 0xffffff, true);
  }),
);

export function updateHUD() {
  draw3d.clear();

  // 3D Path Lines
  if (state.currentPath.length > 0) {
    for (let i = 0; i < state.currentPath.length; i++) {
      const p1 = state.currentPath[i];

      // Draw waypoint box
      const isTarget = state.isReplaying && i === state.currentWaypointIndex;
      const isSelected = state.isEditing && i === state.selectedWaypointIndex;

      let boxColor = 0x55ff55; // Default Green
      if (isTarget) boxColor = 0x5555ff; // Replaying Target Blue
      if (isSelected) boxColor = 0xffaa00; // Editing Selected Orange

      draw3d.addBox(
        p1.x - 0.2,
        p1.y,
        p1.z - 0.2,
        p1.x + 0.2,
        p1.y + 0.4,
        p1.z + 0.2,
        boxColor,
        isSelected ? 100 : 50,
        boxColor,
        200,
        true,
      );

      // Draw line to next waypoint
      if (i < state.currentPath.length - 1) {
        const p2 = state.currentPath[i + 1];
        const lineColor =
          state.isReplaying && i === state.currentWaypointIndex - 1
            ? 0x5555ff
            : 0x55ff55;
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
    let statusText = "§7Path: " + (state.loadedPathName || "§8None");
    if (state.isRecording) {
      statusText = "§c● RECORDING §7- Points: §f" + state.currentPath.length;
    } else if (state.isEditing) {
      statusText = `§6✎ EDITING §f[${state.selectedWaypointIndex + 1}/${state.currentPath.length}]`;
    } else if (state.isReplaying) {
      const playerPos = Player.getPlayer().getPos();
      const targetWp = state.currentPath[state.currentWaypointIndex];
      const dist = targetWp ? Math.sqrt(getDistanceSq(playerPos, targetWp)) : 0;
      const loopStr = state.isLooping ? " (LOOP)" : "";
      const speedStr = ` [${state.replaySpeed.toUpperCase()}]`;
      statusText = `§b▶ REPLAYING${loopStr}${speedStr} §f[${state.currentWaypointIndex + 1}/${state.currentPath.length}] §7- Dist: §f${dist.toFixed(1)}m`;
    }
    statusTextElement.setText(statusText);
  }
}

export function registerHUDs() {
  draw3d.register();
  draw2d.register();
}

export function unregisterHUDs() {
  draw3d.unregister();
  draw2d.unregister();
}

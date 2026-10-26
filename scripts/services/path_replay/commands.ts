import { Logger, LogLevel } from "../../utils/debug";
import { state } from "./state";
import {
  startReplay,
  stopEverything,
  toggleEditMode,
  editMoveSelected,
  editDeleteSelected,
  editInsert,
} from "./actions";
import { loadPath, savePath, listPaths } from "./storage";
import { applySpeed } from "./baritone";
import { updateHUD } from "./hud";

const logger = new Logger("PathReplay:Commands", LogLevel.INFO);

export const cmd = Chat.getCommandManager()
  .createCommandBuilder("path")
  .literalArg("record")
  .literalArg("start")
  .wordArg("name")
  .executes(
    JavaWrapper.methodToJava((ctx: any) => {
      const name = ctx.getArg("name");
      state.currentPath = [];
      state.loadedPathName = name;
      state.isRecording = true;
      state.isReplaying = false;
      logger.info(`Started recording path: §b${name}`);
      updateHUD();
    }),
  )
  .or()
  .or()
  .literalArg("add")
  .executes(
    JavaWrapper.methodToJava(() => {
      if (!state.isRecording) {
        logger.warn("Not recording. Use §b/path record start <name>§f first.");
        return;
      }
      const pos = Player.getPlayer().getPos();
      state.currentPath.push({ x: pos.x, y: pos.y, z: pos.z });
      logger.info(
        `Added waypoint §b#${state.currentPath.length}§f at ${Logger.formatPos(pos)}`,
      );
      updateHUD();
    }),
  )
  .or()
  .literalArg("remove")
  .executes(
    JavaWrapper.methodToJava(() => {
      if (!state.isRecording) {
        logger.warn("Not recording.");
        return;
      }
      if (state.currentPath.length > 0) {
        const removed = state.currentPath.pop();
        logger.info(`Removed last waypoint at ${Logger.formatPos(removed!)}`);
        updateHUD();
      }
    }),
  )
  .or()
  .literalArg("stop")
  .executes(
    JavaWrapper.methodToJava(() => {
      if (state.isRecording) {
        savePath(state.loadedPathName || "unnamed");
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
      if (loadPath(ctx.getArg("name"))) {
        updateHUD();
      }
    }),
  )
  .or()
  .or()
  .literalArg("edit")
  .executes(
    JavaWrapper.methodToJava(() => {
      toggleEditMode();
    }),
  )
  .literalArg("move")
  .executes(
    JavaWrapper.methodToJava(() => {
      editMoveSelected();
    }),
  )
  .or()
  .literalArg("delete")
  .executes(
    JavaWrapper.methodToJava(() => {
      editDeleteSelected();
    }),
  )
  .or()
  .literalArg("insert")
  .literalArg("after")
  .executes(
    JavaWrapper.methodToJava(() => {
      editInsert(true);
    }),
  )
  .or()
  .literalArg("before")
  .executes(
    JavaWrapper.methodToJava(() => {
      editInsert(false);
    }),
  )
  .or()
  .or()
  .or()
  .literalArg("speed")
  .literalArg("walk")
  .executes(
    JavaWrapper.methodToJava(() => {
      state.replaySpeed = "walk";
      if (state.isReplaying) applySpeed();
      logger.info("Replay speed set to: §bWALK");
      updateHUD();
    }),
  )
  .or()
  .literalArg("sprint")
  .executes(
    JavaWrapper.methodToJava(() => {
      state.replaySpeed = "sprint";
      if (state.isReplaying) applySpeed();
      logger.info("Replay speed set to: §bSPRINT");
      updateHUD();
    }),
  )
  .otherwise()
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
      state.currentPath = [];
      state.loadedPathName = null;
      stopEverything();
      logger.info("Path cleared.");
    }),
  )
  .or()
  .literalArg("list")
  .executes(
    JavaWrapper.methodToJava(() => {
      const paths = listPaths();
      if (paths.length === 0) {
        logger.info("No saved paths found.");
        return;
      }
      logger.info("Saved paths:");
      paths.forEach((p) => {
        logger.info(` - §b${p}`);
      });
    }),
  )
  .or()
  .literalArg("stop")
  .executes(
    JavaWrapper.methodToJava(() => {
      if (state.isRecording) {
        savePath(state.loadedPathName || "unnamed");
      }
      stopEverything();
      logger.info("Stopped recording/replay.");
    }),
  )
  .or();

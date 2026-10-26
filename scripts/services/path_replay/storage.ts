import { Logger, LogLevel } from "../../utils/debug";
import { state, PATHS_DIR } from "./state";
import type { PathData } from "./types";

const logger = new Logger("PathReplay:Storage", LogLevel.INFO);

export function ensureDirectory() {
  if (!FS.exists(PATHS_DIR)) {
    FS.makeDir(PATHS_DIR);
  }
}

export function savePath(name: string) {
  if (state.currentPath.length === 0) {
    logger.warn("Cannot save empty path.");
    return;
  }
  const data: PathData = { name, waypoints: state.currentPath };
  FS.open(PATHS_DIR + name + ".json").write(JSON.stringify(data, null, 2));
  logger.info(`Path §b${name}§f saved with §b${state.currentPath.length}§f points.`);
}

export function loadPath(name: string) {
  const file = PATHS_DIR + name + ".json";
  if (!FS.exists(file)) {
    logger.error(`Path §b${name}§f not found.`);
    return false;
  }
  try {
    const data: PathData = JSON.parse(FS.open(file).read());
    state.currentPath = data.waypoints;
    state.loadedPathName = name;
    logger.info(`Loaded path §b${name}§f with §b${state.currentPath.length}§f points.`);
    return true;
  } catch (e) {
    logger.error(`Failed to load path §b${name}§f: ${e}`);
    return false;
  }
}

export function listPaths(): string[] {
  const files = FS.list(PATHS_DIR);
  if (!files) return [];
  return files.filter(f => f.endsWith(".json")).map(f => f.replace(".json", ""));
}

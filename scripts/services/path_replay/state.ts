import type { Waypoint, ReplaySpeed } from "./types";

export const PATHS_DIR = "./path_replay_data/";

export const state = {
  currentPath: [] as Waypoint[],
  loadedPathName: null as string | null,
  isRecording: false,
  isReplaying: false,
  isLooping: false,
  isEditing: false,
  currentWaypointIndex: -1,
  selectedWaypointIndex: -1,
  
  // Double Sneak State
  lastSneakTime: 0,

  // Speed Control
  replaySpeed: "walk" as ReplaySpeed,
  originalAllowSprint: null as boolean | null,
};

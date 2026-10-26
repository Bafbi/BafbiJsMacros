"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.state = exports.PATHS_DIR = void 0;
exports.PATHS_DIR = "./path_replay_data/";
exports.state = {
    currentPath: [],
    loadedPathName: null,
    isRecording: false,
    isReplaying: false,
    isLooping: false,
    isEditing: false,
    currentWaypointIndex: -1,
    selectedWaypointIndex: -1,
    // Double Sneak State
    lastSneakTime: 0,
    // Speed Control
    replaySpeed: "walk",
    originalAllowSprint: null,
};

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VEIN_WEIGHTS = void 0;
exports.sortTargets = sortTargets;
/**
 * Vein mining heuristics and sorting logic for AutoWood.
 */
const math_1 = require("../../../utils/math");
exports.VEIN_WEIGHTS = {
    CURSOR: 2.0, // Priority for blocks the player is looking at
    VEIN_DISTANCE: 10.0, // Priority for keeping distance to last block low
    PLAYER_DISTANCE: 0.5, // Priority for distance to player (tie-breaker)
    ADJACENCY_BONUS: 1000.0, // Massive bonus for being an immediate neighbor to the last mined block
    VERTICAL_BONUS: 500.0 // Priority for mining up and down
};
/**
 * Sorts targets based on a weighted scoring system.
 * Lower score = higher priority.
 */
function sortTargets(targets, player, lastMinedPos, weights = exports.VEIN_WEIGHTS) {
    const eyePos = player.getEyePos();
    const playerYaw = player.getYaw();
    const playerPitch = player.getPitch();
    // Map to score first to avoid recalculating during sort comparisons
    const scoredTargets = targets.map(t => {
        const score = calculateScore(t, eyePos, playerYaw, playerPitch, lastMinedPos, weights);
        return { target: t, score };
    });
    // Sort by score ascending
    scoredTargets.sort((a, b) => a.score - b.score);
    return scoredTargets.map(item => item.target);
}
function calculateScore(target, eyePos, playerYaw, playerPitch, lastMinedPos, weights) {
    let score = 0;
    // 1. Cursor Alignment (Angle difference)
    // How close is this block to the crosshair?
    const rotations = (0, math_1.getRotations)(eyePos, { x: target.cx, y: target.cy, z: target.cz });
    const yawDiff = (0, math_1.getAngleDiff)(playerYaw, rotations.yaw);
    const pitchDiff = (0, math_1.getAngleDiff)(playerPitch, rotations.pitch);
    const totalAngleDiff = Math.sqrt(yawDiff * yawDiff + pitchDiff * pitchDiff);
    score += totalAngleDiff * weights.CURSOR;
    // 2. Vein Continuity (Distance to last mined)
    // If we just mined a block, we want to mine the one next to it to form a "line" or "vein"
    if (lastMinedPos) {
        const distToLastSq = (0, math_1.getDistanceSq)(lastMinedPos, { x: target.cx, y: target.cy, z: target.cz });
        const distToLast = Math.sqrt(distToLastSq);
        score += distToLast * weights.VEIN_DISTANCE;
        // Adjacency Bonus: If it's a direct neighbor (Face/Edge/Corner), prioritize it massively
        // max dist for corner is sqrt(1^2 + 1^2 + 1^2) = 1.732. Squared is 3.
        // We use 3.5 to be safe with floating point.
        if (distToLastSq <= 3.5) {
            score -= weights.ADJACENCY_BONUS;
            // "Linear" preference: Prefer face-connected blocks (dist 1) over diagonal (dist 2 or 3)
            // This encourages breaking in a line rather than jumping diagonals unnecessarily
            if (distToLastSq <= 1.2) {
                score -= (weights.ADJACENCY_BONUS * 0.5); // Extra bonus for face connection
            }
        }
    }
    // 3. Vertical Priority (Up/Down)
    // Prioritize mining blocks above or below the last mined block
    if (lastMinedPos) {
        const dy = Math.abs(target.cy - lastMinedPos.y);
        const dx = Math.abs(target.cx - lastMinedPos.x);
        const dz = Math.abs(target.cz - lastMinedPos.z);
        // If it's vertically aligned (same x/z column) and close, give it a bonus
        if (dx < 0.1 && dz < 0.1 && dy > 0.5) {
            score -= weights.VERTICAL_BONUS;
        }
    }
    // 4. Player Distance (General proximity)
    // Tie-breaker: closer to player is generally better
    const distToPlayerSq = (0, math_1.getDistanceSq)(eyePos, { x: target.cx, y: target.cy, z: target.cz });
    score += Math.sqrt(distToPlayerSq) * weights.PLAYER_DISTANCE;
    return score;
}

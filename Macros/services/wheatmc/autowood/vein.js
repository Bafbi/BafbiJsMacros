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
    MOMENTUM: 100.0, // Priority for blocks in the path of the cursor movement
    VEIN_DISTANCE: 10.0, // Priority for keeping distance to last block low
    PLAYER_DISTANCE: 0.5, // Priority for distance to player (tie-breaker)
    ADJACENCY_BONUS: 1000.0, // Massive bonus for being an immediate neighbor to the last mined block
    VERTICAL_BONUS: 500.0, // Priority for mining up and down
};
/**
 * Sorts targets based on a weighted scoring system.
 * Lower score = higher priority.
 */
function sortTargets(targets, player, lastMinedPos, aimVelocity = null, weights = exports.VEIN_WEIGHTS) {
    const eyePos = player.getEyePos();
    const playerYaw = player.getYaw();
    const playerPitch = player.getPitch();
    // Map to score first to avoid recalculating during sort comparisons
    const scoredTargets = targets.map((t) => {
        const score = calculateScore(t, eyePos, playerYaw, playerPitch, lastMinedPos, aimVelocity, weights);
        return { target: t, score };
    });
    // Sort by score ascending
    scoredTargets.sort((a, b) => a.score - b.score);
    return scoredTargets.map((item) => item.target);
}
function calculateScore(target, eyePos, playerYaw, playerPitch, lastMinedPos, aimVelocity, weights) {
    let score = 0;
    // 1. Cursor Alignment (Angle difference)
    const targetRot = (0, math_1.getRotations)(eyePos, {
        x: target.cx,
        y: target.cy,
        z: target.cz,
    });
    const yawDiff = (0, math_1.getAngleDiff)(playerYaw, targetRot.yaw);
    const pitchDiff = (0, math_1.getAngleDiff)(playerPitch, targetRot.pitch);
    const totalAngleDiff = Math.sqrt(yawDiff * yawDiff + pitchDiff * pitchDiff);
    score += totalAngleDiff * weights.CURSOR;
    // 2. Momentum Influence
    // If we are moving the cursor, prioritize blocks in that direction
    if (aimVelocity &&
        (Math.abs(aimVelocity.yaw) > 0.1 || Math.abs(aimVelocity.pitch) > 0.1)) {
        // Predict where the aim will be in N ticks
        const lookAheadTicks = 5;
        const predictedYaw = playerYaw + aimVelocity.yaw * lookAheadTicks;
        const predictedPitch = playerPitch + aimVelocity.pitch * lookAheadTicks;
        const predYawDiff = (0, math_1.getAngleDiff)(predictedYaw, targetRot.yaw);
        const predPitchDiff = (0, math_1.getAngleDiff)(predictedPitch, targetRot.pitch);
        const predAngleDiff = Math.sqrt(predYawDiff * predYawDiff + predPitchDiff * predPitchDiff);
        score += predAngleDiff * weights.MOMENTUM;
    }
    // 3. Vein Continuity (Distance to last mined)
    if (lastMinedPos) {
        const distToLastSq = (0, math_1.getDistanceSq)(lastMinedPos, {
            x: target.cx,
            y: target.cy,
            z: target.cz,
        });
        const distToLast = Math.sqrt(distToLastSq);
        score += distToLast * weights.VEIN_DISTANCE;
        if (distToLastSq <= 3.5) {
            score -= weights.ADJACENCY_BONUS;
            if (distToLastSq <= 1.2) {
                score -= weights.ADJACENCY_BONUS * 0.5;
            }
        }
    }
    // 4. Vertical Priority
    if (lastMinedPos) {
        const dy = Math.abs(target.cy - lastMinedPos.y);
        const dx = Math.abs(target.cx - lastMinedPos.x);
        const dz = Math.abs(target.cz - lastMinedPos.z);
        if (dx < 0.1 && dz < 0.1 && dy > 0.5) {
            score -= weights.VERTICAL_BONUS;
        }
    }
    // 5. Player Distance
    const distToPlayerSq = (0, math_1.getDistanceSq)(eyePos, {
        x: target.cx,
        y: target.cy,
        z: target.cz,
    });
    score += Math.sqrt(distToPlayerSq) * weights.PLAYER_DISTANCE;
    return score;
}

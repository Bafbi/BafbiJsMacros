"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.interpolateAngle = interpolateAngle;
exports.updateAim = updateAim;
const math_1 = require("../../../utils/math");
/**
 * Handles smooth interpolation of the player's gaze towards a target.
 */
/**
 * Interpolates between two angles, handling the 360-degree wrap-around.
 * Includes clamping to ensure a minimum speed (for snapping) and maximum speed.
 */
function interpolateAngle(current, target, factor, minSpeed = 0, maxSpeed = 180) {
    const diff = (0, math_1.getAngleDiff)(current, target);
    if (Math.abs(diff) < 0.01)
        return target; // Already there
    let step = diff * factor;
    const absStep = Math.abs(step);
    const absDiff = Math.abs(diff);
    // Apply min speed to prevent infinite slowdown at the end
    if (absStep < minSpeed) {
        step = Math.sign(diff) * Math.min(minSpeed, absDiff);
    }
    // Apply max speed to prevent disorienting jumps
    if (absStep > maxSpeed) {
        step = Math.sign(diff) * maxSpeed;
    }
    // Prevent overshooting
    if (Math.abs(step) >= absDiff) {
        return target;
    }
    return current + step;
}
/**
 * Calculates the next look position for the player and applies it if within thresholds.
 * @returns {boolean} Whether the player is now looking towards the target.
 */
function updateAim(player, target, config, eyePos, targetRot) {
    const currentYaw = player.getYaw();
    const currentPitch = player.getPitch();
    const nextYaw = interpolateAngle(currentYaw, targetRot.yaw, config.INTERPOLATION_SPEED, config.MIN_ROTATION_SPEED, config.MAX_ROTATION_SPEED);
    const nextPitch = interpolateAngle(currentPitch, targetRot.pitch, config.INTERPOLATION_SPEED, config.MIN_ROTATION_SPEED, config.MAX_ROTATION_SPEED);
    // Only apply interpolation if we are within the threshold
    const yawDiff = (0, math_1.getAngleDiff)(currentYaw, targetRot.yaw);
    const pitchDiff = (0, math_1.getAngleDiff)(currentPitch, targetRot.pitch);
    const totalDiff = Math.sqrt(yawDiff * yawDiff + pitchDiff * pitchDiff);
    if (totalDiff <= config.INTERPOLATION_THRESHOLD) {
        player.lookAt(nextYaw, nextPitch);
        return true;
    }
    return false;
}

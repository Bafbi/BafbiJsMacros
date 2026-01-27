"use strict";
/**
 * Common 3D math and rotation utilities for Minecraft.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRotations = getRotations;
exports.getAngleDiff = getAngleDiff;
exports.getDistanceSq = getDistanceSq;
exports.getClosestFace = getClosestFace;
/**
 * Calculates yaw and pitch to face a target position from an eye position.
 */
function getRotations(eyePos, targetPos) {
    const dX = targetPos.x - eyePos.x;
    const dY = targetPos.y - eyePos.y;
    const dZ = targetPos.z - eyePos.z;
    const dist = Math.sqrt(dX * dX + dZ * dZ);
    // Minecraft Yaw is shifted 90 degrees
    const yaw = (Math.atan2(dZ, dX) * 180.0) / Math.PI - 90.0;
    const pitch = -((Math.atan2(dY, dist) * 180.0) / Math.PI);
    return { yaw, pitch };
}
/**
 * Gets the shortest difference between two angles in degrees (-180 to 180).
 */
function getAngleDiff(current, target) {
    let diff = target - current;
    while (diff < -180)
        diff += 360;
    while (diff > 180)
        diff -= 360;
    return diff;
}
/**
 * Calculates the squared distance between two 3D positions.
 */
function getDistanceSq(pos1, pos2) {
    const dX = pos1.x - pos2.x;
    const dY = pos1.y - pos2.y;
    const dZ = pos1.z - pos2.z;
    return dX * dX + dY * dY + dZ * dZ;
}
/**
 * Calculates the center points of the 6 faces of a block and returns the one closest to the observer.
 */
function getClosestFace(eyePos, bx, by, bz) {
    const faces = [
        { x: bx + 0.5, y: by, z: bz + 0.5 }, // Bottom
        { x: bx + 0.5, y: by + 1.0, z: bz + 0.5 }, // Top
        { x: bx, y: by + 0.5, z: bz + 0.5 }, // West
        { x: bx + 1.0, y: by + 0.5, z: bz + 0.5 }, // East
        { x: bx + 0.5, y: by + 0.5, z: bz }, // North
        { x: bx + 0.5, y: by + 0.5, z: bz + 1.0 }, // South
    ];
    let closest = faces[0];
    let minDistSq = Infinity;
    for (const face of faces) {
        const dSq = getDistanceSq(eyePos, face);
        if (dSq < minDistSq) {
            minDistSq = dSq;
            closest = face;
        }
    }
    return closest;
}

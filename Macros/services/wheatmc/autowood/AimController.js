"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AimController = void 0;
const math_1 = require("../../../utils/math");
/**
 * Manages humanized aiming behavior, including random face offsets,
 * visibility checks for those offsets, and smooth sway noise.
 * Now accounts for player movement to adjust responsiveness and stability.
 */
class AimController {
    lastTargetKey = null;
    currentOffset = { x: 0, y: 0, z: 0 };
    noiseTime = Math.random() * 1000;
    lastEyePos = null;
    velocity = { yaw: 0, pitch: 0 };
    /**
     * Returns the current angular velocity of the aim.
     */
    getVelocity() {
        return { ...this.velocity };
    }
    /**
     * Calculates the humanized target position and applies aim updates.
     */
    update(player, target, config) {
        const eyePos = player.getEyePos();
        const targetKey = `${target.x},${target.y},${target.z}`;
        // 1. Calculate Velocity for Dynamic Adjustments
        let speed = 0;
        if (this.lastEyePos) {
            speed = Math.sqrt((0, math_1.getDistanceSq)(this.lastEyePos, eyePos));
        }
        this.lastEyePos = { x: eyePos.x, y: eyePos.y, z: eyePos.z };
        // 2. Handle Target Switching & Random Offset
        if (targetKey !== this.lastTargetKey) {
            this.lastTargetKey = targetKey;
            this.currentOffset = this.generateVisibleOffset(eyePos, target, config);
        }
        // 3. Calculate Base Target with Offset
        const aimPos = {
            x: target.cx + this.currentOffset.x,
            y: target.cy + this.currentOffset.y,
            z: target.cz + this.currentOffset.z
        };
        // 4. Calculate Rotations
        const rotations = (0, math_1.getRotations)(eyePos, aimPos);
        // 5. Apply Smooth Sway (Scaled by movement speed)
        this.noiseTime += 0.05;
        const sway = this.calculateSway(config, speed);
        rotations.yaw += sway.yaw;
        rotations.pitch += sway.pitch;
        // 5.1 Clamp Target Pitch
        const minPitch = config.MIN_PITCH ?? -90;
        const maxPitch = config.MAX_PITCH ?? 90;
        rotations.pitch = Math.max(minPitch, Math.min(maxPitch, rotations.pitch));
        // 6. Apply Physics-based Movement (Inertia + Acceleration)
        return this.applyPhysicsMovement(player, rotations, config);
    }
    /**
     * Generates a random offset on the face and verifies it is visible.
     */
    generateVisibleOffset(eyePos, target, config) {
        const maxOffset = 0.25;
        for (let i = 0; i < 5; i++) {
            const off = {
                x: (Math.random() - 0.5) * maxOffset * 2,
                y: (Math.random() - 0.5) * maxOffset * 2,
                z: (Math.random() - 0.5) * maxOffset * 2
            };
            const blockCenter = { x: target.x + 0.5, y: target.y + 0.5, z: target.z + 0.5 };
            if (Math.abs(target.cx - blockCenter.x) > 0.4)
                off.x = 0;
            if (Math.abs(target.cy - blockCenter.y) > 0.4)
                off.y = 0;
            if (Math.abs(target.cz - blockCenter.z) > 0.4)
                off.z = 0;
            const testPos = { x: target.cx + off.x, y: target.cy + off.y, z: target.cz + off.z };
            const hit = World.rayTraceBlock(eyePos.x, eyePos.y, eyePos.z, testPos.x, testPos.y, testPos.z, false);
            if (!hit)
                return off;
            const hp = hit.getBlockPos();
            if (hp.getX() === target.x && hp.getY() === target.y && hp.getZ() === target.z) {
                return off;
            }
        }
        return { x: 0, y: 0, z: 0 };
    }
    /**
     * Sum of sines for smooth pseudo-random sway.
     * Shakes more when moving fast.
     */
    calculateSway(config, speed) {
        const baseAmp = config.SWAY_AMPLITUDE || 0.15;
        const freq = config.SWAY_FREQUENCY || 1.0;
        // Increase amplitude when moving (speed is typically 0 to 0.3 blocks/tick)
        const movingMultiplier = 1.0 + (speed * 4.0);
        const amp = baseAmp * movingMultiplier;
        const t = this.noiseTime * freq;
        const yawSway = (Math.sin(t) + Math.sin(t * 1.7) * 0.5 + Math.sin(t * 2.3) * 0.25) * amp;
        const pitchSway = (Math.cos(t * 0.9) + Math.cos(t * 1.5) * 0.5 + Math.cos(t * 2.1) * 0.25) * amp;
        return { yaw: yawSway, pitch: pitchSway };
    }
    /**
     * Applies physics-based movement with acceleration and damping.
     */
    applyPhysicsMovement(player, targetRot, config) {
        const currentYaw = player.getYaw();
        const currentPitch = player.getPitch();
        const yawDiff = (0, math_1.getAngleDiff)(currentYaw, targetRot.yaw);
        const pitchDiff = (0, math_1.getAngleDiff)(currentPitch, targetRot.pitch);
        // Physics constants
        const stiffness = config.AIM_STIFFNESS || 0.12;
        const damping = config.AIM_DAMPING || 0.65;
        const minStep = config.MIN_ROTATION_SPEED || 0.1;
        const maxStep = config.MAX_ROTATION_SPEED || 180.0;
        // Calculate acceleration (spring force)
        const yawAcc = yawDiff * stiffness;
        const pitchAcc = pitchDiff * stiffness;
        // Update velocity with damping (friction)
        this.velocity.yaw = (this.velocity.yaw + yawAcc) * damping;
        this.velocity.pitch = (this.velocity.pitch + pitchAcc) * damping;
        // Limit velocity to max speed
        const currentVelMag = Math.sqrt(this.velocity.yaw ** 2 + this.velocity.pitch ** 2);
        if (currentVelMag > maxStep) {
            const scale = maxStep / currentVelMag;
            this.velocity.yaw *= scale;
            this.velocity.pitch *= scale;
        }
        // Ensure we don't crawl too slowly if we are far away
        if (Math.abs(yawDiff) > 0.5 && Math.abs(this.velocity.yaw) < minStep) {
            this.velocity.yaw = Math.sign(yawDiff) * minStep;
        }
        if (Math.abs(pitchDiff) > 0.5 && Math.abs(this.velocity.pitch) < minStep) {
            this.velocity.pitch = Math.sign(pitchDiff) * minStep;
        }
        // Apply movement
        const nextYaw = currentYaw + this.velocity.yaw;
        let nextPitch = currentPitch + this.velocity.pitch;
        // Clamp nextPitch to limits
        const minPitch = config.MIN_PITCH ?? -90;
        const maxPitch = config.MAX_PITCH ?? 90;
        nextPitch = Math.max(minPitch, Math.min(maxPitch, nextPitch));
        player.lookAt(nextYaw, nextPitch);
        // Return true if we are reasonably close to target
        const totalDiff = Math.sqrt(yawDiff * yawDiff + pitchDiff * pitchDiff);
        return totalDiff <= (config.INTERPOLATION_THRESHOLD || 1.0);
    }
}
exports.AimController = AimController;

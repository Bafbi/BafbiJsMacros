"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const debug_1 = require("../../utils/debug");
const logger = new debug_1.Logger("AntiBedrock", debug_1.LogLevel.TRACE);
const draw3d = Hud.createDraw3D();
// Configuration
const BEDROCK_ID = "minecraft:bedrock";
const GHOST_DURATION_MS = 3000; // 3 seconds visibility
// State: Map<"x,y,z", GhostBlock>
const ghostBlocks = new Map();
/**
 * Safely resolves a class using multiple possible names.
 */
function resolveClass(name1, name2) {
    try {
        // Cast to any to avoid Type$Reflection vs JavaClass mismatch in some mapping envs
        return Reflection.getClass(name1, name2);
    }
    catch (e) {
        logger.warn(`Failed to resolve class ${name1} / ${name2}`);
        return null;
    }
}
// Resolved Classes for efficient matching
const BundlePacketClass = resolveClass("net.minecraft.network.packet.s2c.common.BundleS2CPacket", "net.minecraft.class_8042");
const BlockUpdatePacketClass = resolveClass("net.minecraft.network.packet.s2c.play.BlockUpdateS2CPacket", "net.minecraft.class_2614");
const SectionBlocksUpdatePacketClass = resolveClass("net.minecraft.network.packet.s2c.play.ChunkDeltaUpdateS2CPacket", "net.minecraft.class_3944");
/**
 * Intercept BlockUpdate packets to hide Bedrock.
 */
const onRecvPacket = JavaWrapper.methodToJava((event) => {
    const packet = event.packet;
    if (!packet)
        return;
    // Handle bundles by unpacking them
    if (BundlePacketClass && BundlePacketClass.isInstance(packet)) {
        logger.trace("Unpacking BundleS2CPacket via Reflection");
        const packets = getBundlePackets(packet);
        if (packets) {
            event.cancel();
            const it = packets.iterator();
            let count = 0;
            let blockedCount = 0;
            while (it.hasNext()) {
                const p = it.next();
                count++;
                // Log the class of each packet in the bundle for debugging
                logger.trace(`Bundle packet #${count}: ${p.getClass().getName()}`);
                // Inline Filtering for bundled packets
                if (BlockUpdatePacketClass && BlockUpdatePacketClass.isInstance(p)) {
                    if (checkSingleBlockUpdate(p)) {
                        blockedCount++;
                        continue; // Skip re-injection for this specific packet
                    }
                }
                else if (SectionBlocksUpdatePacketClass &&
                    SectionBlocksUpdatePacketClass.isInstance(p)) {
                    checkSectionBlocksUpdate(p);
                    // Re-inject section updates because they might contain non-bedrock blocks
                }
                // Re-inject individual packets.
                Client.receivePacket(p);
            }
            logger.debug(`Processed bundle: ${count} total, ${blockedCount} bedrock updates blocked.`);
        }
        return;
    }
    // Handle single block update (Standalone)
    if (BlockUpdatePacketClass && BlockUpdatePacketClass.isInstance(packet)) {
        if (checkSingleBlockUpdate(packet)) {
            event.cancel();
        }
    }
    // Handle multi-block update in a section (Standalone)
    else if (SectionBlocksUpdatePacketClass &&
        SectionBlocksUpdatePacketClass.isInstance(packet)) {
        checkSectionBlocksUpdate(packet);
    }
});
/**
 * Uses jOOR reflection to find the packet list in a bundle packet.
 */
function getBundlePackets(packet) {
    try {
        const reflect = Reflection.getReflect(packet);
        // Search for any method returning Iterable/Collection/List
        const methods = reflect.type().getDeclaredMethods();
        for (let i = 0; i < methods.length; i++) {
            const m = methods[i];
            if (m.getParameterCount() === 0) {
                const returnType = m.getReturnType().getName();
                if (returnType.includes("Iterable") ||
                    returnType.includes("Collection") ||
                    returnType.includes("List")) {
                    return reflect.call(m.getName()).get();
                }
            }
        }
        // Search for any field with those types
        const fields = reflect.type().getDeclaredFields();
        for (let i = 0; i < fields.length; i++) {
            const f = fields[i];
            const typeName = f.getType().getName();
            if (typeName.includes("Iterable") ||
                typeName.includes("Collection") ||
                typeName.includes("List")) {
                return reflect.get(f.getName());
            }
        }
    }
    catch (e) {
        logger.error("Error finding bundle packets: " + e);
    }
    return null;
}
function checkSingleBlockUpdate(packet) {
    try {
        const reflect = Reflection.getReflect(packet);
        let pos = null;
        let isBedrock = false;
        const fields = reflect.type().getDeclaredFields();
        for (let i = 0; i < fields.length; i++) {
            const f = fields[i];
            const typeName = f.getType().getName();
            const val = reflect.get(f.getName());
            if (!val)
                continue;
            if (typeName.includes("BlockPos")) {
                pos = val;
            }
            else if (typeName.includes("BlockState")) {
                const stateStr = val.toString();
                if (stateStr.includes(BEDROCK_ID) || stateStr.includes("bedrock")) {
                    isBedrock = true;
                }
            }
        }
        if (pos && isBedrock) {
            logger.info(`Cancelled single bedrock update at ${debug_1.Logger.formatPos(pos)}`);
            addGhostBlock(pos.getX(), pos.getY(), pos.getZ());
            return true;
        }
    }
    catch (e) {
        logger.error("Error in single block update: " + e);
    }
    return false;
}
function checkSectionBlocksUpdate(packet) {
    try {
        const reflect = Reflection.getReflect(packet);
        let sectionPos = null;
        let positions = null; // short[]
        let states = null; // BlockState[]
        const fields = reflect.type().getDeclaredFields();
        for (let i = 0; i < fields.length; i++) {
            const f = fields[i];
            const typeName = f.getType().getName();
            const val = reflect.get(f.getName());
            if (!val)
                continue;
            if (typeName.includes("SectionPos")) {
                sectionPos = val;
            }
            else if (f.getType().isArray()) {
                const componentType = f.getType().getComponentType().getName();
                if (componentType === "short") {
                    positions = val;
                }
                else if (componentType.includes("BlockState")) {
                    states = val;
                }
            }
        }
        if (sectionPos && positions && states) {
            const baseX = sectionPos.getX() << 4;
            const baseY = sectionPos.getY() << 4;
            const baseZ = sectionPos.getZ() << 4;
            let containsBedrock = false;
            for (let i = 0; i < states.length; i++) {
                const stateStr = states[i].toString();
                if (stateStr.includes(BEDROCK_ID) || stateStr.includes("bedrock")) {
                    const relPos = positions[i];
                    const x = (relPos >> 8) & 0xf;
                    const z = (relPos >> 4) & 0xf;
                    const y = relPos & 0xf;
                    const gx = baseX + x;
                    const gy = baseY + y;
                    const gz = baseZ + z;
                    logger.info(`Detected bedrock in section update at (${gx}, ${gy}, ${gz})`);
                    addGhostBlock(gx, gy, gz);
                    containsBedrock = true;
                }
            }
            return containsBedrock;
        }
    }
    catch (e) {
        logger.error("Error in section blocks update: " + e);
    }
    return false;
}
function addGhostBlock(x, y, z) {
    const key = `${x},${y},${z}`;
    if (!ghostBlocks.has(key)) {
        logger.debug(`Adding ghost block at (${x}, ${y}, ${z})`);
    }
    ghostBlocks.set(key, {
        pos: { x, y, z },
        expires: Date.now() + GHOST_DURATION_MS,
    });
}
/**
 * Update loop to render red boxes and clean up old ones.
 */
const onTick = JavaWrapper.methodToJava(() => {
    const now = Date.now();
    for (const [key, data] of ghostBlocks.entries()) {
        if (now > data.expires) {
            logger.trace(`Ghost block expired at (${data.pos.x}, ${data.pos.y}, ${data.pos.z})`);
            ghostBlocks.delete(key);
        }
    }
    draw3d.clear();
    if (ghostBlocks.size > 0) {
        for (const data of ghostBlocks.values()) {
            const { x, y, z } = data.pos;
            draw3d.addBox(x, y, z, x + 1, y + 1, z + 1, 0xff0000, 150, 0xff0000, 60, true, false);
        }
    }
});
// --- Startup ---
draw3d.register();
const packetListener = JsMacros.on("RecvPacket", onRecvPacket);
const tickListener = JsMacros.on("Tick", onTick);
logger.info("AntiBedrock Service Started");
// --- Shutdown ---
event.stopListener = JavaWrapper.methodToJava(() => {
    draw3d.unregister();
    JsMacros.off(packetListener);
    JsMacros.off(tickListener);
    logger.info("AntiBedrock Service Stopped");
});

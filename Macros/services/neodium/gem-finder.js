"use strict";
/// <reference path="../../../headers/JsMacrosCE-2.0.0-dev-fcda711.d.ts" />
/// <reference path="../../../headers/Minecraft.d.ts" />
Object.defineProperty(exports, "__esModule", { value: true });
const debug_1 = require("../../utils/debug");
/**
 * GemFinder — Efficient block scanning service.
 *
 * Scans newly loaded chunks for a target block (set via /blockscan)
 * and renders a glowing highlight around all matching blocks.
 *
 * Features:
 *  - Listen to ChunkLoad events for efficient incremental scanning
 *  - Initial scan of all loaded chunks on service start
 *  - Uses `World.findBlocksMatching` for reliable block matching
 *  - Filter by block ID and optional block state properties
 *  - Click-through /blockscan set to capture the block you're looking at
 *  - Draw3D glow effect (glowing green box + beam) on every found block
 *  - Distance-based culling: no highlighting beyond 64 blocks
 *  - Debug probe command for diagnosing scan issues
 */
JsMacros.assertEvent(event, "Service");
// ─── Logging ────────────────────────────────────────────────────────────────
const logger = new debug_1.Logger("GemFinder", debug_1.LogLevel.WARN);
// ─── Draw3D for the glow effect ─────────────────────────────────────────────
const draw3d = Hud.createDraw3D();
// ─── Configuration ──────────────────────────────────────────────────────────
const CONFIG = {
    /** Scan radius (in chunks) around the player for the initial scan */
    INITIAL_CHUNK_RADIUS: 10,
    /** Maximum distance (blocks) to keep highlighting a found block */
    CULL_DISTANCE: 64,
    /** How often (in ticks) to refresh the 3D visuals and cull stale positions */
    TICK_INTERVAL: 5,
    /** Scan interval (in ticks) — re-scans nearby chunks periodically */
    RESCAN_INTERVAL_TICKS: 200,
    /** Distance the player must move before a sphere re-scan triggers */
    MOVE_RESCAN_THRESHOLD: 4,
    /** Color used for the glow effect (RGBA) */
    GLOW_COLOR: 0x00ff00,
    GLOW_ALPHA: 120,
    GLOW_FILL_ALPHA: 25,
    /** Color for the trace beam pointing at the block */
    BEAM_COLOR: 0x00ff00,
    BEAM_ALPHA: 200,
    /** Maximum number of closest blocks to highlight */
    MAX_HIGHLIGHTS: 20,
};
/** Filename (in the script's own directory) where the target block config is persisted */
const TARGET_FILE = "gem_finder_target.json";
// ─── State ──────────────────────────────────────────────────────────────────
/** The block ID to search for, e.g. "minecraft:diamond_ore" */
let targetId = null;
/** Optional block-state properties to match, e.g. { "lit": "true" } */
let targetProperties = null;
/** Human-readable name of what we're scanning for */
let targetDisplayName = null;
/** Cache of found matching blocks, keyed by "x,y,z" */
const foundBlocks = new Map();
/** Set of chunks we have already scanned (to avoid re-scanning) */
const scannedChunks = new Set();
/** World tick counter used for periodic maintenance */
let maintenanceTick = 0;
/** Player position at the time of the last sphere scan */
let lastScanPos = null;
/** Whether Baritone is available for pathfinding heuristics */
let baritoneAvailable = false;
// Try to load Baritone API (optional — degrades gracefully if absent)
(function initBaritone() {
    try {
        const BaritoneAPI = Java.type("baritone.api.BaritoneAPI");
        const baritone = BaritoneAPI.getProvider().getPrimaryBaritone();
        if (baritone) {
            baritoneAvailable = true;
            logger.info("Baritone detected — using pathfinding heuristic for distance estimation.");
        }
    }
    catch (e) {
        logger.debug("Baritone not found — using straight-line distance only.");
    }
})();
// ─── Helpers ────────────────────────────────────────────────────────────────
/**
 * Build a string key from chunk coordinates.
 */
function chunkKey(cx, cz) {
    return `${cx},${cz}`;
}
/**
 * Build a string key from block coordinates.
 */
function blockKey(x, y, z) {
    return `${x},${y},${z}`;
}
/**
 * Check if a block ID matches our current target filter.
 */
function matchesTarget(id) {
    if (!targetId)
        return false;
    return id === targetId;
}
/**
 * Check if block state properties match our target filter.
 * When there are no target properties (empty object), all blocks match.
 */
function matchesProperties(blockProps) {
    if (!targetProperties || Object.keys(targetProperties).length === 0)
        return true;
    for (const [key, value] of Object.entries(targetProperties)) {
        if (blockProps[key] !== value)
            return false;
    }
    return true;
}
/**
 * Convert a Java Map<string, string> to a plain JS object.
 */
function javaMapToObject(javaMap) {
    const obj = {};
    if (!javaMap)
        return obj;
    try {
        javaMap.forEach(JavaWrapper.methodToJava((value, key) => {
            obj[key] = value;
        }));
    }
    catch (e) {
        logger.warn("Failed to convert Java Map: " + e);
    }
    return obj;
}
// ─── Air Exposure Check ────────────────────────────────────────────────────
/** Block IDs considered "transparent enough" that a target block is visible through them. */
const AIR_LIKE = new Set([
    "minecraft:air",
    "minecraft:cave_air",
    "minecraft:void_air",
]);
/**
 * Check whether at least one face of the block at (x,y,z) is exposed to air.
 * A face is exposed if the adjacent block is air, cave_air, or void_air.
 */
function isExposedToAir(x, y, z) {
    const neighbors = [
        [x - 1, y, z],
        [x + 1, y, z],
        [x, y - 1, z],
        [x, y + 1, z],
        [x, y, z - 1],
        [x, y, z + 1],
    ];
    for (const [nx, ny, nz] of neighbors) {
        const neighbor = World.getBlock(nx, ny, nz);
        // Missing block = chunk unloaded or out of bounds = treat as exposed
        if (!neighbor)
            return true;
        if (AIR_LIKE.has(neighbor.getId()))
            return true;
    }
    return false;
}
/**
 * Check whether the player has a clear line of sight to the target face
 * of the block at (x, y, z). This tells us if the block is visible
 * or hidden behind other blocks.
 */
function isBlockVisible(x, y, z, eyePos) {
    // Raytrace to the block center — if it hits this block, it's visible
    const cx = x + 0.5;
    const cy = y + 0.5;
    const cz = z + 0.5;
    const hit = World.rayTraceBlock(eyePos.x, eyePos.y, eyePos.z, cx, cy, cz, false);
    if (!hit)
        return false;
    const hp = hit.getBlockPos();
    return hp.getX() === x && hp.getY() === y && hp.getZ() === z;
}
// ─── Persistence ─────────────────────────────────────────────────────────────
/**
 * Save the current target configuration to a JSON file so it survives service reloads.
 */
function saveTarget() {
    if (!targetId) {
        // Nothing to save — if the file exists, leave it so next start still has it
        return;
    }
    const data = {
        id: targetId,
        properties: targetProperties ?? {},
        displayName: targetDisplayName,
    };
    try {
        // Ensure the directory exists
        const dir = FS.getDir(TARGET_FILE);
        if (!FS.exists(dir)) {
            FS.makeDir(dir);
        }
        // Ensure the file exists before writing
        const fileName = FS.getName(TARGET_FILE);
        if (!FS.exists(TARGET_FILE)) {
            FS.createFile(dir, fileName);
        }
        FS.open(TARGET_FILE).write(JSON.stringify(data, null, 2));
    }
    catch (e) {
        logger.warn("Failed to save target config: " + e);
    }
}
/**
 * Load the target configuration from its JSON file, if present.
 * Returns `true` if a valid target was restored.
 */
function loadTarget() {
    if (!FS.exists(TARGET_FILE))
        return false;
    try {
        const raw = FS.open(TARGET_FILE).read();
        const data = JSON.parse(raw);
        if (!data.id)
            return false;
        targetId = data.id;
        targetProperties =
            data.properties && Object.keys(data.properties).length > 0
                ? data.properties
                : null;
        targetDisplayName = data.displayName ?? data.id;
        logger.info(`§a[GemFinder]§r Restored target: §b${targetDisplayName}§r (§7${targetId}§r)`);
        return true;
    }
    catch (e) {
        logger.warn("Failed to load target config: " + e);
        return false;
    }
}
/**
 * Delete the persisted target file (used on /blockscan clear).
 */
function deleteSavedTarget() {
    try {
        if (FS.exists(TARGET_FILE)) {
            FS.unlink(TARGET_FILE);
        }
    }
    catch (e) {
        logger.warn("Failed to delete target config: " + e);
    }
}
// ─── Block Scanning ─────────────────────────────────────────────────────────
/**
 * Check if a single block position matches the current target.
 * Uses World.getBlock() for a direct query.
 */
function checkBlockAt(x, y, z) {
    if (!targetId)
        return false;
    const block = World.getBlock(x, y, z);
    if (!block)
        return false;
    const id = block.getId();
    if (!matchesTarget(id))
        return false;
    if (targetProperties && Object.keys(targetProperties).length > 0) {
        const props = javaMapToObject(block.getBlockState());
        if (!matchesProperties(props))
            return false;
    }
    return true;
}
/**
 * Record a matching block position into our cache.
 */
function recordBlock(x, y, z, id) {
    const bKey = blockKey(x, y, z);
    if (!foundBlocks.has(bKey)) {
        foundBlocks.set(bKey, {
            x,
            y,
            z,
            id,
            properties: javaMapToObject(World.getBlock(x, y, z)?.getBlockState()),
            lastVerified: World.getTime(),
        });
    }
    else {
        const existing = foundBlocks.get(bKey);
        existing.lastVerified = World.getTime();
    }
}
/**
 * Scan results from findBlocksMatching and add matches to our cache.
 */
function processPositions(positions, label) {
    if (!positions)
        return 0;
    const size = positions.size();
    if (size === 0)
        return 0;
    let matched = 0;
    for (let i = 0; i < size; i++) {
        const pos = positions.get(i);
        // Pos3D has getX(), getY(), getZ()
        const x = pos.getX();
        const y = pos.getY();
        const z = pos.getZ();
        // Verify with direct block query + property check
        if (checkBlockAt(x, y, z)) {
            recordBlock(x, y, z, targetId);
            matched++;
        }
    }
    if (matched > 0) {
        logger.debug(`${label}: ${matched} matches found`);
    }
    return matched;
}
/**
 * Scan a single chunk using World.findBlocksMatching (range 0 = this chunk only).
 */
function scanSingleChunk(cx, cz) {
    if (!targetId)
        return;
    if (!World.isWorldLoaded())
        return;
    const key = chunkKey(cx, cz);
    if (scannedChunks.has(key))
        return;
    scannedChunks.add(key);
    // Property filter as a Java method wrapper (if we have properties to filter)
    let stateFilter = null;
    if (targetProperties && Object.keys(targetProperties).length > 0) {
        stateFilter = JavaWrapper.methodToJava((state) => {
            const id = state.getId();
            if (!matchesTarget(id))
                return false;
            // Note: BlockStateHelper properties can be accessed differently
            // We already do a secondary check via checkBlockAt
            return true;
        });
    }
    const positions = World.findBlocksMatching(cx, cz, JavaWrapper.methodToJava((block) => {
        return matchesTarget(block.getId());
    }), stateFilter, 0);
    const count = processPositions(positions, `Chunk [${cx}, ${cz}]`);
    if (count > 0) {
        logger.info(`Found ${count} ${targetId} in chunk [${cx}, ${cz}]`);
    }
}
/**
 * Scan a sphere of blocks around the player via World.iterateSphere.
 * Used as primary scan method for immediate surroundings.
 */
function scanSphereAroundPlayer(radius) {
    if (!World.isWorldLoaded())
        return 0;
    const player = Player.getPlayer();
    if (!player || !targetId)
        return 0;
    const centerPos = player.getBlockPos();
    let matched = 0;
    World.iterateSphere(centerPos, radius, false, // skip air
    JavaWrapper.methodToJava((block) => {
        const id = block.getId();
        if (!matchesTarget(id))
            return true;
        const bp = block.getBlockPos();
        const x = bp.getX();
        const y = bp.getY();
        const z = bp.getZ();
        const blockProps = javaMapToObject(block.getBlockState());
        if (!matchesProperties(blockProps))
            return true;
        recordBlock(x, y, z, id);
        matched++;
        return true;
    }));
    if (matched > 0) {
        logger.debug(`Sphere scan found ${matched} blocks within ${radius}m`);
    }
    return matched;
}
/**
 * Full scan: scan all loaded chunks via findBlocksMatching + sphere fallback.
 */
function scanAllLoadedChunks() {
    if (!World.isWorldLoaded())
        return;
    const player = Player.getPlayer();
    if (!player || !targetId)
        return;
    const playerChunkX = Math.floor(player.getX()) >> 4;
    const playerChunkZ = Math.floor(player.getZ()) >> 4;
    const range = CONFIG.INITIAL_CHUNK_RADIUS;
    let chunkCount = 0;
    let totalFound = 0;
    // Primary: scan loaded chunks via findBlocksMatching (range per chunk)
    for (let dx = -range; dx <= range; dx += 2) {
        for (let dz = -range; dz <= range; dz += 2) {
            const cx = playerChunkX + dx;
            const cz = playerChunkZ + dz;
            if (!World.isChunkLoaded(cx, cz))
                continue;
            // Use findBlocksMatching with a broader range (3x3 chunks) for efficiency
            const filter = JavaWrapper.methodToJava((block) => {
                return matchesTarget(block.getId());
            });
            const positions = World.findBlocksMatching(cx, cz, filter, null, 1);
            const found = processPositions(positions, `Chunk area [${cx}, ${cz}]`);
            totalFound += found;
            chunkCount++;
        }
    }
    // Secondary: sphere scan for the immediate area (catches blocks in edge cases)
    const sphereFound = scanSphereAroundPlayer(20);
    logger.info(`Scan: ${chunkCount} chunk areas + sphere, ${foundBlocks.size} total blocks found`);
}
// ─── Visuals / Glow Effect ──────────────────────────────────────────────────
/**
 * Refresh the 3D glow effect on all found blocks.
 * Removes highlights for blocks that are too far or in unloaded chunks.
 */
function updateVisuals() {
    draw3d.clear();
    if (!World.isWorldLoaded() || !targetId)
        return;
    const player = Player.getPlayer();
    if (!player)
        return;
    const px = player.getX();
    const pz = player.getZ();
    const cullSq = CONFIG.CULL_DISTANCE * CONFIG.CULL_DISTANCE;
    const toRemove = [];
    for (const [key, info] of foundBlocks.entries()) {
        const dx = info.x + 0.5 - px;
        const dz = info.z + 0.5 - pz;
        const distSq = dx * dx + dz * dz;
        // Cull if too far
        if (distSq > cullSq) {
            toRemove.push(key);
            continue;
        }
        // Cull if the block's chunk is no longer loaded
        const chunkX = info.x >> 4;
        const chunkZ = info.z >> 4;
        if (!World.isChunkLoaded(chunkX, chunkZ)) {
            toRemove.push(key);
            continue;
        }
        // Verify the block still exists — cull if it was mined/replaced
        const currentBlock = World.getBlock(info.x, info.y, info.z);
        if (!currentBlock || currentBlock.getId() !== targetId) {
            toRemove.push(key);
            continue;
        }
    } // End of for loop over foundBlocks
    // Clean up culled blocks
    for (const key of toRemove) {
        foundBlocks.delete(key);
    }
    // If nothing left, done
    if (foundBlocks.size === 0)
        return;
    // Build an array of entries with distance
    const entries = Array.from(foundBlocks.entries());
    // Filter out blocks not exposed to air (buried in stone etc.)
    const exposed = entries.filter(([key, info]) => {
        const exposed = isExposedToAir(info.x, info.y, info.z);
        if (!exposed) {
            logger.trace(`Culling buried block at (${info.x}, ${info.y}, ${info.z})`);
        }
        return exposed;
    });
    if (exposed.length === 0)
        return;
    // Sort by distance (straight-line or heuristic if Baritone is available)
    const withDist = exposed.map(([key, info]) => {
        const dx = info.x + 0.5 - px;
        const dy = info.y + 0.5 - player.getY();
        const dz = info.z + 0.5 - pz;
        let estimatedCost = Math.sqrt(dx * dx + dy * dy + dz * dz); // fallback: straight-line
        // Use Baritone heuristic if available (instant A* estimate in ticks)
        if (baritoneAvailable) {
            try {
                const GoalBlockClass = Reflection.getClass("baritone.api.pathing.goals.GoalBlock");
                const blockPos = PositionCommon
                    .createBlockPos(info.x, info.y, info.z)
                    .getRaw();
                const goal = Reflection.newInstance(GoalBlockClass, blockPos);
                estimatedCost = goal.heuristic(Math.floor(player.getX()), Math.floor(player.getY()), Math.floor(player.getZ()));
            }
            catch (e) {
                // Heuristic failed — keep straight-line fallback
            }
        }
        return { key, info, distSq: estimatedCost * estimatedCost };
    });
    withDist.sort((a, b) => a.distSq - b.distSq);
    // Only render the N closest
    const toRender = withDist.slice(0, CONFIG.MAX_HIGHLIGHTS);
    for (const { info } of toRender) {
        // Color-code by accessibility:
        //   green  = directly visible (raytrace clear)
        //   yellow = air-exposed, close (< 32m straight-line)
        //   orange = air-exposed, far
        const visible = isBlockVisible(info.x, info.y, info.z, player.getEyePos());
        const dx = info.x + 0.5 - px;
        const dy = info.y + 0.5 - player.getY();
        const dz = info.z + 0.5 - pz;
        const distM = Math.sqrt(dx * dx + dy * dy + dz * dz);
        let boxColor;
        if (visible) {
            boxColor = 0x00ff00; // green — can see it
        }
        else if (distM < 32) {
            boxColor = 0xffdd00; // yellow — close by, need to mine a bit
        }
        else {
            boxColor = 0xff6600; // orange — far, behind multiple walls
        }
        // ─── Glow effect: translucent box with bright outline ───
        draw3d.addBox(info.x, info.y, info.z, info.x + 1, info.y + 1, info.z + 1, boxColor, CONFIG.GLOW_ALPHA, boxColor, CONFIG.GLOW_FILL_ALPHA, true, // fill
        false);
        // ─── Beam pointing at the block (trace line) ───
        draw3d.addTraceLine(info.x + 0.5, info.y + 1.5, info.z + 0.5, boxColor, CONFIG.BEAM_ALPHA);
    }
    // If we cut some off, log once via status with count
    if (withDist.length > CONFIG.MAX_HIGHLIGHTS) {
        logger.debug(`Showing ${CONFIG.MAX_HIGHLIGHTS}/${withDist.length} closest blocks`);
    }
}
// ─── Command: /blockscan ────────────────────────────────────────────────────
const cmd = Chat.getCommandManager()
    .createCommandBuilder("blockscan")
    // /blockscan status — show current target
    .literalArg("status")
    .executes(JavaWrapper.methodToJava(() => {
    if (!targetId) {
        logger.status("§cNo target block set. Use §b/blockscan set§c to capture the block you're looking at.");
        return;
    }
    const propStr = targetProperties && Object.keys(targetProperties).length > 0
        ? ` with properties ${JSON.stringify(targetProperties)}`
        : "";
    logger.info(`§a[GemFinder]§r Scanning for §b${targetDisplayName || targetId}§r${propStr}`);
    logger.info(`§a[GemFinder]§r Found §b${foundBlocks.size}§r matching blocks so far.`);
}))
    // /blockscan set — capture the block the player is looking at
    // /blockscan set <prop=value> — narrow down to specific property values
    .or()
    .literalArg("set")
    .executes(JavaWrapper.methodToJava(() => {
    const player = Player.getPlayer();
    if (!player) {
        logger.error("Player not available.");
        return;
    }
    const hitResult = Player.detailedRayTraceBlock(6.0, false);
    if (!hitResult || hitResult.isMissed()) {
        logger.status("§cNot looking at a block. Look at the block you want to scan for.");
        return;
    }
    const blockPos = hitResult.getBlockPos();
    if (!blockPos) {
        logger.status("§cCould not determine block position.");
        return;
    }
    const block = World.getBlock(blockPos);
    if (!block) {
        logger.status("§cCould not read block data.");
        return;
    }
    const id = block.getId();
    const props = javaMapToObject(block.getBlockState());
    const name = block.getName()?.toString() || id;
    targetId = id;
    targetProperties = props;
    targetDisplayName = String(name);
    // Clear old data and prepare fresh
    foundBlocks.clear();
    scannedChunks.clear();
    logger.info(`§a[GemFinder]§r Now scanning for §b${name}§r (§7${id}§r)`);
    if (Object.keys(props).length > 0) {
        logger.info(`§a[GemFinder]§r With properties: §b${JSON.stringify(props)}§r`);
    }
    // Persist and scan
    saveTarget();
    scanAllLoadedChunks();
    updateVisuals();
}))
    .wordArg("prop")
    .executes(JavaWrapper.methodToJava((ctx) => {
    const propArg = ctx.getArg("prop");
    if (!targetId) {
        logger.status("§cNo target block set. Use §b/blockscan set§c first.");
        return;
    }
    const eqIndex = propArg.indexOf("=");
    if (eqIndex === -1) {
        logger.status(`§cInvalid format. Use: §b/blockscan set ${propArg}=<value>§c`);
        return;
    }
    const propKey = propArg.substring(0, eqIndex);
    const propValue = propArg.substring(eqIndex + 1);
    if (!targetProperties)
        targetProperties = {};
    targetProperties[propKey] = propValue;
    logger.info(`§a[GemFinder]§r Added property filter: §b${propKey}=${propValue}§r`);
    // Re-scan with new filter
    foundBlocks.clear();
    scannedChunks.clear();
    scanAllLoadedChunks();
    updateVisuals();
    saveTarget();
}))
    // /blockscan clear — clear target and highlights
    .or()
    .or()
    .literalArg("clear")
    .executes(JavaWrapper.methodToJava(() => {
    targetId = null;
    targetProperties = null;
    targetDisplayName = null;
    foundBlocks.clear();
    scannedChunks.clear();
    draw3d.clear();
    deleteSavedTarget();
    logger.info("§a[GemFinder]§r Target cleared. No longer highlighting blocks.");
}))
    // /blockscan list — list all found block positions with distance
    .or()
    .literalArg("list")
    .executes(JavaWrapper.methodToJava(() => {
    if (foundBlocks.size === 0) {
        logger.status("§eNo matching blocks found yet.");
        return;
    }
    const player = Player.getPlayer();
    if (!player)
        return;
    logger.info(`§a[GemFinder]§r Found §b${foundBlocks.size}§r blocks:`);
    let index = 0;
    for (const info of foundBlocks.values()) {
        const dx = info.x + 0.5 - player.getX();
        const dy = info.y + 0.5 - player.getY();
        const dz = info.z + 0.5 - player.getZ();
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        index++;
        logger.info(` §b#${index}§r §7${info.id}§r at §f(${info.x}, ${info.y}, ${info.z})§r §8[${dist.toFixed(1)}m]§r`);
    }
}))
    // /blockscan rescan — re-scan all loaded chunks
    .or()
    .literalArg("rescan")
    .executes(JavaWrapper.methodToJava(() => {
    if (!targetId) {
        logger.status("§cNo target set. Use §b/blockscan set§c first.");
        return;
    }
    foundBlocks.clear();
    scannedChunks.clear();
    scanAllLoadedChunks();
    updateVisuals();
    logger.info(`§a[GemFinder]§r Rescan complete: ${foundBlocks.size} blocks found.`);
}))
    // /blockscan probe <radius> — debug command to check what blocks are nearby
    .or()
    .literalArg("probe")
    .intArg("radius")
    .executes(JavaWrapper.methodToJava((ctx) => {
    const radius = ctx.getArg("radius");
    if (radius < 1 || radius > 50) {
        logger.status("§cRadius must be between 1 and 50.");
        return;
    }
    const player = Player.getPlayer();
    if (!player)
        return;
    const centerPos = player.getBlockPos();
    const blockCounts = new Map();
    let totalBlocks = 0;
    World.iterateSphere(centerPos, radius, false, JavaWrapper.methodToJava((block) => {
        const id = block.getId();
        blockCounts.set(id, (blockCounts.get(id) || 0) + 1);
        totalBlocks++;
        return true;
    }));
    logger.info(`§a[GemFinder Probe]§r Scanned §b${totalBlocks}§r blocks within ${radius}m:`);
    // Sort by count descending
    const sorted = Array.from(blockCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20);
    for (const [id, count] of sorted) {
        const marker = targetId && id === targetId ? " §e← TARGET" : "";
        logger.info(`  §7${id}§r: §b${count}§r${marker}`);
    }
    if (targetId && !blockCounts.has(targetId)) {
        logger.info(`  §cTarget block "${targetId}" was NOT found in this scan.`);
    }
}));
// ─── Event Handlers ─────────────────────────────────────────────────────────
/**
 * Tick handler: periodic visual refresh and periodic re-scan of new chunks.
 */
const onTick = JavaWrapper.methodToJava(() => {
    if (!World.isWorldLoaded() || !targetId)
        return;
    maintenanceTick++;
    if (maintenanceTick % CONFIG.TICK_INTERVAL !== 0)
        return;
    updateVisuals();
    const player = Player.getPlayer();
    if (!player)
        return;
    const playerPos = player.getPos();
    // Reactive sphere scan: re-scan whenever the player moves significantly
    if (lastScanPos === null ||
        Math.abs(playerPos.x - lastScanPos.x) > CONFIG.MOVE_RESCAN_THRESHOLD ||
        Math.abs(playerPos.y - lastScanPos.y) > CONFIG.MOVE_RESCAN_THRESHOLD ||
        Math.abs(playerPos.z - lastScanPos.z) > CONFIG.MOVE_RESCAN_THRESHOLD) {
        lastScanPos = { x: playerPos.x, y: playerPos.y, z: playerPos.z };
        scanSphereAroundPlayer(20);
    }
    // Periodic full chunk scan (every ~10s fallback for newly loaded chunks)
    if (maintenanceTick % CONFIG.RESCAN_INTERVAL_TICKS === 0) {
        const pcx = Math.floor(playerPos.x) >> 4;
        const pcz = Math.floor(playerPos.z) >> 4;
        for (let dx = -CONFIG.INITIAL_CHUNK_RADIUS; dx <= CONFIG.INITIAL_CHUNK_RADIUS; dx++) {
            for (let dz = -CONFIG.INITIAL_CHUNK_RADIUS; dz <= CONFIG.INITIAL_CHUNK_RADIUS; dz++) {
                const cx = pcx + dx;
                const cz = pcz + dz;
                if (!scannedChunks.has(chunkKey(cx, cz)) &&
                    World.isChunkLoaded(cx, cz)) {
                    scanSingleChunk(cx, cz);
                }
            }
        }
    }
});
/**
 * ChunkLoad handler: scan newly loaded chunks for our target.
 */
const onChunkLoad = JavaWrapper.methodToJava((event) => {
    if (!targetId || !World.isWorldLoaded())
        return;
    const cx = event.x;
    const cz = event.z;
    if (!event.isFull)
        return;
    scanSingleChunk(cx, cz);
    if (foundBlocks.size > 0) {
        updateVisuals();
    }
});
// ─── Lifecycle ──────────────────────────────────────────────────────────────
// Register 3D renderer
draw3d.register();
// Register command
cmd.register();
// Register event listeners
const tickListener = JsMacros.on("Tick", onTick);
const chunkLoadListener = JsMacros.on("ChunkLoad", onChunkLoad);
// Restore previous target from disk, if any
const restored = loadTarget();
if (restored) {
    // Scan all loaded chunks to re-populate highlights
    scanAllLoadedChunks();
    updateVisuals();
}
logger.info("§a[GemFinder]§r Service started. Look at a block and use §b/blockscan set§r to begin scanning.");
// ─── Shutdown ───────────────────────────────────────────────────────────────
event.stopListener = JavaWrapper.methodToJava(() => {
    saveTarget();
    draw3d.unregister();
    cmd.unregister();
    JsMacros.off(tickListener);
    JsMacros.off(chunkLoadListener);
    foundBlocks.clear();
    scannedChunks.clear();
    logger.info("§a[GemFinder]§r Service stopped.");
});

"use strict";
/// <reference path="../../headers/JsMacrosCE-2.0.0-dev-fcda711.d.ts" />
/// <reference path="../../headers/Minecraft.d.ts" />
Object.defineProperty(exports, "__esModule", { value: true });
const debug_1 = require("../utils/debug");
const logger = new debug_1.Logger("HideFoliage", debug_1.LogLevel.INFO);
const draw3d = Hud.createDraw3D();
// Configuration
const SCAN_RADIUS = 12;
const SCAN_INTERVAL_TICKS = 20; // Scan every second
const FOLIAGE_BLOCKS = new Set([
    "minecraft:short_grass",
    "minecraft:tall_grass",
    "minecraft:fern",
    "minecraft:large_fern",
    "minecraft:oak_leaves",
    // "minecraft:spruce_leaves",
    // "minecraft:birch_leaves",
    // "minecraft:jungle_leaves",
    // "minecraft:acacia_leaves",
    // "minecraft:dark_oak_leaves",
    // "minecraft:mangrove_leaves",
    // "minecraft:cherry_leaves",
    // "minecraft:azalea_leaves",
    // "minecraft:flowering_azalea_leaves",
    "minecraft:dandelion",
    "minecraft:poppy",
    "minecraft:blue_orchid",
    "minecraft:allium",
    "minecraft:azure_bluet",
    "minecraft:red_tulip",
    "minecraft:orange_tulip",
    "minecraft:white_tulip",
    "minecraft:pink_tulip",
    "minecraft:oxeye_daisy",
    "minecraft:cornflower",
    "minecraft:lily_of_the_valley",
    "minecraft:sunflower",
    "minecraft:lilac",
    "minecraft:rose_bush",
    "minecraft:peony",
    "minecraft:sugar_cane",
    "minecraft:bamboo",
    "minecraft:vines",
    "minecraft:glow_berries",
    "minecraft:cave_vines",
    "minecraft:cave_vines_plant",
    "minecraft:sweet_berry_bush",
    "minecraft:moss_carpet",
    "minecraft:hanging_roots",
    "minecraft:spore_blossom",
    "minecraft:azalea",
    "minecraft:flowering_azalea",
    "minecraft:pink_petals",
]);
// State
let enabled = true;
let tickCounter = 0;
// Map<"x,y,z", { pos: any, x: number, y: number, z: number, state: any, lastSeen: number }>
const hiddenBlocks = new Map();
// Reflection Cache
let setBlockMethod = null;
let rawAirState = null;
let rawVoidState = null;
function initReflection() {
    logger.debug("Initializing reflection (Robust mode)...");
    try {
        const clientWorld = World.getRaw();
        if (!clientWorld) {
            logger.warn("World not loaded, cannot init reflection yet.");
            return;
        }
        const worldClass = clientWorld.getClass();
        logger.trace(`World class: ${worldClass.getName()}`);
        // Resolve target parameter classes
        const BlockPosClass = Reflection.getClass("net.minecraft.class_2338", "net.minecraft.core.BlockPos");
        const BlockStateClass = Reflection.getClass("net.minecraft.class_2680", "net.minecraft.world.level.block.state.BlockState");
        if (!BlockPosClass || !BlockStateClass) {
            logger.error("Failed to resolve BlockPos or BlockState classes.");
            return;
        }
        // Dynamic search for setBlock(BlockPos, BlockState, int)
        const methods = worldClass.getMethods();
        let found = false;
        for (let i = 0; i < methods.length; i++) {
            const m = methods[i];
            if (m.getParameterCount() === 3) {
                const params = m.getParameterTypes();
                if (BlockPosClass.isAssignableFrom(params[0]) &&
                    BlockStateClass.isAssignableFrom(params[1]) &&
                    (params[2].getName() === "int" ||
                        params[2].getName() === "java.lang.Integer")) {
                    setBlockMethod = m;
                    logger.info(`Resolved setBlock method via type matching: ${m.getName()}`);
                    found = true;
                    break;
                }
            }
        }
        // Fallback to known mapping name if dynamic search fails
        if (!found) {
            logger.warn("Dynamic search failed. Trying fallback name 'method_8496'...");
            try {
                setBlockMethod = worldClass.getMethod("method_8496", BlockPosClass, BlockStateClass, Java.type("int").class);
                if (setBlockMethod) {
                    logger.info("Resolved setBlock method via fallback name.");
                    found = true;
                }
            }
            catch (e) {
                logger.error("Fallback resolution failed.");
            }
        }
        if (!setBlockMethod)
            logger.error("CRITICAL: Could not resolve setBlock method.");
        const registry = Client.getRegistryManager();
        if (registry) {
            const airHelper = registry.getBlockState("minecraft:air");
            if (airHelper) {
                rawAirState = airHelper.getRaw();
                logger.debug("Resolved raw AIR state.");
            }
            const voidHelper = registry.getBlockState("minecraft:structure_void");
            if (voidHelper) {
                rawVoidState = voidHelper.getRaw();
                logger.debug("Resolved raw STRUCTURE_VOID state.");
            }
        }
    }
    catch (e) {
        logger.error("Reflection init failed: " + e);
    }
}
function scanAndHide() {
    const player = Player.getPlayer();
    if (!player)
        return;
    const playerPos = player.getBlockPos();
    const px = playerPos.getX();
    const py = playerPos.getY();
    const pz = playerPos.getZ();
    const now = Date.now();
    const radiusSq = SCAN_RADIUS * SCAN_RADIUS;
    // Step 1: Update 'lastSeen' for blocks still in range (Manual distance check)
    for (const entry of hiddenBlocks.values()) {
        const dx = entry.x - px;
        const dy = entry.y - py;
        const dz = entry.z - pz;
        if (dx * dx + dy * dy + dz * dz <= radiusSq) {
            entry.lastSeen = now;
        }
    }
    const toHide = [];
    // Step 2: Only scan for NEW visible foliage
    World.iterateSphere(playerPos, SCAN_RADIUS, false, // No longer need to include AIR
    JavaWrapper.methodToJava((block) => {
        const bpos = block.getBlockPos();
        const x = bpos.getX();
        const y = bpos.getY();
        const z = bpos.getZ();
        const key = `${x},${y},${z}`;
        if (hiddenBlocks.has(key))
            return true;
        if (FOLIAGE_BLOCKS.has(block.getId())) {
            const BlockPosClass = Reflection.getClass("net.minecraft.class_2338", "net.minecraft.core.BlockPos");
            const freshPos = Reflection.newInstance(BlockPosClass, x, y, z);
            hiddenBlocks.set(key, {
                pos: freshPos,
                x: x,
                y: y,
                z: z,
                state: block.getRawBlockState(),
                lastSeen: now,
            });
            toHide.push({ x, y, z });
        }
        return true;
    }));
    // Batch Hide
    if (toHide.length > 0) {
        logger.debug(`Batching ${toHide.length} blocks for hiding.`);
        const targetState = rawAirState || rawVoidState;
        if (setBlockMethod && targetState) {
            try {
                const mc = Client.getMinecraft();
                mc.execute(JavaWrapper.methodToJava(() => {
                    const rawWorld = World.getRaw();
                    if (!rawWorld)
                        return;
                    let count = 0;
                    for (const p of toHide) {
                        try {
                            const entryKey = `${p.x},${p.y},${p.z}`;
                            const entry = hiddenBlocks.get(entryKey);
                            if (!entry)
                                continue;
                            setBlockMethod.invoke(rawWorld, entry.pos, targetState, 19);
                            count++;
                        }
                        catch (e) { }
                    }
                    logger.trace(`Batch hidden: ${count}/${toHide.length}`);
                }));
            }
            catch (e) {
                logger.error("Failed to schedule batch hide: " + e);
            }
        }
    }
    // Restore Out-of-Range Blocks
    const toRestore = [];
    for (const [key, entry] of hiddenBlocks.entries()) {
        if (entry.lastSeen < now) {
            toRestore.push({ pos: entry.pos, state: entry.state });
            hiddenBlocks.delete(key);
        }
    }
    if (toRestore.length > 0 && setBlockMethod) {
        logger.debug(`Restoring ${toRestore.length} out-of-range blocks.`);
        const mc = Client.getMinecraft();
        mc.execute(JavaWrapper.methodToJava(() => {
            const rawWorld = World.getRaw();
            if (!rawWorld)
                return;
            for (const item of toRestore) {
                try {
                    setBlockMethod.invoke(rawWorld, item.pos, item.state, 19);
                }
                catch (e) { }
            }
        }));
    }
}
const onTick = JavaWrapper.methodToJava(() => {
    if (!enabled || !World.isWorldLoaded()) {
        draw3d.clear();
        return;
    }
    // Update boxes every tick if in debug mode
    draw3d.clear();
    if (logger.getLogLevel() <= debug_1.LogLevel.DEBUG) {
        for (const entry of hiddenBlocks.values()) {
            const { x, y, z } = entry;
            draw3d.addBox(x, y, z, x + 1, y + 1, z + 1, 0x00ff00, 200, // Green outline
            0x00ff00, 40, // Green fill
            true, // fill
            false);
        }
    }
    tickCounter++;
    if (tickCounter >= SCAN_INTERVAL_TICKS) {
        logger.trace("Triggering scheduled scan.");
        tickCounter = 0;
        if (!setBlockMethod || !rawAirState)
            initReflection();
        scanAndHide();
    }
});
// Command
const command = Chat.getCommandManager()
    .createCommandBuilder("hidefoliage")
    .executes(JavaWrapper.methodToJava(() => {
    enabled = !enabled;
    if (!enabled) {
        // Restore all when disabled
        const toRestore = Array.from(hiddenBlocks.values());
        hiddenBlocks.clear();
        if (toRestore.length > 0 && setBlockMethod) {
            Client.getMinecraft().execute(JavaWrapper.methodToJava(() => {
                const rawWorld = World.getRaw();
                if (!rawWorld)
                    return;
                for (const item of toRestore) {
                    try {
                        setBlockMethod.invoke(rawWorld, item.pos, item.state, 19);
                    }
                    catch (e) { }
                }
            }));
        }
    }
    logger.info(`Foliage hiding toggled to: ${enabled}`);
    logger.status(`Foliage hiding ${enabled ? "§aenabled" : "§cdisabled"}`);
}))
    .literalArg("debug")
    .executes(JavaWrapper.methodToJava(() => {
    const current = logger.getLogLevel();
    const next = current === debug_1.LogLevel.DEBUG ? debug_1.LogLevel.INFO : debug_1.LogLevel.DEBUG;
    logger.setLogLevel(next);
    logger.status(`Foliage hiding debug mode: ${next === debug_1.LogLevel.DEBUG ? "§aON" : "§cOFF"}`);
}));
command.register();
// Service Setup
JsMacros.assertEvent(event, "Service");
draw3d.register();
const tickListener = JsMacros.on("Tick", onTick);
logger.info("HideFoliage Service Started (Trace mode enabled)");
logger.debug(`Config: radius=${SCAN_RADIUS}, interval=${SCAN_INTERVAL_TICKS} ticks`);
event.stopListener = JavaWrapper.methodToJava(() => {
    draw3d.unregister();
    JsMacros.off(tickListener);
    Chat.getCommandManager().unregisterCommand("hidefoliage");
    logger.info("HideFoliage Service Stopped");
});

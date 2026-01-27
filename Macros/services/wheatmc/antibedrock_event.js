"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const debug_1 = require("../../utils/debug");
const logger = new debug_1.Logger("AntiBedrockEvent", debug_1.LogLevel.ERROR);
const draw3d = Hud.createDraw3D();
// Configuration
const BEDROCK_ID = "minecraft:bedrock";
const GHOST_DURATION_MS = 6000;
// State
const ghostBlocks = new Map();
// Reflection Cache
let setBlockMethod = null;
let rawAirState = null;
function initReflection() {
    try {
        const clientWorld = World.getRaw();
        if (!clientWorld) {
            logger.debug("World not loaded yet, skipping reflection init.");
            return;
        }
        const worldClass = clientWorld.getClass();
        logger.debug(`Initializing reflection for world class: ${worldClass.getName()}`);
        // Resolve target parameter classes
        const BlockPosClass = Reflection.getClass("net.minecraft.class_2338", "net.minecraft.core.BlockPos");
        const BlockStateClass = Reflection.getClass("net.minecraft.class_2680", "net.minecraft.world.level.block.state.BlockState");
        if (!BlockPosClass || !BlockStateClass) {
            logger.error("Failed to resolve BlockPos or BlockState classes.");
            return;
        }
        // Search for setBlock(BlockPos, BlockState, int)
        const methods = worldClass.getMethods();
        let found = false;
        for (let i = 0; i < methods.length; i++) {
            const m = methods[i];
            if (m.getParameterCount() === 3) {
                const params = m.getParameterTypes();
                // Check if params are exactly or subclasses of our resolved types
                if (BlockPosClass.isAssignableFrom(params[0]) &&
                    BlockStateClass.isAssignableFrom(params[1]) &&
                    (params[2].getName() === "int" ||
                        params[2].getName() === "java.lang.Integer")) {
                    setBlockMethod = m;
                    logger.info(`Found setBlock method: ${m.getName()} (Matched by types)`);
                    found = true;
                    break;
                }
            }
        }
        if (!found) {
            logger.warn("Could not find setBlock method via dynamic type matching. Trying fallback name method_8496.");
            try {
                setBlockMethod = worldClass.getMethod("method_8496", BlockPosClass, BlockStateClass, Java.type("int").class);
                if (setBlockMethod)
                    logger.info("Found setBlock method via fallback name method_8496.");
            }
            catch (e) { }
        }
        // Get AIR state via RegistryManager
        const registry = Client.getRegistryManager();
        if (registry) {
            const airHelper = registry.getBlockState("minecraft:air");
            if (airHelper) {
                rawAirState = airHelper.getRaw();
                logger.info("Resolved raw AIR state.");
            }
            else {
                logger.warn("Could not resolve minecraft:air via Registry.");
            }
        }
    }
    catch (e) {
        logger.error("Reflection init failed: " + e);
    }
}
const onBlockUpdate = JavaWrapper.methodToJava((event) => {
    const block = event.block;
    if (block.getId() === BEDROCK_ID) {
        const pos = block.getBlockPos();
        const x = pos.getX();
        const y = pos.getY();
        const z = pos.getZ();
        logger.info(`Detected Bedrock placement at (${x}, ${y}, ${z}) via BlockUpdate`);
        // 1. Add Ghost Block visual
        addGhostBlock(x, y, z);
        // 2. Client-side Revert (Set to Air)
        if (!setBlockMethod || !rawAirState) {
            initReflection();
        }
        if (setBlockMethod && rawAirState) {
            try {
                const client = Client.getMinecraft();
                client.execute(JavaWrapper.methodToJava(() => {
                    try {
                        const rawWorld = World.getRaw();
                        if (rawWorld) {
                            const rawPos = pos.getRaw();
                            // Flag 3 = 1 (UPDATE_NEIGHBORS) | 2 (NOTIFY_CLIENTS)
                            // Flag 11 = 1 | 2 | 8 (FORCE_STATE)
                            // Flag 19 = 1 | 2 | 16 (IMMEDIATE_RENDER)
                            logger.debug(`Invoking setBlock at ${x}, ${y}, ${z}`);
                            setBlockMethod.invoke(rawWorld, rawPos, rawAirState, 19);
                        }
                    }
                    catch (innerErr) {
                        logger.error("Error inside main thread execution: " + innerErr);
                    }
                }));
            }
            catch (e) {
                logger.error("Failed to schedule block revert: " + e);
            }
        }
        else {
            logger.error(`Cannot revert: setBlockMethod=${!!setBlockMethod}, rawAirState=${!!rawAirState}`);
        }
    }
});
function addGhostBlock(x, y, z) {
    const key = `${x},${y},${z}`;
    ghostBlocks.set(key, {
        pos: { x, y, z },
        expires: Date.now() + GHOST_DURATION_MS,
    });
}
const onTick = JavaWrapper.methodToJava(() => {
    const now = Date.now();
    for (const [key, data] of ghostBlocks.entries()) {
        if (now > data.expires) {
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
// Init
draw3d.register();
initReflection();
const updateListener = JsMacros.on("BlockUpdate", onBlockUpdate);
const tickListener = JsMacros.on("Tick", onTick);
logger.info("AntiBedrock Event Service Started");
event.stopListener = JavaWrapper.methodToJava(() => {
    draw3d.unregister();
    JsMacros.off(updateListener);
    JsMacros.off(tickListener);
    logger.info("AntiBedrock Event Service Stopped");
});

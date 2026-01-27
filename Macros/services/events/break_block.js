"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const debug_1 = require("../../utils/debug");
const events_1 = require("../../utils/events");
const logger = new debug_1.Logger("BreakBlockEvent", debug_1.LogLevel.INFO);
// Proactively register the event
events_1.EventUtils.registerCustom(events_1.EVENT_MINE_BLOCK);
let lastTargetPos = null;
let lastTargetId = null;
const onTick = JavaWrapper.methodToJava(() => {
    const player = Player.getPlayer();
    if (!player)
        return;
    // 1. Detection (Did the previous block break?)
    if (lastTargetPos) {
        const currentBlock = World.getBlock(lastTargetPos.x, lastTargetPos.y, lastTargetPos.z);
        if (currentBlock && currentBlock.getId() === "minecraft:air") {
            // It broke!
            logger.debug(`Block break detected at [${lastTargetPos.x}, ${lastTargetPos.y}, ${lastTargetPos.z}]`);
            events_1.EventUtils.triggerCustom(events_1.EVENT_MINE_BLOCK, {
                pos: lastTargetPos,
                id: lastTargetId
            });
            // Clear last target to prevent double counting
            lastTargetPos = null;
            lastTargetId = null;
        }
    }
    // 2. Update State (What are we looking at now?)
    const reach = Player.getReach() || 5;
    const ray = player.rayTraceBlock(reach, false);
    if (ray) {
        const block = ray.getBlock();
        const pos = ray.getBlockPos();
        if (pos) {
            const newPos = {
                x: pos.getX(),
                y: pos.getY(),
                z: pos.getZ()
            };
            const newId = block.getId();
            if (newId !== "minecraft:air") {
                lastTargetPos = newPos;
                lastTargetId = newId;
            }
            else {
                lastTargetPos = null;
                lastTargetId = null;
            }
        }
        else {
            lastTargetPos = null;
            lastTargetId = null;
        }
    }
    else {
        lastTargetPos = null;
        lastTargetId = null;
    }
});
const listeners = [
    JsMacros.on("Tick", onTick)
];
event.stopListener = JavaWrapper.methodToJava(() => {
    logger.info("Stopping BreakBlockEvent Service...");
    listeners.forEach(l => JsMacros.off(l));
});
logger.info("BreakBlockEvent Service started.");

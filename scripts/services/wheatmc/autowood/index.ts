// services start with minecraft, when enabled and are meant to be persistent scripts.
JsMacros.assertEvent(event, "Service");

// Auto-miner configuration
const CONFIG = {
    TARGET_BLOCKS: [
        "minecraft:oak_log", 
        "minecraft:birch_log", 
        "minecraft:spruce_log", 
        "minecraft:jungle_log", 
        "minecraft:acacia_log", 
        "minecraft:dark_oak_log", 
        "minecraft:mangrove_log", 
        "minecraft:cherry_log",
        "minecraft:oak_wood",
        "minecraft:birch_wood",
        "minecraft:spruce_wood",
        "minecraft:jungle_wood",
        "minecraft:acacia_wood",
        "minecraft:dark_oak_wood",
        "minecraft:mangrove_wood",
        "minecraft:cherry_wood"
    ],
    RANGE: 4.5
};

/**
 * Main loop logic.
 */
const onTick = JavaWrapper.methodToJava(() => {
    const mc = Client.getMinecraft();
    if (mc.player == null) return;

    try {
        const player = Player.getPlayer();
        const interactionManager = Player.getInteractionManager();
        const eyePos = player.getEyePos();

        // 1. Scan for targets
        const targets = [];
        const centerPos = player.getBlockPos(); 
        
        const intRange = Math.ceil(CONFIG.RANGE);

        World.iterateSphere(centerPos, intRange, true, JavaWrapper.methodToJava((block) => {
            if (CONFIG.TARGET_BLOCKS.indexOf(block.getId()) !== -1) {
                targets.push(block);
            }
        }));

        if (targets.length === 0) {
            KeyBind.keyBind("key.attack", false);
            return;
        }

        // 2. Select closest target
        targets.sort((a, b) => {
            const distA = getDistanceSq(eyePos, a.getPos().toCenterPos());
            const distB = getDistanceSq(eyePos, b.getPos().toCenterPos());
            return distA - distB;
        });

        const targetBlock = targets[0];
        const targetPos = targetBlock.getPos(); // BlockPosHelper
        const targetCenter = targetPos.toCenterPos();

        // 3. Aim
        const rotations = getRotations(eyePos, targetCenter);
        player.lookAt(rotations.yaw, rotations.pitch);

        // 4. Attack if looking at it
        const lookedAtPos = interactionManager.getTargetedBlock(); // Returns BlockPosHelper
        if (lookedAtPos && 
            lookedAtPos.getX() === targetPos.getX() && 
            lookedAtPos.getY() === targetPos.getY() && 
            lookedAtPos.getZ() === targetPos.getZ()) {
            
            if (!mc.options.keyAttack.isPressed()) {
                KeyBind.keyBind("key.attack", true);
            }
        } else {
            KeyBind.keyBind("key.attack", false);
        }

    } catch (e) {
        Chat.log(Chat.createTextHelperFromString("§cAutoWood Error: " + e));
        if (e.printStackTrace) e.printStackTrace();
    }
});

/**
 * Calculates yaw and pitch to face a target.
 */
function getRotations(eyePos, targetPos) {
    const dX = targetPos.x - eyePos.x;
    const dY = targetPos.y - eyePos.y;
    const dZ = targetPos.z - eyePos.z;
    const dist = Math.sqrt(dX * dX + dZ * dZ);
    const yaw = (Math.atan2(dZ, dX) * 180.0 / Math.PI) - 90.0;
    const pitch = -(Math.atan2(dY, dist) * 180.0 / Math.PI);
    return { yaw, pitch };
}

/**
 * Squared distance helper.
 */
function getDistanceSq(pos1, pos2) {
    const dX = pos1.x - pos2.x;
    const dY = pos1.y - pos2.y;
    const dZ = pos1.z - pos2.z;
    return dX * dX + dY * dY + dZ * dZ;
}

// --- Startup ---
const tickListener = JsMacros.on("Tick", onTick);
Chat.log(Chat.createTextHelperFromString("§aAutoWood Service Started"));

// --- Shutdown ---
event.stopListener = JavaWrapper.methodToJava(() => {
    JsMacros.off(tickListener);
    KeyBind.keyBind("key.attack", false);
    Chat.log(Chat.createTextHelperFromString("§cAutoWood Service Stopped"));
});

import { Logger, LogLevel } from "../../utils/debug";

const logger = new Logger("AntiBedrockEvent", LogLevel.ERROR);
const draw3d: Draw3D = Hud.createDraw3D();

// Configuration
const BEDROCK_ID = "minecraft:bedrock";
const GHOST_DURATION_MS = 9000;
const SCALE_FACTOR = 5; // Base distance for scaling
const SCALE_EXPONENT = 2; // Higher values make it shrink faster at first
const SCALE_MIN = 0.1; // Minimum scale of the box
const ALPHA_FILL = 150;
const ALPHA_OUTLINE = 60;
const COLLISION_BUFFER = 0.1; // Extra buffer to ensure block becomes solid before touching

interface GhostBlock {
  pos: { x: number; y: number; z: number };
  expires: number;
  currentState: "AIR" | "BEDROCK";
}

// State
const ghostBlocks = new Map<string, GhostBlock>();

// Reflection Cache
let setBlockMethod: any = null;
let rawAirState: any = null;
let rawBedrockState: any = null;

function initReflection() {
  try {
    const clientWorld = World.getRaw();
    if (!clientWorld) {
      logger.debug("World not loaded yet, skipping reflection init.");
      return;
    }

    const worldClass = clientWorld.getClass();
    logger.debug(
      `Initializing reflection for world class: ${worldClass.getName()}`,
    );

    // Resolve target parameter classes
    const BlockPosClass = (Reflection as any).getClass(
      "net.minecraft.class_2338",
      "net.minecraft.core.BlockPos",
    );
    const BlockStateClass = (Reflection as any).getClass(
      "net.minecraft.class_2680",
      "net.minecraft.world.level.block.state.BlockState",
    );

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
        if (
          BlockPosClass.isAssignableFrom(params[0]) &&
          BlockStateClass.isAssignableFrom(params[1]) &&
          (params[2].getName() === "int" ||
            params[2].getName() === "java.lang.Integer")
        ) {
          setBlockMethod = m;
          logger.info(
            `Found setBlock method: ${m.getName()} (Matched by types)`,
          );
          found = true;
          break;
        }
      }
    }

    if (!found) {
      logger.warn(
        "Could not find setBlock method via dynamic type matching. Trying fallback name method_8496.",
      );
      try {
        setBlockMethod = worldClass.getMethod(
          "method_8496",
          BlockPosClass,
          BlockStateClass,
          Java.type("int").class,
        );
        if (setBlockMethod)
          logger.info("Found setBlock method via fallback name method_8496.");
      } catch (e) {}
    }

    // Get AIR & BEDROCK states via RegistryManager
    const registry = Client.getRegistryManager();
    if (registry) {
      const airHelper = registry.getBlockState("minecraft:air");
      if (airHelper) {
        rawAirState = airHelper.getRaw();
        logger.info("Resolved raw AIR state.");
      } else {
        logger.warn("Could not resolve minecraft:air via Registry.");
      }

      const bedrockHelper = registry.getBlockState("minecraft:bedrock");
      if (bedrockHelper) {
        rawBedrockState = bedrockHelper.getRaw();
        logger.info("Resolved raw BEDROCK state.");
      } else {
        logger.warn("Could not resolve minecraft:bedrock via Registry.");
      }
    }
  } catch (e) {
    logger.error("Reflection init failed: " + e);
  }
}

const onBlockUpdate = JavaWrapper.methodToJava((event: Events.BlockUpdate) => {
  const block = event.block;
  if (block.getId() === BEDROCK_ID) {
    const pos = block.getBlockPos();
    const x = pos.getX();
    const y = pos.getY();
    const z = pos.getZ();

    logger.info(
      `Detected Bedrock placement at (${x}, ${y}, ${z}) via BlockUpdate`,
    );

    // 1. Add Ghost Block visual & state
    addGhostBlock(x, y, z);

    // 2. Client-side Revert (Initial check)
    if (!setBlockMethod || !rawAirState || !rawBedrockState) {
      initReflection();
    }

    if (setBlockMethod && rawAirState && rawBedrockState) {
      try {
        const player = Player.getPlayer();
        if (!player) return;

        // Determine if we should start as Bedrock or Air
        const px = player.getX();
        const py = player.getY();
        const pz = player.getZ();
        const pWidth = 0.6;
        const pHeight = player.isSneaking() ? 1.5 : 1.8;

        const isColliding =
          px - pWidth / 2 - COLLISION_BUFFER < x + 1 &&
          px + pWidth / 2 + COLLISION_BUFFER > x &&
          py - COLLISION_BUFFER < y + 1 &&
          py + pHeight + COLLISION_BUFFER > y &&
          pz - pWidth / 2 - COLLISION_BUFFER < z + 1 &&
          pz + pWidth / 2 + COLLISION_BUFFER > z;

        const initialState = isColliding ? "BEDROCK" : "AIR";
        const rawState = initialState === "AIR" ? rawAirState : rawBedrockState;

        // Update the state tracker in ghostBlocks immediately
        const ghost = ghostBlocks.get(`${x},${y},${z}`);
        if (ghost) ghost.currentState = initialState;

        Client.getMinecraft().execute(
          JavaWrapper.methodToJava(() => {
            try {
              const rawWorld = World.getRaw();
              if (rawWorld) {
                setBlockMethod.invoke(rawWorld, pos.getRaw(), rawState, 19);
              }
            } catch (innerErr) {
              logger.error("Error inside main thread execution: " + innerErr);
            }
          }),
        );
      } catch (e) {
        logger.error("Failed to schedule initial block state: " + e);
      }
    }
  }
});

function addGhostBlock(x: number, y: number, z: number) {
  const key = `${x},${y},${z}`;
  ghostBlocks.set(key, {
    pos: { x, y, z },
    expires: Date.now() + GHOST_DURATION_MS,
    currentState: "AIR",
  });
}

const onTick = JavaWrapper.methodToJava(() => {
  const now = Date.now();

  for (const [key, data] of ghostBlocks.entries()) {
    if (now > data.expires) {
      // Revert to Bedrock before deleting to ensure server state matches client state
      // if (data.currentState === "AIR" && setBlockMethod && rawBedrockState) {
      //   try {
      //     const rawWorld = World.getRaw();
      //     const rawPos = PositionCommon.createBlockPos(data.pos.x, data.pos.y, data.pos.z).getRaw();
      //     Client.getMinecraft().execute(
      //       JavaWrapper.methodToJava(() => {
      //         try {
      //           setBlockMethod.invoke(rawWorld, rawPos, rawBedrockState, 19);
      //         } catch (e) {}
      //       }),
      //     );
      //   } catch (e) {}
      // }
      ghostBlocks.delete(key);
    }
  }

  draw3d.clear();

  const player = Player.getPlayer();
  if (!player) return;

  const px = player.getX();
  const py = player.getY();
  const pz = player.getZ();

  // Player Bounding Box (AABB)
  const pWidth = 0.6;
  const pHeight = player.isSneaking() ? 1.5 : 1.8;
  const pMinX = px - pWidth / 2 - COLLISION_BUFFER;
  const pMaxX = px + pWidth / 2 + COLLISION_BUFFER;
  const pMinY = py - COLLISION_BUFFER;
  const pMaxY = py + pHeight + COLLISION_BUFFER;
  const pMinZ = pz - pWidth / 2 - COLLISION_BUFFER;
  const pMaxZ = pz + pWidth / 2 + COLLISION_BUFFER;

  if (ghostBlocks.size > 0) {
    for (const data of ghostBlocks.values()) {
      const { x, y, z } = data.pos;

      // Block AABB
      const bMinX = x;
      const bMaxX = x + 1;
      const bMinY = y;
      const bMaxY = y + 1;
      const bMinZ = z;
      const bMaxZ = z + 1;

      // Intersection Check
      const isColliding =
        pMinX < bMaxX &&
        pMaxX > bMinX &&
        pMinY < bMaxY &&
        pMaxY > bMinY &&
        pMinZ < bMaxZ &&
        pMaxZ > bMinZ;

      const targetState = isColliding ? "BEDROCK" : "AIR";

      // Update World State if changed
      if (
        targetState !== data.currentState &&
        setBlockMethod &&
        rawAirState &&
        rawBedrockState
      ) {
        try {
          const rawWorld = World.getRaw();
          const rawPos = PositionCommon.createBlockPos(x, y, z).getRaw();
          const rawState =
            targetState === "AIR" ? rawAirState : rawBedrockState;

          Client.getMinecraft().execute(
            JavaWrapper.methodToJava(() => {
              try {
                setBlockMethod.invoke(rawWorld, rawPos, rawState, 19);
              } catch (e) {
                logger.error("Reflection invoke failed: " + e);
              }
            }),
          );
          data.currentState = targetState;
        } catch (e) {
          logger.error("Failed to update block state: " + e);
        }
      }

      // Visuals
      const cx = x + 0.5;
      const cy = y + 0.5;
      const cz = z + 0.5;

      const dx = px - cx;
      const dy = py - cy;
      const dz = pz - cz;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

      const baseScale = SCALE_FACTOR / (dist + SCALE_FACTOR);
      const scale = Math.max(SCALE_MIN, Math.pow(baseScale, SCALE_EXPONENT));
      const half = scale / 2;

      const alphaFill = Math.floor(ALPHA_FILL * scale);
      const alphaOutline = Math.floor(ALPHA_OUTLINE * scale);

      draw3d.addBox(
        cx - half,
        cy - half,
        cz - half,
        cx + half,
        cy + half,
        cz + half,
        0xff0000,
        alphaFill,
        0xff0000,
        alphaOutline,
        true,
        false,
      );
    }
  }
});

// Init
draw3d.register();
initReflection();
const updateListener = JsMacros.on("BlockUpdate", onBlockUpdate);
const tickListener = JsMacros.on("Tick", onTick);
logger.info("AntiBedrock Event Service Started");

(event as Events.Service).stopListener = JavaWrapper.methodToJava(() => {
  draw3d.unregister();
  JsMacros.off(updateListener);
  JsMacros.off(tickListener);
  logger.info("AntiBedrock Event Service Stopped");
});

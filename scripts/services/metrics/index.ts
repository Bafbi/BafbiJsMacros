/**
 * Service: Mining Metrics
 * Tracks block breaking rates and session stats using custom MineBlock events.
 * Commands: /metrics set, /metrics reset
 */
import { Logger, LogLevel } from "../../utils/debug";
import {
  EventUtils,
  EVENT_MINE_BLOCK,
  MineBlockEvent,
} from "../../utils/events";

const logger = new Logger("Metrics", LogLevel.WARN);

const METRICS_CONFIG_FILE = "mining_metrics.json";

interface MetricsConfig {
  target_block: string;
  target_name: string;
}

const metrics_config: MetricsConfig = {
  target_block: "minecraft:stone",
  target_name: "Stone",
};

// Load saved config
if (FS.exists(METRICS_CONFIG_FILE)) {
  try {
    const saved = JSON.parse(FS.open(METRICS_CONFIG_FILE).read());
    Object.assign(metrics_config, saved);
    logger.info(
      `Loaded config: tracking ${metrics_config.target_name} (${metrics_config.target_block})`,
    );
  } catch (e) {
    logger.error("Error loading config: " + e);
    Chat.log("§c[Metrics] Error loading config: " + e);
  }
} else {
  logger.info("No config file found, using defaults.");
}

// Runtime State
let session_total = 0;
let break_history: number[] = []; // Timestamps of breaks within last 60s
let tick_count = 0;

// --- Helpers ---
function saveMetricsConfig() {
  try {
    FS.open(METRICS_CONFIG_FILE).write(JSON.stringify(metrics_config, null, 2));
    logger.debug("Config saved successfully.");
  } catch (e) {
    logger.error("Failed to save config: " + e);
  }
}

function getRate() {
  const now = Date.now();
  break_history = break_history.filter((t) => now - t <= 60000);
  return break_history.length;
}

function getAnalysis() {
  const rate = getRate();
  const projected_hourly = rate * 60;

  let avg_delta = 0;
  if (break_history.length > 1) {
    const first = break_history[0];
    const last = break_history[break_history.length - 1];
    avg_delta = Math.round((last - first) / (break_history.length - 1));
  }

  return {
    rate,
    projected_hourly,
    avg_delta,
  };
}

function getPrettyName(id: string) {
  if (!id) return "None";
  const parts = id.split(":");
  const name = parts.length > 1 ? parts[1] : id;
  return name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// --- HUD ---
const metrics_d2d = Hud.createDraw2D();
const MetricsItemStackHelperType = Java.type(
  "com.jsmacrosce.jsmacros.client.api.helper.inventory.ItemStackHelper",
);

let txtMain: Text | null = null;
let itemPreview: Item | null = null;

metrics_d2d.setOnInit(
  JavaWrapper.methodToJava(() => {
    logger.debug("Initializing Metrics HUD");
    txtMain = metrics_d2d.addText("", 10, 10, 0xffffff, true);
    updateItemPreview();
    updateHudText();
  }),
);

function updateItemPreview() {
  if (itemPreview) metrics_d2d.removeItem(itemPreview);
  try {
    const item = new (MetricsItemStackHelperType as any)(
      metrics_config.target_block,
      1,
    );
    itemPreview = metrics_d2d.addItem(10, 25, item);
  } catch (e) {}
}

function updateHudText() {
  if (!txtMain) return;

  const analysis = getAnalysis();

  let rateColor = "§7";
  if (analysis.rate > 100) rateColor = "§6";
  else if (analysis.rate > 60) rateColor = "§a";
  else if (analysis.rate > 0) rateColor = "§f";

  const text = `§e${metrics_config.target_name} §7| Sess: §b${session_total} §7| Rate: ${rateColor}${analysis.rate}§7/min | Avg: §f${analysis.avg_delta}§7ms | Est: §f${analysis.projected_hourly}§7/hr`;

  txtMain.setText(text);
}

// --- Event Handlers ---

const onMineBlock = (data: MineBlockEvent) => {
  if (data.id === metrics_config.target_block) {
    session_total++;
    break_history.push(Date.now());
    logger.info(
      `Block break recorded at [${data.pos.x}, ${data.pos.y}, ${data.pos.z}]. Session total: ${session_total}`,
    );
    updateHudText();
  }
};

const onTick = JavaWrapper.methodToJava(() => {
  tick_count++;
  // Periodic HUD Update
  if (tick_count % 20 === 0) {
    updateHudText();
  }
});

// --- Command ---
const metricsCmd = Chat.getCommandManager()
  .createCommandBuilder("metrics")
  .literalArg("set")
  .executes(
    JavaWrapper.methodToJava(() => {
      const player = Player.getPlayer();
      if (!player) return;
      const reach = Player.getReach() || 5;
      const ray = player.rayTraceBlock(reach, false);
      const block = ray ? ray.getBlock() : null;

      if (block && block.getId() !== "minecraft:air") {
        metrics_config.target_block = block.getId();
        metrics_config.target_name = getPrettyName(metrics_config.target_block);
        logger.info(
          `Target block set to: ${metrics_config.target_block} via command.`,
        );
        saveMetricsConfig();

        session_total = 0;
        break_history = [];

        updateItemPreview();
        updateHudText();
        Chat.log(
          `§a[Metrics]§r Set target to: §e${metrics_config.target_name}`,
        );
      } else {
        logger.warn("Set command failed: Not looking at a valid block.");
        Chat.log("§c[Metrics]§r Look at a block to track it!");
      }
    }),
  )
  .or()
  .literalArg("reset")
  .executes(
    JavaWrapper.methodToJava((ctx) => {
      logger.info("Session statistics reset via command.");
      session_total = 0;
      break_history = [];
      updateHudText();
      Chat.log("§a[Metrics]§r Statistics reset.");
    }),
  );

// --- Initialization ---
metrics_d2d.register();
metricsCmd.register();
logger.info("Metrics Service initialized.");

const metricsListeners = [
  JsMacros.on("Tick", onTick),
  EventUtils.onCustom<MineBlockEvent>(EVENT_MINE_BLOCK, onMineBlock),
];

(event as Events.Service).stopListener = JavaWrapper.methodToJava(() => {
  logger.info("Stopping Metrics Service...");
  metrics_d2d.unregister();
  metricsCmd.unregister();
  metricsListeners.forEach((l) => JsMacros.off(l));
  logger.info("Metrics Service stopped.");
});

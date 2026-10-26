import { Logger, LogLevel } from "../../utils/debug";
import { handleTick, handleKey, stopEverything } from "./actions";
import { cmd } from "./commands";
import { registerHUDs, unregisterHUDs } from "./hud";
import { ensureDirectory } from "./storage";

const logger = new Logger("PathReplay", LogLevel.INFO);

// Initialize
ensureDirectory();
cmd.register();
registerHUDs();

const tickListener = JsMacros.on(
  "Tick",
  JavaWrapper.methodToJava(handleTick)
);

const keyListener = JsMacros.on(
  "Key",
  JavaWrapper.methodToJava(handleKey)
);

(event as any).stopListener = JavaWrapper.methodToJava(() => {
  cmd.unregister();
  unregisterHUDs();
  JsMacros.off(tickListener);
  JsMacros.off(keyListener);
  stopEverything();
  logger.info("Service stopped.");
});

logger.info("Path Replay Service initialized. Use §b/path§f to start.");

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Logger = exports.LogLevel = void 0;
/**
 * Log levels for the Logger class.
 */
var LogLevel;
(function (LogLevel) {
    LogLevel[LogLevel["TRACE"] = -1] = "TRACE";
    LogLevel[LogLevel["DEBUG"] = 0] = "DEBUG";
    LogLevel[LogLevel["INFO"] = 1] = "INFO";
    LogLevel[LogLevel["WARN"] = 2] = "WARN";
    LogLevel[LogLevel["ERROR"] = 3] = "ERROR";
})(LogLevel || (exports.LogLevel = LogLevel = {}));
/**
 * Colors for different log levels (Minecraft color codes).
 */
const LevelColors = {
    [LogLevel.TRACE]: "§8", // Dark Gray
    [LogLevel.DEBUG]: "§7", // Gray
    [LogLevel.INFO]: "§f", // White
    [LogLevel.WARN]: "§6", // Gold
    [LogLevel.ERROR]: "§c" // Red
};
/**
 * A utility class for standardized logging and debugging.
 */
class Logger {
    prefix;
    minLevel;
    /**
     * @param prefix The prefix to use for all logs (e.g., "AutoWood").
     * @param minLevel The minimum log level to display (default: INFO).
     */
    constructor(prefix, minLevel = LogLevel.INFO) {
        this.prefix = prefix;
        this.minLevel = minLevel;
    }
    /**
     * Sets the minimum log level.
     */
    setLogLevel(level) {
        this.minLevel = level;
    }
    /**
     * Generic logging method.
     */
    _log(message, level) {
        if (level < this.minLevel)
            return;
        const levelName = LogLevel[level];
        const color = LevelColors[level];
        const formattedMessage = `§8[§b${this.prefix}§8] ${color}[${levelName}] §r${message}`;
        Chat.log(Chat.createTextHelperFromString(formattedMessage));
    }
    trace(message) {
        this._log(message, LogLevel.TRACE);
    }
    debug(message) {
        this._log(message, LogLevel.DEBUG);
    }
    info(message) {
        this._log(message, LogLevel.INFO);
    }
    warn(message) {
        this._log(message, LogLevel.WARN);
    }
    error(message) {
        this._log(message, LogLevel.ERROR);
    }
    /**
     * Displays a non-intrusive action bar message.
     */
    status(message) {
        Chat.actionbar(Chat.createTextHelperFromString(`§8[§b${this.prefix}§8] §r${message}`));
    }
    /**
     * Displays a toast notification.
     */
    notify(title, message) {
        Chat.toast(Chat.createTextHelperFromString(title), Chat.createTextHelperFromString(message));
    }
    /**
     * Helper to format coordinates.
     */
    static formatPos(pos) {
        if ('getX' in pos) {
            return `(${pos.getX()}, ${pos.getY()}, ${pos.getZ()})`;
        }
        return `(${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)})`;
    }
    /**
     * Helper to format distances for display.
     */
    static formatDist(dist) {
        return dist.toFixed(1) + "m";
    }
}
exports.Logger = Logger;

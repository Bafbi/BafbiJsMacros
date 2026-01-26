
/**
 * Log levels for the Logger class.
 */
export enum LogLevel {
    TRACE = -1,
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3
}

/**
 * Colors for different log levels (Minecraft color codes).
 */
const LevelColors = {
    [LogLevel.TRACE]: "§8", // Dark Gray
    [LogLevel.DEBUG]: "§7", // Gray
    [LogLevel.INFO]: "§f",  // White
    [LogLevel.WARN]: "§6",  // Gold
    [LogLevel.ERROR]: "§c"  // Red
};

/**
 * A utility class for standardized logging and debugging.
 */
export class Logger {
    private prefix: string;
    private minLevel: LogLevel;

    /**
     * @param prefix The prefix to use for all logs (e.g., "AutoWood").
     * @param minLevel The minimum log level to display (default: INFO).
     */
    constructor(prefix: string, minLevel: LogLevel = LogLevel.INFO) {
        this.prefix = prefix;
        this.minLevel = minLevel;
    }

    /**
     * Sets the minimum log level.
     */
    public setLogLevel(level: LogLevel): void {
        this.minLevel = level;
    }

    /**
     * Generic logging method.
     */
    private _log(message: string, level: LogLevel): void {
        if (level < this.minLevel) return;

        const levelName = LogLevel[level];
        const color = LevelColors[level];
        const formattedMessage = `§8[§b${this.prefix}§8] ${color}[${levelName}] §r${message}`;

        Chat.log(Chat.createTextHelperFromString(formattedMessage));
    }

    public trace(message: string): void {
        this._log(message, LogLevel.TRACE);
    }

    public debug(message: string): void {
        this._log(message, LogLevel.DEBUG);
    }

    public info(message: string): void {
        this._log(message, LogLevel.INFO);
    }

    public warn(message: string): void {
        this._log(message, LogLevel.WARN);
    }

    public error(message: string): void {
        this._log(message, LogLevel.ERROR);
    }

    /**
     * Displays a non-intrusive action bar message.
     */
    public status(message: string): void {
        Chat.actionbar(Chat.createTextHelperFromString(`§8[§b${this.prefix}§8] §r${message}`));
    }

    /**
     * Displays a toast notification.
     */
    public notify(title: string, message: string): void {
        Chat.toast(
            Chat.createTextHelperFromString(title),
            Chat.createTextHelperFromString(message)
        );
    }

    /**
     * Helper to format coordinates.
     */
    public static formatPos(pos: { getX(): number, getY(): number, getZ(): number } | { x: number, y: number, z: number }): string {
        if ('getX' in pos) {
            return `(${pos.getX()}, ${pos.getY()}, ${pos.getZ()})`;
        }
        return `(${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)})`;
    }

    /**
     * Helper to format distances for display.
     */
    public static formatDist(dist: number): string {
        return dist.toFixed(1) + "m";
    }
}

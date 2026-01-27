export interface MineBlockEvent {
    pos: { x: number; y: number; z: number };
    id: string | null;
}

export const EVENT_MINE_BLOCK = "Service:MineBlock";

export class EventUtils {
    /**
     * Registers a custom event so it can be listened to before it's ever triggered.
     * @param name The name of the custom event
     */
    static registerCustom(name: string) {
        const event = JsMacros.createCustomEvent(name);
        event.registerEvent();
    }

    /**
     * Triggers a custom event with the given name and data.
     * Uses JSON serialization to safely pass data across service contexts.
     * @param name The name of the custom event
     * @param data The data object to pass with the event
     */
    static triggerCustom(name: string, data: any) {
        const event = JsMacros.createCustomEvent(name);
        event.putString("data", JSON.stringify(data));
        event.trigger();
    }

    /**
     * Listens for a custom event.
     * Handles JSON deserialization from the event data.
     * @param name The name of the custom event
     * @param callback The callback function receiving the typed data and the raw event
     * @returns The listener object
     */
    static onCustom<T>(name: string, callback: (data: T, event: Events.Custom) => void) {
        this.registerCustom(name);
        
        return JsMacros.on(name as any, JavaWrapper.methodToJava((event: Events.Custom) => {
            const raw = event.getString("data");
            if (raw) {
                try {
                    const data = JSON.parse(raw) as T;
                    callback(data, event);
                } catch (e) {
                    Chat.log("§c[EventUtils] Error parsing event data: " + e);
                }
            }
        }));
    }
}

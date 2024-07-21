export class Gui {
    public inventory: Inventory;

    constructor(command: string) {
        Chat.say(`/${command}`);



        this.wait_new_inventory();
    }

    private wait_new_inventory() {
        JsMacros.waitForEvent("OpenContainer");
        const eventAndContext = JsMacros.waitForEvent("ContainerUpdate");
        this.inventory = eventAndContext.event.inventory;
    }

    private wait_inventory_update() {
        const eventAndContext = JsMacros.waitForEvent("ContainerUpdate");
        this.inventory = eventAndContext.event.inventory;
    }

    public log_pretty_inventory() {
        let pretty_inventory = this.inventory.getContainerTitle() + "\n";
        for (let i = 0; i < this.inventory.getTotalSlots(); i++) {
            pretty_inventory += `${i}: ${this.inventory.getSlot(i).toString()}\n`;
        }
        Chat.log(pretty_inventory);
    }

    public click_slot(slot: number, mouse_click: MouseClick = MouseClick.LEFT) {
        this.inventory.click(slot, mouse_click);
        // this.wait_inventory_update();

        Time.sleep(300);
    }

    public change_page(slot: number, mouse_click: MouseClick = MouseClick.LEFT) {
        this.inventory.click(slot, mouse_click);
        this.wait_new_inventory();
    }

    public click_item(item_id: string, mouse_click: MouseClick = MouseClick.LEFT) {
        const gui_size = this.get_gui_size();
        const slot = this.inventory.findItem(item_id).filter((slot) => slot < gui_size);
        if (slot.length === 0) {
            Chat.log(Chat.createTextBuilder().append("Item ").append(item_id).withColor(0x6).append(" not found in inventory").build());
            return;
        }
        if (slot.length > 1) {
            Chat.log(Chat.createTextBuilder().append("Item ").append(item_id).withColor(0x6).append(" found multiple items in inventory").build());
            return;
        }

        this.click_slot(slot[0], mouse_click);
    }

    public get_player_inventory() {
        const items = [];
        for (let i = this.get_gui_size(); i < this.inventory.getTotalSlots(); i++) {
            items.push(this.inventory.getSlot(i));
        }
        return items;
    }

    public close() {
        this.inventory.close();
    }

    public get_gui_size() {
        const size_mapping = {
            "6 Row Chest": 54,
            "5 Row Chest": 45,
        }

        const type = this.inventory.getType()
        if (type in size_mapping) {
            return size_mapping[type];
        }
        return 0;
    }

}

export enum MouseClick {
    LEFT = 0,
    RIGHT = 1,
    MIDDLE = 2,
}
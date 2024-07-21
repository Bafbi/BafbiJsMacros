"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MouseClick = exports.Gui = void 0;
class Gui {
    inventory;
    constructor(command) {
        Chat.say(`/${command}`);
        this.wait_new_inventory();
    }
    wait_new_inventory() {
        JsMacros.waitForEvent("OpenContainer");
        const eventAndContext = JsMacros.waitForEvent("ContainerUpdate");
        this.inventory = eventAndContext.event.inventory;
    }
    wait_inventory_update() {
        const eventAndContext = JsMacros.waitForEvent("ContainerUpdate");
        this.inventory = eventAndContext.event.inventory;
    }
    log_pretty_inventory() {
        let pretty_inventory = this.inventory.getContainerTitle() + "\n";
        for (let i = 0; i < this.inventory.getTotalSlots(); i++) {
            pretty_inventory += `${i}: ${this.inventory.getSlot(i).toString()}\n`;
        }
        Chat.log(pretty_inventory);
    }
    click_slot(slot, mouse_click = MouseClick.LEFT) {
        this.inventory.click(slot, mouse_click);
        // this.wait_inventory_update();
        Time.sleep(300);
    }
    change_page(slot, mouse_click = MouseClick.LEFT) {
        this.inventory.click(slot, mouse_click);
        this.wait_new_inventory();
    }
    click_item(item_id, mouse_click = MouseClick.LEFT) {
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
    get_player_inventory() {
        const items = [];
        for (let i = this.get_gui_size(); i < this.inventory.getTotalSlots(); i++) {
            items.push(this.inventory.getSlot(i));
        }
        return items;
    }
    close() {
        this.inventory.close();
    }
    get_gui_size() {
        const size_mapping = {
            "6 Row Chest": 54,
            "5 Row Chest": 45,
        };
        const type = this.inventory.getType();
        if (type in size_mapping) {
            return size_mapping[type];
        }
        return 0;
    }
}
exports.Gui = Gui;
var MouseClick;
(function (MouseClick) {
    MouseClick[MouseClick["LEFT"] = 0] = "LEFT";
    MouseClick[MouseClick["RIGHT"] = 1] = "RIGHT";
    MouseClick[MouseClick["MIDDLE"] = 2] = "MIDDLE";
})(MouseClick || (exports.MouseClick = MouseClick = {}));

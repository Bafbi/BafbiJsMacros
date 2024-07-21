"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const gui_1 = require("../../utils/gui");
// JsMacros.on("ContainerUpdate", JavaWrapper.methodToJava((event) => {
//     Chat.log("ContainerUpdate");
// }));
/// Sell Cobblestone
{
    const shop = new gui_1.Gui("shop");
    shop.change_page(33, gui_1.MouseClick.LEFT);
    Time.sleep(200);
    shop.click_item("minecraft:cobblestone", gui_1.MouseClick.MIDDLE);
    shop.close();
}
Time.sleep(200);
/// Sell ores
{
    const shop = new gui_1.Gui("shop minerais");
    if (shop.get_player_inventory().find((item) => item.getItemId() === "minecraft:raw_iron") !== undefined)
        shop.click_item("minecraft:raw_iron", gui_1.MouseClick.MIDDLE);
    if (shop.get_player_inventory().find((item) => item.getItemId() === "minecraft:raw_copper") !== undefined)
        shop.click_item("minecraft:raw_copper", gui_1.MouseClick.MIDDLE);
    Time.sleep(200);
    shop.change_page(50, gui_1.MouseClick.LEFT);
    Time.sleep(200);
    if (shop.get_player_inventory().find((item) => item.getItemId() === "minecraft:diamond") !== undefined)
        shop.click_item("minecraft:diamond", gui_1.MouseClick.MIDDLE);
    if (shop.get_player_inventory().find((item) => item.getItemId() === "minecraft:lapis_lazuli") !== undefined)
        shop.click_item("minecraft:lapis_lazuli", gui_1.MouseClick.MIDDLE);
    if (shop.get_player_inventory().find((item) => item.getItemId() === "minecraft:emerald") !== undefined)
        shop.click_item("minecraft:emerald", gui_1.MouseClick.MIDDLE);
    if (shop.get_player_inventory().find((item) => item.getItemId() === "minecraft:redstone") !== undefined)
        shop.click_item("minecraft:redstone", gui_1.MouseClick.MIDDLE);
    if (shop.get_player_inventory().find((item) => item.getItemId() === "minecraft:raw_gold") !== undefined)
        shop.click_item("minecraft:raw_gold", gui_1.MouseClick.MIDDLE);
    if (shop.get_player_inventory().find((item) => item.getItemId() === "minecraft:coal") !== undefined)
        shop.click_item("minecraft:coal", gui_1.MouseClick.MIDDLE);
    shop.close();
}
// Chat.say("/pw gen")

import { Gui, MouseClick } from "../../utils/gui";
// JsMacros.on("ContainerUpdate", JavaWrapper.methodToJava((event) => {
//     Chat.log("ContainerUpdate");
// }));
/// Sell Cobblestone
{
    const shop = new Gui("shop");
    shop.change_page(33, MouseClick.LEFT);
    Time.sleep(200);
    shop.click_item("minecraft:cobblestone", MouseClick.MIDDLE);
    shop.close();
}
Time.sleep(200);
/// Sell ores
{
    const shop = new Gui("shop minerais");
    if (shop.get_player_inventory().find((item) => item.getItemId() === "minecraft:raw_iron") !== undefined)
        shop.click_item("minecraft:raw_iron", MouseClick.MIDDLE);
    if (shop.get_player_inventory().find((item) => item.getItemId() === "minecraft:raw_copper") !== undefined)
        shop.click_item("minecraft:raw_copper", MouseClick.MIDDLE);
    Time.sleep(200);
    shop.change_page(50, MouseClick.LEFT);
    Time.sleep(200);
    if (shop.get_player_inventory().find((item) => item.getItemId() === "minecraft:diamond") !== undefined)
        shop.click_item("minecraft:diamond", MouseClick.MIDDLE);
    if (shop.get_player_inventory().find((item) => item.getItemId() === "minecraft:lapis_lazuli") !== undefined)
        shop.click_item("minecraft:lapis_lazuli", MouseClick.MIDDLE);
    if (shop.get_player_inventory().find((item) => item.getItemId() === "minecraft:emerald") !== undefined)
        shop.click_item("minecraft:emerald", MouseClick.MIDDLE);
    if (shop.get_player_inventory().find((item) => item.getItemId() === "minecraft:redstone") !== undefined)
        shop.click_item("minecraft:redstone", MouseClick.MIDDLE);
    if (shop.get_player_inventory().find((item) => item.getItemId() === "minecraft:raw_gold") !== undefined)
        shop.click_item("minecraft:raw_gold", MouseClick.MIDDLE);
    if (shop.get_player_inventory().find((item) => item.getItemId() === "minecraft:coal") !== undefined)
        shop.click_item("minecraft:coal", MouseClick.MIDDLE);
    shop.close();
}
// Chat.say("/pw gen")

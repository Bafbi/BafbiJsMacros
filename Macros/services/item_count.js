// load config
const config = { item: null };
if (FS.exists("item_count.json")) {
    Object.assign(config, JSON.parse(FS.open("item_count.json").read()));
}
const d2d = Hud.createDraw2D();
let item_text;
let item_image;
const ItemStackHelperClass = Reflection.getClass("xyz.wagyourtail.jsmacros.client.api.helpers.inventory.ItemStackHelper");
const ItemStackHelperType = Java.type("xyz.wagyourtail.jsmacros.client.api.helpers.inventory.ItemStackHelper");
let item = new ItemStackHelperType(config.item ?? "barrier", 1);
d2d.setOnInit(JavaWrapper.methodToJava(() => {
    item_text = d2d.addText("/item_count <item>", 53, d2d.getHeight() - 27, 0xffffff, 0, true, 1, 0);
    item_image = d2d.addItem(35, d2d.getHeight() - 32, item);
    config.item && countItems();
}));
function countItems() {
    const inv = Player.openInventory();
    let count = 0;
    inv.getItems().forEach(JavaWrapper.methodToJava((inv_item) => {
        if (inv_item.equals(item)) {
            count += inv_item.getCount();
        }
    }));
    item_text.setText(count.toString());
}
const heldItemChangeListener = JsMacros.on("HeldItemChange", JavaWrapper.methodToJava((event) => {
    countItems();
}));
const itemCountCommand = Chat.getCommandManager()
    .createCommandBuilder("item_count")
    .executes(JavaWrapper.methodToJava((context) => {
    const inv = Player.openInventory();
    item = inv.getSlot(inv.getSelectedHotbarSlotIndex() + 36);
    item_image.setItem(item);
    config.item = item.getItemId();
    FS.open("item_count.json").write(JSON.stringify(config));
    countItems();
    Chat.log("Item set to " + item.getItemId());
}))
    .itemArg("item")
    .executes(JavaWrapper.methodToJava((context) => {
    item = context.getArg("item");
    item_image.setItem(item);
    config.item = item.getItemId();
    FS.open("item_count.json").write(JSON.stringify(config));
    countItems();
    Chat.log("Item set to " + item.getItemId());
}));
itemCountCommand.register();
d2d.register();
// this fires when the service is stopped
event.stopListener = JavaWrapper.methodToJava(() => {
    d2d.unregister();
    JsMacros.off(heldItemChangeListener);
    itemCountCommand.unregister();
});

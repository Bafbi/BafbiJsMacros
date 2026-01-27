// load config
const ic_config = { item: null };
if (FS.exists("item_count.json")) {
    Object.assign(ic_config, JSON.parse(FS.open("item_count.json").read()));
}
const ic_d2d = Hud.createDraw2D();
let item_text;
let item_image;
const ItemStackHelperClass = Reflection.getClass("com.jsmacrosce.jsmacros.client.api.helper.inventory.ItemStackHelper");
const ItemStackHelperType = Java.type("com.jsmacrosce.jsmacros.client.api.helper.inventory.ItemStackHelper");
let item = new ItemStackHelperType(ic_config.item ?? "barrier", 1);
ic_d2d.setOnInit(JavaWrapper.methodToJava(() => {
    item_text = ic_d2d.addText("/item_count <item>", 53, ic_d2d.getHeight() - 27, 0xffffff, 0, true, 1, 0);
    item_image = ic_d2d.addItem(35, ic_d2d.getHeight() - 32, item);
    ic_config.item && countItems();
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
    ic_config.item = item.getItemId();
    FS.open("item_count.json").write(JSON.stringify(ic_config));
    countItems();
    Chat.log("Item set to " + item.getItemId());
}))
    .itemArg("item")
    .executes(JavaWrapper.methodToJava((context) => {
    item = context.getArg("item");
    item_image.setItem(item);
    ic_config.item = item.getItemId();
    FS.open("item_count.json").write(JSON.stringify(ic_config));
    countItems();
    Chat.log("Item set to " + item.getItemId());
}));
itemCountCommand.register();
ic_d2d.register();
// this fires when the service is stopped
event.stopListener = JavaWrapper.methodToJava(() => {
    ic_d2d.unregister();
    JsMacros.off(heldItemChangeListener);
    itemCountCommand.unregister();
});

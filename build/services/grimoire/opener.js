{
    // services start with minecraft, when enabled and are meant to be persistent scripts.
    JsMacros.assertEvent(event, "Service");
    function isClosedGrimoire(item) {
        return (item.getItemId() === "minecraft:raw_iron" &&
            item.getNBT().asCompoundHelper().get(`ClueScrolls.uuid`) !== null &&
            item.getNBT().asCompoundHelper().get(`ClueScrolls.clues.0.clueType`) ===
                null);
    }
    function getClosedGrimoiresSlots(inventory) {
        const grimoiresSlots = [];
        inventory.getMap()["container"]?.forEach((slot) => {
            const item = inventory.getSlot(slot);
            if (isClosedGrimoire(item)) {
                grimoiresSlots.push(slot);
            }
        });
        return grimoiresSlots;
    }
    const openContainerListener = JsMacros.on("OpenContainer", JavaWrapper.methodToJava((event) => {
        JsMacros.waitForEvent("ContainerUpdate");
        const inventory = event.inventory;
        const screen = event.screen;
        if (inventory === null || screen === null)
            return;
        const grimoiresSlots = getClosedGrimoiresSlots(inventory);
        // put controlle in botton right corner
        screen.addText("Closed Grimoires: " + grimoiresSlots.length, screen.getWidth() - 20 - 100, screen.getHeight() - 40, 0xffffff, false);
        // screen.addButton(x, y, width, height, text, callback)
        screen.addButton(screen.getWidth() - 20 - 100, screen.getHeight() - 20, 100, 20, "Open Grimoires", JavaWrapper.methodToJava(() => {
            inventory.setSelectedHotbarSlotIndex(0);
            grimoiresSlots.forEach((slot) => {
                inventory.swapHotbar(slot, 0);
                Time.sleep(30);
                Player.getInteractionManager().interactItem(false);
                Time.sleep(30);
                inventory.swapHotbar(slot, 0);
                Time.sleep(30);
            });
        }));
    }));
    // this fires when the service is stopped
    event.stopListener = JavaWrapper.methodToJava(() => {
        JsMacros.off(openContainerListener);
    });
}

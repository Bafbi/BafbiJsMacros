// services start with minecraft, when enabled and are meant to be persistent scripts.
JsMacros.assertEvent(event, "Service");
let execute = false;

const EXPChanger = JsMacros.on(
  "EXPChange",
  JavaWrapper.methodToJava((event) => {
    if (event.level >= 20 && !execute) {
      execute = true;

      Chat.say("/parchemin");
      JsMacros.waitForEvent("OpenContainer");
      const eventAndContext = JsMacros.waitForEvent("ContainerUpdate");
      const inventory = eventAndContext.event.inventory;

      // Chat.log(inventory.getSlot(22));
      Time.sleep(100);
      inventory.click(20);
      execute = false;
    }
  }),
);

// this fires when the service is stopped
event.stopListener = JavaWrapper.methodToJava(() => {
  JsMacros.off(EXPChanger);
});

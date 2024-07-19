let afk_pos = null;
let afk_view = null;
let is_attacking = false;
const tick_listener = JsMacros.on("Tick", JavaWrapper.methodToJava((event) => {
    if (afk_pos === null || afk_view === null)
        return;
    const player = Player.getPlayer();
    const pos = player.getBlockPos();
    const view = [player.getYaw(), player.getPitch()];
    if (!pos.equals(afk_pos) || isViewChanged(view)) {
        Chat.log("moved");
        afk_pos = null;
        KeyBind.keyBind("key.attack", false);
        is_attacking = false;
        Chat.log("stop mining");
    }
    else {
        if (!is_attacking) {
            KeyBind.keyBind("key.attack", true);
            is_attacking = true;
            Chat.log("start mining");
        }
    }
}));
function isViewChanged(view) {
    // within 5 degrees
    return (Math.abs(view[0] - afk_view[0]) > 5 || Math.abs(view[1] - afk_view[1]) > 5);
}
const automine_command = Chat.getCommandManager()
    .createCommandBuilder("automine")
    .executes(JavaWrapper.methodToJava((context) => {
    afk_pos = Player.getPlayer().getBlockPos();
    afk_view = [
        Player.getPlayer().getYaw(),
        Player.getPlayer().getPitch(),
    ];
}));
automine_command.register();
// this fires when the service is stopped
event.stopListener = JavaWrapper.methodToJava(() => {
    JsMacros.off(tick_listener);
    automine_command.unregister();
});

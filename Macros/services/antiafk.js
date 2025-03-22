{
    const afk_debug_d2d = Hud.createDraw2D();
    let d2d_text;
    afk_debug_d2d.setOnInit(JavaWrapper.methodToJava(() => {
        d2d_text = afk_debug_d2d.addText("AFK: false", 10, afk_debug_d2d.getHeight() - 40, 0xffffff, true);
    }));
    afk_debug_d2d.register();
    let afk_pos = null;
    let afk_view = null;
    let is_afk = false;
    // this script make the head of the player move in a square pattern
    const tickBeetwen = 100;
    let tick = 0;
    const tilt = 0.3;
    let phase = 0;
    const tick_listener = JsMacros.on("Tick", JavaWrapper.methodToJava((event) => {
        if (tick < tickBeetwen) {
            tick++;
            return;
        }
        else {
            tick = 0;
        }
        // Chat.log("tick");
        if (afk_pos === null || afk_view === null)
            return;
        const player = Player.getPlayer();
        const pos = player.getBlockPos();
        const view = [player.getYaw(), player.getPitch()];
        if (!pos.equals(afk_pos)) {
            afk_pos = null;
            is_afk = false;
            d2d_text.setText("AFK: false");
            return;
        }
        // Chat.log(`phase: ${phase}`);
        if (phase === 0) {
            player.lookAt(view[0] + tilt, view[1]);
            KeyBind.keyBind("key.left", true);
            Client.waitTick();
            KeyBind.keyBind("key.left", false);
            phase = 1;
        }
        else if (phase === 1) {
            player.lookAt(view[0], view[1] + tilt);
            phase = 2;
        }
        else if (phase === 2) {
            player.lookAt(view[0] - tilt, view[1]);
            KeyBind.keyBind("key.right", true);
            Client.waitTick();
            KeyBind.keyBind("key.right", false);
            phase = 3;
        }
        else if (phase === 3) {
            player.lookAt(view[0], view[1] - tilt);
            phase = 0;
        }
        if (!is_afk) {
            is_afk = true;
            d2d_text.setText(`AFK: true, phase: ${phase}`);
        }
    }));
    const automine_command = Chat.getCommandManager()
        .createCommandBuilder("antiafk")
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
        afk_debug_d2d.unregister();
        automine_command.unregister();
    });
}
export function isViewChanged(view, other) {
    // within 5 degrees
    return Math.abs(view[0] - other[0]) > 5 || Math.abs(view[1] - other[1]) > 5;
}

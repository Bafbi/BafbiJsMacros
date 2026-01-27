"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const automine_1 = require("./automine");
{
    let afk_pos = null;
    let afk_view = null;
    let is_attacking = false;
    let tping = false;
    const tick_listener = JsMacros.on("Tick", JavaWrapper.methodToJava((event) => {
        if (Player.getPlayer().getHealth() <= 5 && !tping) {
            tping = true;
            Chat.log("Low health");
            Chat.say("/pw gen");
        }
        if (afk_pos === null || afk_view === null)
            return;
        const player = Player.getPlayer();
        const pos = player.getBlockPos();
        const view = [player.getYaw(), player.getPitch()];
        if (!(pos.getX() === afk_pos.getX()) || !(pos.getZ() === afk_pos.getZ()) || (0, automine_1.isViewChanged)(view, afk_view)) {
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
        if (pos.equals(afk_pos) && !tping) {
            tping = true;
            Chat.log("Tp high");
            Chat.say("/pw gen");
        }
        if (!pos.equals(afk_pos) && tping) {
            tping = false;
            KeyBind.keyBind("key.sneak", true);
        }
    }));
    const automine_command = Chat.getCommandManager()
        .createCommandBuilder("autohammer")
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
}

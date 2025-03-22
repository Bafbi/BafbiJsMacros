// if (event.type.includes("OverlayMessage")) {
//   Chat.log("New Packet " + event.type);
//   const buffer = event.getPacketBuffer();
//   const nbt = buffer.readNbt();
//   Chat.log("Buffer: " + nbt);
//   FS.open("./data.txt").append(nbt.toString() + "\n");
// }
{
    /// Game utils ///
    const my_mapping_string = {
        "58038": "arrow",
        "58036": "background",
        "58037": "canne",
    };
    function create_mapping_string() {
        const texture = JSON.parse(FS.open("./texture.json").read());
        const mapping_string = {};
        for (const key in my_mapping_string) {
            mapping_string[key] = my_mapping_string[key];
        }
        // map based on char code and height
        for (const key in texture) {
            const char = texture[key].chars[0];
            const char_code = char.charCodeAt(0);
            mapping_string[char_code] = texture[key].height;
        }
        return mapping_string;
    }
    const mapping_string = create_mapping_string();
    function parse_state(message) {
        const all = [];
        let cumulate = 0;
        let negatif = null;
        for (let i = 0; i < message.length; i++) {
            const char_code = message.charCodeAt(i);
            const string = mapping_string[char_code];
            if (Number.isInteger(string)) {
                const height = parseInt(string);
                if (negatif === null) {
                    negatif = height < 0;
                }
                if (negatif === height < 0) {
                    cumulate += height;
                }
                else {
                    all.push(cumulate);
                    cumulate = height;
                    negatif = height < 0;
                }
            }
            else {
                all.push(cumulate);
                cumulate = 0;
                negatif = null;
                all.push(string);
            }
        }
        all.push(cumulate);
        // discard the first 3 elements
        all.shift();
        all.shift();
        all.shift();
        // get the canne data
        const canne = all.shift();
        all.shift();
        all.shift();
        // get the arrow data
        const arrows = [];
        while (all.length > 0) {
            arrows.push(all.shift());
            all.shift();
            all.shift();
        }
        return { canne, arrows };
    }
    /// Game utils ///
    /// Game Stats ///
    class MeanList {
        constructor() {
            this.list = [];
            this.sum = 0;
            this.size = 10;
        }
        push(value) {
            this.list.push(value);
            this.sum += value;
            if (this.list.length > this.size) {
                this.sum -= this.list.shift();
            }
        }
        pretty() {
            return this.list.join(", ");
        }
        mean() {
            return this.sum / this.list.length;
        }
    }
    class Stats {
        constructor() {
            this.xp_gained = 0;
            this.money_gained = 0;
            this.games_finished = 0;
            this.load();
        }
        save() {
            FS.open("./stats.json").write(JSON.stringify(this));
        }
        load() {
            if (!FS.exists("./stats.json")) {
                this.save();
                return;
            }
            const stats = JSON.parse(FS.open("./stats.json").read());
            this.xp_gained = stats.xp_gained;
            this.money_gained = stats.money_gained;
            this.games_finished = stats.games_finished;
        }
    }
    class StatsHud {
        constructor() {
            // | Game Status: In game
            // | -------------------------
            // | Finished games: 0
            // | Game time mean: 0
            this.d2d = Hud.createDraw2D();
            this.game_status = false;
            this.status_time = null;
            const line_height = 10;
            const base_pos = [10, 190];
            this.d2d.setOnInit(JavaWrapper.methodToJava(() => {
                this.game_status_text = this.d2d.addText("Game status: Not in game", base_pos[0], base_pos[1], 0xffffff, true);
                this.stat_finished_games = this.d2d.addText("Finished games: 0", base_pos[0], base_pos[1] + line_height, 0xffffff, true);
            }));
            this.tick_listener = JsMacros.on("Tick", JavaWrapper.methodToJava(() => {
                if (this.status_time !== null) {
                    const elapsed = Time.time() - this.status_time;
                    this.update_game_status_text(elapsed);
                }
            }));
            this.d2d.register();
        }
        update() {
            this.update_finished_games(last_10_game_time.mean() + last_10_non_game_time.mean());
        }
        update_finished_games(mean_time) {
            const game_per_hour = 3600000 / mean_time;
            this.stat_finished_games.setText(Chat.createTextBuilder().append("Finished games: ").append(stats.games_finished).withFormatting(false, true, false, false, false).append(` (${game_per_hour.toFixed(1)}/h)`).build());
        }
        set_game_status(status) {
            this.status_time = Time.time();
            this.game_status = status;
            this.update_game_status_text(0);
        }
        update_game_status_text(elapsed) {
            this.game_status_text.setText(Chat.createTextBuilder().append("Game status: ").append(this.game_status ? "In game" : "Not in game").withColor(this.game_status ? 0x6 : 0xc).append(` (${elapsed}ms)`).build());
        }
        unregister() {
            this.d2d.unregister();
            JsMacros.off(this.tick_listener);
        }
    }
    const last_10_game_time = new MeanList();
    const last_10_non_game_time = new MeanList();
    const stats = new Stats();
    const stats_hud = new StatsHud();
    stats_hud.update();
    stats_hud.set_game_status(false);
    /// Game Stats ///
    let in_game = false;
    let game_time = Time.time();
    let clicked_arrow = null;
    const action_listener = JsMacros.on("Title", JavaWrapper.methodToJava((event) => {
        if (event.type !== "TITLE")
            return;
        const game_view = event.message.getString();
        // if game_view does not caontain the '' char, it is not the right message
        if (!game_view.includes(""))
            return;
        if (!in_game) {
            in_game = true;
            last_10_non_game_time.push(Time.time() - game_time);
            game_time = Time.time();
            stats_hud.set_game_status(true);
        }
        const state = parse_state(game_view);
        if (state.arrows.length === 0) {
            // game ended
            in_game = false;
            const time = Time.time() - game_time;
            last_10_game_time.push(time);
            stats.games_finished++;
            stats.save();
            stats_hud.update();
            stats_hud.set_game_status(false);
            // wait 500ms before sending the canne
            Time.sleep(500);
            // resend the canne
            KeyBind.keyBind("key.use", true);
            KeyBind.keyBind("key.use", false);
            game_time = Time.time();
            return;
        }
        // if canne close to any of the arrows, then click
        for (const arrow of state.arrows) {
            // if the arrow is close to the canne : between 1 and 5
            const distance = Math.abs(arrow - (state.canne + 2));
            const distance_to_click = Math.floor(Math.random() * 3 + 7);
            if (distance < distance_to_click) {
                if (clicked_arrow === arrow)
                    continue;
                // click on the arrow
                Chat.actionbar("Clicking on arrow " + arrow + " with distance " + distance + " to canne " + state.canne + " and distance to click " + distance_to_click);
                KeyBind.keyBind("key.use", true);
                KeyBind.keyBind("key.use", false);
                clicked_arrow = arrow;
                return;
            }
        }
        // if the game is too long, then click anyway
        if ((Time.time() - game_time) > 20000) {
            KeyBind.keyBind("key.use", true);
            KeyBind.keyBind("key.use", false);
        }
    }));
    const tick_listener = JsMacros.on("Tick", JavaWrapper.methodToJava(() => {
        if (!in_game && (Time.time() - game_time) > 30000) {
            game_time = Time.time();
            Chat.log("Long time without game, checking for water and canne");
            if (World.getBlock(Player.getPlayer().getBlockPos()).getId() !== "minecraft:water")
                return;
            const inv = Player.openInventory();
            if (!inv.getSlot(inv.getSelectedHotbarSlotIndex() + 36).getItemId().includes("minecraft:fishing_rod"))
                return;
            Chat.toast("Long time without game detected", "Resending canne");
            // resend the canne
            KeyBind.keyBind("key.use", true);
            KeyBind.keyBind("key.use", false);
        }
    }));
    // Chat.log("");
    // Chat.log(emojify(""));
    // Chat.log(parse_state(""));
    event.stopListener = JavaWrapper.methodToJava(() => {
        JsMacros.off(action_listener);
        JsMacros.off(tick_listener);
        stats_hud.unregister();
    });
}

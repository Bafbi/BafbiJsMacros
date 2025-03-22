{
    // services start with minecraft, when enabled and are meant to be persistent scripts.
    JsMacros.assertEvent(event, "Service");
    // @ts-ignore
    function isGrimoire(item) {
        return (item.getItemId() === "minecraft:raw_iron" &&
            item.getNBT().asCompoundHelper().get(`ClueScrolls.clues.0.clueType`) !==
                null);
    }
    // @ts-ignore
    function parseGrimoire(item) {
        const helper = item.getNBT().asCompoundHelper();
        const uuid = helper.get("ClueScrolls.uuid")?.asString?.() ?? "";
        const tier = helper.get("ClueScrolls.tier")?.asString?.() ?? "";
        const tasks = [];
        for (let i = 0; i < 5; i++) {
            const cluePath = `ClueScrolls.clues.${i}.clueType`;
            const clueTypeRaw = helper.get(cluePath);
            if (clueTypeRaw === null || typeof clueTypeRaw?.asString !== "function")
                break;
            const taskType = clueTypeRaw.asString();
            let taskMaterialRaw;
            switch (taskType) {
                case "kill":
                    taskMaterialRaw = helper.get(`ClueScrolls.clues.${i}.data.entitytype`);
                    break;
                default:
                    taskMaterialRaw = helper.get(`ClueScrolls.clues.${i}.data.material`);
                    break;
            }
            let taskMaterial = taskMaterialRaw?.asString?.() ?? "";
            taskMaterial = taskMaterial.replace('["', "").replace('"]', "");
            const amount = helper
                .get(`ClueScrolls.clues.${i}.amount`)
                ?.asNumberHelper?.()
                ?.asDouble?.() ?? 0;
            const completed = helper
                .get(`ClueScrolls.clues.${i}.completed`)
                ?.asNumberHelper?.()
                ?.asDouble?.() ?? 0;
            tasks.push({
                type: taskType,
                material: taskMaterial,
                amount,
                completed,
            });
        }
        return {
            uuid,
            tier,
            tasks,
        };
    }
    // @ts-ignore
    function fetchGrimoires(inventory, mapIds) {
        const grimoiresData = [];
        mapIds.forEach((mapId) => {
            inventory.getMap()[mapId]?.forEach((s) => {
                // Chat.log("Slot: " + s);
                const item = inventory.getSlot(s);
                if (!isGrimoire(item))
                    return;
                const grimoire = parseGrimoire(item);
                // Chat.log("Grimoire: " + grimoire.uuid);
                grimoiresData.push({ grimoire, slot: s });
            });
        });
        return grimoiresData;
    }
    let lastTickGrimoiresInventory = [];
    let lastRemovedGrimoire = null;
    const tickListener = JsMacros.on("Tick", JavaWrapper.methodToJava(() => {
        const inventory = Player.openInventory();
        const thisTickGrimoiresInventory = fetchGrimoires(inventory, [
            "main",
            "hotbar",
        ]);
        const diffGrimoire = lastTickGrimoiresInventory.find((g) => !thisTickGrimoiresInventory
            .map((g) => g.grimoire.uuid)
            .includes(g.grimoire.uuid))?.grimoire;
        if (diffGrimoire) {
            lastRemovedGrimoire = diffGrimoire;
        }
        // Chat.log(
        //   `Removed grimoire: ${lastRemovedGrimoire?.uuid}, ${lastRemovedGrimoire?.tier}`,
        // );
        lastTickGrimoiresInventory = thisTickGrimoiresInventory;
    }));
    function isReward(item) {
        return (item.getItemId() === "minecraft:book" &&
            item.getNBT().asCompoundHelper().get("ClueScrolls.commandReward") !== null);
    }
    function parseReward(item, tier) {
        const command = item
            .getNBT()
            .asCompoundHelper()
            .get("ClueScrolls.commandReward")
            .asString();
        return { command: command, tier };
    }
    function fetchRewards(inventory, tier) {
        const rewards = [];
        inventory.getMap()["container"]?.forEach((s) => {
            const item = inventory.getSlot(s);
            if (!isReward(item))
                return;
            const reward = parseReward(item, tier);
            rewards.push(reward);
        });
        return rewards;
    }
    const version = 1;
    const Tier = ["common", "rare", "epic", "legendary"];
    const stats = loadStats();
    const statsD2D = Hud.createDraw2D();
    const openContainerListener = JsMacros.on("OpenContainer", JavaWrapper.methodToJava((event) => {
        JsMacros.waitForEvent("ContainerUpdate");
        const inventory = event.inventory;
        const screen = event.screen;
        if (!inventory.getContainerTitle().includes("Rewards"))
            return;
        // Chat.log("Rewards container opened");
        if (!lastRemovedGrimoire || !lastRemovedGrimoire.tier)
            return;
        Chat.log("Grimoire tier: " + lastRemovedGrimoire.tier);
        const rewards = fetchRewards(inventory, lastRemovedGrimoire.tier);
        stats.totalCompleted[lastRemovedGrimoire.tier] =
            stats.totalCompleted[lastRemovedGrimoire.tier] + 1 || 1;
        rewards.forEach((reward) => {
            if (stats.rewards.find((r) => r.reward.command === reward.command &&
                r.reward.tier === reward.tier)) {
                stats.rewards.find((r) => r.reward.command === reward.command &&
                    r.reward.tier === reward.tier).proc++;
            }
            else
                stats.rewards.push({ reward: reward, proc: 1 });
        });
        renderStats();
        saveStats(stats);
        Time.sleep(100);
        inventory.close();
    }));
    statsD2D.register();
    renderStats();
    function renderStats() {
        statsD2D.getElements().forEach(JavaWrapper.methodToJava((element) => {
            statsD2D.removeElement(element);
        }));
        statsD2D.addText(`Total completed: ${JSON.stringify(stats.totalCompleted)}`, 0, 0, 0xffffff, false);
        // stats.rewards.forEach((r, i) => {
        //   statsD2D.addText(
        //     `${r.reward.command} (${r.reward.tier}): ${r.proc}`,
        //     0,
        //     10 * (i + 1),
        //     0xffffff,
        //     false,
        //   );
        // });
    }
    // this fires when the service is stopped
    event.stopListener = JavaWrapper.methodToJava(() => {
        JsMacros.off(tickListener);
        statsD2D.unregister();
        JsMacros.off(openContainerListener);
        // save stats to file
        saveStats(stats);
    });
    function saveStats(stats) {
        if (!FS.exists("stats.json")) {
            FS.createFile("", "stats.json");
        }
        const file = FS.open("stats.json");
        file.write(JSON.stringify(stats));
    }
    function loadStats() {
        if (!FS.exists("stats.json")) {
            return {
                version: version,
                totalCompleted: { common: 0, rare: 0, epic: 0, legendary: 0 },
                rewards: [],
            };
        }
        const file = FS.open("stats.json");
        const stats = JSON.parse(file.read());
        if (stats.version === undefined || stats.version !== version) {
            Chat.log("Old stats file detected, resetting stats");
            return {
                version: version,
                totalCompleted: { common: 0, rare: 0, epic: 0, legendary: 0 },
                rewards: [],
            };
        }
        return stats;
    }
}

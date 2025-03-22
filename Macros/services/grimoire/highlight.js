{
    // services start with minecraft, when enabled and are meant to be persistent scripts.
    JsMacros.assertEvent(event, "Service");
    const ItemStackHelperType = Java.type("xyz.wagyourtail.jsmacros.client.api.helpers.inventory.ItemStackHelper");
    //   @ts-ignore
    function isGrimoire(item) {
        return (item.getItemId() === "minecraft:raw_iron" &&
            item.getNBT().asCompoundHelper().get(`ClueScrolls.clues.0.clueType`) !==
                null);
    }
    //  @ts-ignore
    function parseGrimoire(item) {
        const uuid = item
            .getNBT()
            .asCompoundHelper()
            .get("ClueScrolls.uuid")
            .asString();
        const tasks = [];
        for (let i = 0; i < 5; i++) {
            if (item
                .getNBT()
                .asCompoundHelper()
                .get(`ClueScrolls.clues.${i}.clueType`) === null)
                break;
            const taskType = item
                .getNBT()
                .asCompoundHelper()
                .get(`ClueScrolls.clues.${i}.clueType`)
                .asString();
            let taskMaterial;
            switch (taskType) {
                case "kill":
                    taskMaterial = item
                        .getNBT()
                        .asCompoundHelper()
                        .get(`ClueScrolls.clues.${i}.data.entitytype`)
                        .asString();
                    break;
                default:
                    taskMaterial = item
                        .getNBT()
                        .asCompoundHelper()
                        .get(`ClueScrolls.clues.${i}.data.material`)
                        .asString();
                    break;
            }
            taskMaterial = taskMaterial.replace('["', "").replace('"]', "");
            const taskAmount = item
                .getNBT()
                .asCompoundHelper()
                .get(`ClueScrolls.clues.${i}.amount`)
                .asNumberHelper()
                .asDouble();
            const taskCompleted = item
                .getNBT()
                .asCompoundHelper()
                .get(`ClueScrolls.clues.${i}.completed`)
                .asNumberHelper()
                .asDouble();
            tasks.push({
                type: taskType,
                material: taskMaterial,
                amount: taskAmount,
                completed: taskCompleted,
            });
        }
        return {
            uuid: uuid,
            tasks: tasks,
        };
    }
    function renderGrimoires(draw, grimoires) {
        draw
            .getElements()
            .forEach(JavaWrapper.methodToJava((t) => draw.removeElement(t)));
        draw.addText(`Grimoires: ${grimoires.length}`, 10, 10, 0xffffff, false);
        let offset = 0;
        grimoires.forEach((g, i) => {
            draw.addText(`Grimoire ${g.slot}: ${g.grimoire.uuid}`, 10, 10 + 10 * (i + 1) + offset, 0xffffff, false);
            g.grimoire.tasks.forEach((t, j) => {
                draw.addText(`Task ${j + 1}: ${t.type} ${t.material} ${t.completed}/${t.amount} ${t.completed === t.amount ? "✓" : ""}`, 10, 10 + 10 * (i + 1) + 10 * (j + 1) + offset, 0xffffff, false);
            });
            // draw yellow rect on the slot (rows are 9 slots long)
            const slotPos = [
                Math.floor(g.slot % 9.0),
                Math.floor(g.slot / 9.0),
            ];
            // Chat.log(`Slot: ${g.slot} Pos: ${slotPos}`);
            const invOffset = [394, 162];
            const betweenSlots = 2;
            const slotSize = 16;
            draw.addRect(invOffset[0] + slotPos[0] * (slotSize + betweenSlots), invOffset[1] + slotPos[1] * (slotSize + betweenSlots), invOffset[0] + slotPos[0] * (slotSize + betweenSlots) + slotSize, invOffset[1] + slotPos[1] * (slotSize + betweenSlots) + slotSize, 0xffff00, 100);
            offset += 10 * (g.grimoire.tasks.length + 1);
        });
    }
    function renderMaterial(draw, grimoires) {
        draw
            .getElements()
            .forEach(JavaWrapper.methodToJava((t) => draw.removeElement(t)));
        grimoires.forEach((g, i) => {
            // draw yellow rect on the slot (rows are 9 slots long)
            const slotPos = [
                Math.floor(g.slot % 9.0),
                Math.floor(g.slot / 9.0),
            ];
            Chat.log(`Slot: ${g.slot} Pos: ${slotPos}`);
            // const invOffset = [394, 162];
            const invOffset = [50, 0];
            // const invOffset = [10, 10];
            const betweenSlots = 2;
            const slotSize = 16;
            let itemOffset = 0;
            g.grimoire.tasks.forEach((t, j) => {
                let item = new ItemStackHelperType(`minecraft:${t.material}`, 1);
                if (item === null)
                    item = new ItemStackHelperType("minecraft:barrier", 1);
                // Chat.log(`Item: ${item}`);
                draw.addItem(invOffset[0] + slotPos[0] * (slotSize + betweenSlots), invOffset[1] + slotPos[1] * (slotSize + betweenSlots) + itemOffset, 100000, item, false, 0.5, 0);
                itemOffset += 1;
            });
        });
    }
    //  @ts-ignore
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
                grimoiresData.push({ grimoire: grimoire, slot: s });
            });
        });
        return grimoiresData;
    }
    function filterGrimoires(grimoires, filter) {
        const filters = filter.split(" ");
        /*
        Filters:
          - type:taskType (t:taskType) (#taskType) [only tasks with this type]
          - material:materialType (m:materialType) (@materialType) [only tasks with this material]
          - |materialType (,materialType) [only tasks with this material (exact match)]
          - ~ [only the next task of each grimoire]
          - ! [only one grimoire for each material]
        */
        const typeFilters = filters
            .filter((f) => f.startsWith("type:") || f.startsWith("t:") || f.startsWith("#"))
            .map((f) => f.split(":")[1] || f.split("#")[1]);
        const antiTypeFilters = filters
            .filter((f) => f.startsWith("!type:") || f.startsWith("!t:") || f.startsWith("!#"))
            .map((f) => f.split(":")[1] || f.split("#")[1]);
        const materialFilters = filters
            .filter((f) => f.startsWith("material:") || f.startsWith("m:") || f.startsWith("@"))
            .map((f) => f.split(":")[1] || f.split("@")[1]);
        const antiMaterialFilters = filters
            .filter((f) => f.startsWith("!material:") ||
            f.startsWith("!m:") ||
            f.startsWith("!@"))
            .map((f) => f.split(":")[1] || f.split("@")[1]);
        const exactMaterialFilters = filters
            .filter((f) => f.startsWith("|"))
            .map((f) => f.split("|")[1]);
        const nextTaskFilters = filters.includes("~");
        const onePerMaterial = filters.includes("!");
        // Chat.log("Type filters: " + typeFilters);
        // Chat.log("Material filters: " + materialFilters);
        // Chat.log(
        //   `Filters: ${filters} | ${typeFilters} | ${antiTypeFilters} | ${materialFilters} | ${antiMaterialFilters} | ${nextTaskFilters}`,
        // );
        const findedMaterials = [];
        const filteredGrimoires = grimoires.filter((g) => {
            if (typeFilters.length > 0) {
                const taskTypes = g.grimoire.tasks.map((t) => t.type);
                let typeMatch = false;
                typeFilters.forEach((f) => {
                    if (nextTaskFilters) {
                        const nextTask = g.grimoire.tasks.filter((t) => t.amount !== t.completed)[0];
                        if (nextTask.type.includes(f) && !antiTypeFilters.includes(f))
                            typeMatch = true;
                    }
                    else {
                        taskTypes.forEach((t) => {
                            if (typeMatch === true)
                                return;
                            // Chat.log(`Checking: ${t} against ${f} : ${t.includes(f)}`);
                            if (t.includes(f) && !antiTypeFilters.includes(f))
                                typeMatch = true;
                        });
                    }
                });
                if (!typeMatch)
                    return false;
            }
            if (materialFilters.length > 0) {
                const taskMaterials = g.grimoire.tasks.map((t) => t.material);
                let materialMatch = false;
                materialFilters.forEach((f) => {
                    if (nextTaskFilters) {
                        const nextTask = g.grimoire.tasks.filter((t) => t.amount !== t.completed)[0];
                        if (nextTask.material.includes(f) &&
                            !antiMaterialFilters.includes(f)) {
                            materialMatch = true;
                        }
                    }
                    else {
                        taskMaterials.forEach((t) => {
                            if (materialMatch === true)
                                return;
                            // Chat.log("Checking: " + t + " against " + f);
                            if (t.includes(f) && !antiMaterialFilters.includes(f))
                                materialMatch = true;
                        });
                    }
                });
                if (!materialMatch)
                    return false;
            }
            if (exactMaterialFilters.length > 0) {
                const taskMaterials = g.grimoire.tasks.map((t) => t.material);
                let exactMaterialMatch = false;
                exactMaterialFilters.forEach((f) => {
                    if (nextTaskFilters) {
                        const nextTask = g.grimoire.tasks.filter((t) => t.amount !== t.completed)[0];
                        if (nextTask.material === f) {
                            if (onePerMaterial && findedMaterials.includes(nextTask.material))
                                return;
                            exactMaterialMatch = true;
                            findedMaterials.push(nextTask.material);
                        }
                    }
                    else {
                        taskMaterials.forEach((t) => {
                            if (exactMaterialMatch === true)
                                return;
                            if (t === f)
                                exactMaterialMatch = true;
                        });
                    }
                });
                if (!exactMaterialMatch)
                    return false;
            }
            return true;
        });
        return filteredGrimoires;
    }
    const toggleMaps = [["container"], ["main", "hotbar"]];
    const predefinedFilters = {
        next: "~",
        passif: "~ #kill |pig |sheep |cow |chicken",
        spawner: "~ #kill |pig |sheep |cow |chicken |zombie |skeleton |enderman |blaze |wolf |witch |stray |zombified_piglin |creeper |mushroom_cow |ocelot",
        spawnerOne: " ! ~ #kill |pig |sheep |cow |chicken |zombie |skeleton |enderman |blaze |wolf |witch |stray |zombified_piglin |creeper |mushroom_cow |ocelot",
        nonospawner: "~ #kill |phantom |iron_golem |spider |squid",
        mine: "~ #break |stone |coal_ore |iron_ore |gold_ore |diamond_ore |emerald_ore |redstone_ore |lapis_ore |nether_gold_ore |nether_quartz_ore |ancient_debris",
        farm: "~ #break @wheat @carrot @potato @beetroot @melon @pumpkin @cane",
        craft: "#craft",
        leather: "~ #craft @leather",
        wood: "~ #craft @wooden",
    };
    const openContainerListener = JsMacros.on("OpenContainer", JavaWrapper.methodToJava((event) => {
        JsMacros.waitForEvent("ContainerUpdate");
        // Chat.log("Container opened");
        const inventory = event.inventory;
        const screen = event.screen;
        if (inventory === null || screen === null)
            return;
        // Chat.log("Inventory: " + inventory.getMap());
        let toggleIndex = 0;
        let grimoiresData = fetchGrimoires(inventory, toggleMaps[toggleIndex]);
        let filteredGrimoires = grimoiresData;
        // screen.addRect(10, 10, 100, 100, 0xf7f700, 100);
        //
        const grimoiresD2D = Hud.createDraw2D();
        screen.addDraw2D(grimoiresD2D, 0, 0, 100, screen.getHeight());
        const materialD2D = Hud.createDraw2D();
        screen.addDraw2D(materialD2D, 394, 162, 100, 100);
        screen.setOnKeyPressed(JavaWrapper.methodToJava((key) => {
            // Chat.log("Key: " + key);
            if (key === 32) {
                filterInput.setText(GlobalVars.getString("grimoireFilters"));
            }
            if (key === 67) {
                // copy filters from item under cursor
                const item = inventory.getSlot(inventory.getSlotUnderMouse());
                if (isGrimoire(item)) {
                    const grimoire = parseGrimoire(item);
                    const nextMaterial = grimoire.tasks.filter((t) => t.amount !== t.completed)[0].material;
                    const filterString = `~ |${nextMaterial}`;
                    filterInput.setText(filterString);
                }
            }
            if (key === 86) {
                // copy filters from item under cursor
                const item = inventory.getSlot(inventory.getSlotUnderMouse());
                if (isGrimoire(item)) {
                    const grimoire = parseGrimoire(item);
                    const nextMaterial = grimoire.tasks.filter((t) => t.amount !== t.completed)[0].material;
                    const filterString = `~ |${nextMaterial}`;
                    filterInput.setText(filterString);
                    toggleIndex = (toggleIndex += 1) % toggleMaps.length;
                    // Chat.log("Toggle: " + toggleIndex);
                    reloadGrimoires();
                    toggleInventoryButton.setLabel(`Toggle ${toggleMaps[(toggleIndex + 1) % toggleMaps.length]}`);
                    filteredGrimoires.forEach((g) => {
                        inventory.quick(g.slot);
                    });
                    reloadGrimoires();
                }
            }
            if (key === 70) {
                // last filter + quick
                const filterString = GlobalVars.getString("grimoireFilters");
                filterInput.setText(filterString);
                reloadGrimoires();
                filteredGrimoires.forEach((g) => {
                    inventory.quick(g.slot);
                });
                reloadGrimoires();
            }
        }));
        const filterInput = screen.addTextInput(screen.getWidth() - 220, 10, 200, 20, "Filter", JavaWrapper.methodToJava((text) => {
            GlobalVars.putString("grimoireFilters", text);
            filteredGrimoires = filterGrimoires(grimoiresData, text);
            renderGrimoires(grimoiresD2D, filteredGrimoires);
        }));
        filterInput.setMaxLength(200);
        const takeAllButton = screen.addButton(screen.getWidth() - 100, 40, 90, 20, "Quick filtered", JavaWrapper.methodToJava(() => {
            filteredGrimoires.forEach((g) => {
                inventory.quick(g.slot);
            });
            reloadGrimoires();
        }));
        const toggleInventoryButton = screen.addButton(screen.getWidth() - 100, 70, 90, 20, "Toggle main", JavaWrapper.methodToJava((b) => {
            toggleIndex = (toggleIndex += 1) % toggleMaps.length;
            // Chat.log("Toggle: " + toggleIndex);
            reloadGrimoires();
            b.setLabel(`Toggle ${toggleMaps[(toggleIndex + 1) % toggleMaps.length]}`);
        }));
        screen.addButton(screen.getWidth() - 100, 100, 90, 20, "Last filters", JavaWrapper.methodToJava(() => {
            filterInput.setText(GlobalVars.getString("grimoireFilters"));
            reloadGrimoires();
        }));
        // screen.addCheckbox(x, y, width, height, text, checked, showMessage, callback)
        let i = 0;
        Object.keys(predefinedFilters).forEach((k) => {
            const f = predefinedFilters[k];
            screen.addCheckbox(screen.getWidth() - 100, 130 + i * 30, 90, 20, k, false, true, JavaWrapper.methodToJava((c) => {
                const checked = c.isChecked();
                if (checked)
                    filterInput.setText(filterInput.getText() + " " + predefinedFilters[k]);
                else
                    filterInput.setText(filterInput.getText().replace(predefinedFilters[k], ""));
                reloadGrimoires();
            }));
            i++;
        });
        function reloadGrimoires() {
            grimoiresData = fetchGrimoires(inventory, toggleMaps[toggleIndex]);
            filteredGrimoires = filterGrimoires(grimoiresData, filterInput.getText());
            // renderMaterial(materialD2D, grimoiresData);
            renderGrimoires(grimoiresD2D, filteredGrimoires);
        }
        // Chat.log("Filter: " + GlobalVars.getString("grimoireFilters" ?? ""));
        // filterInput.addTooltip("aa");
        // filterInput.setSuggestion("aa");
        // filterInput.setText(GlobalVars.getString("grimoireFilters" ?? ""), true);
        //
        //
        // Client.waitTick(5);
        // filterInput.setText("aa");
        reloadGrimoires();
    }));
    // this fires when the service is stopped
    event.stopListener = JavaWrapper.methodToJava(() => {
        JsMacros.off(openContainerListener);
    });
}

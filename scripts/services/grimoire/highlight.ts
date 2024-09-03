{
  // services start with minecraft, when enabled and are meant to be persistent scripts.
  JsMacros.assertEvent(event, "Service");

  const ItemStackHelperType = Java.type(
    "xyz.wagyourtail.jsmacros.client.api.helpers.inventory.ItemStackHelper",
  );

  interface Grimoire {
    uuid: string;
    tasks: {
      type: string;
      material: string;
      amount: number;
      completed: number;
    }[];
  }

  function isGrimoire(item: ItemStackHelper): boolean {
    return (
      item.getItemId() === "minecraft:raw_iron" &&
      item.getNBT().asCompoundHelper().get("ClueScrolls.uuid") !== null
    );
  }

  function parseGrimoire(item: ItemStackHelper): Grimoire {
    const uuid = item
      .getNBT()
      .asCompoundHelper()
      .get("ClueScrolls.uuid")
      .asString();
    const tasks = [];
    for (let i = 0; i < 5; i++) {
      if (
        item
          .getNBT()
          .asCompoundHelper()
          .get(`ClueScrolls.clues.${i}.clueType`) === null
      )
        break;
      const taskType: string = item
        .getNBT()
        .asCompoundHelper()
        .get(`ClueScrolls.clues.${i}.clueType`)
        .asString();
      let taskMaterial: string;
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

      const taskAmount: number = item
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

  function renderGrimoires(
    draw: IDraw2D,
    grimoires: { grimoire: Grimoire; slot: number }[],
  ) {
    draw
      .getElements()
      .forEach(JavaWrapper.methodToJava((t) => draw.removeElement(t)));
    draw.addText(`Grimoires: ${grimoires.length}`, 10, 10, 0xffffff, false);
    let offset = 0;
    grimoires.forEach((g, i) => {
      draw.addText(
        `Grimoire ${g.slot}: ${g.grimoire.uuid}`,
        10,
        10 + 10 * (i + 1) + offset,
        0xffffff,
        false,
      );
      g.grimoire.tasks.forEach((t, j) => {
        draw.addText(
          `Task ${j + 1}: ${t.type} ${t.material} ${t.completed}/${t.amount} ${t.completed === t.amount ? "✓" : ""}`,
          10,
          10 + 10 * (i + 1) + 10 * (j + 1) + offset,
          0xffffff,
          false,
        );
      });
      // draw yellow rect on the slot (rows are 9 slots long)
      const slotPos: [number, number] = [
        Math.floor(g.slot % 9.0),
        Math.floor(g.slot / 9.0),
      ];
      // Chat.log(`Slot: ${g.slot} Pos: ${slotPos}`);
      const invOffset = [394, 162];
      const betweenSlots = 2;
      const slotSize = 16;
      draw.addRect(
        invOffset[0] + slotPos[0] * (slotSize + betweenSlots),
        invOffset[1] + slotPos[1] * (slotSize + betweenSlots),
        invOffset[0] + slotPos[0] * (slotSize + betweenSlots) + slotSize,
        invOffset[1] + slotPos[1] * (slotSize + betweenSlots) + slotSize,
        0xffff00,
        100,
      );
      offset += 10 * (g.grimoire.tasks.length + 1);
    });
  }

  function renderMaterial(
    draw: IDraw2D,
    grimoires: { grimoire: Grimoire; slot: number }[],
  ) {
    draw
      .getElements()
      .forEach(JavaWrapper.methodToJava((t) => draw.removeElement(t)));
    grimoires.forEach((g, i) => {
      // draw yellow rect on the slot (rows are 9 slots long)
      const slotPos: [number, number] = [
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
        let item: ItemStackHelper = new ItemStackHelperType(
          `minecraft:${t.material}`,
          1,
        );
        if (item === null)
          item = new ItemStackHelperType("minecraft:barrier", 1);
        // Chat.log(`Item: ${item}`);
        draw.addItem(
          invOffset[0] + slotPos[0] * (slotSize + betweenSlots),
          invOffset[1] + slotPos[1] * (slotSize + betweenSlots) + itemOffset,
          100000,
          item,
          false,
          0.5,
          0,
        );
        itemOffset += 1;
      });
    });
  }

  function fetchGrimoires(
    inventory: Inventory,
    mapIds: string[],
  ): { grimoire: Grimoire; slot: number }[] {
    const grimoiresData: { grimoire: Grimoire; slot: number }[] = [];

    mapIds.forEach((mapId) => {
      inventory.getMap()[mapId]?.forEach((s) => {
        // Chat.log("Slot: " + s);
        const item = inventory.getSlot(s);
        if (!isGrimoire(item)) return;
        const grimoire = parseGrimoire(item);
        // Chat.log("Grimoire: " + grimoire.uuid);
        grimoiresData.push({ grimoire: grimoire, slot: s });
      });
    });

    return grimoiresData;
  }

  function filterGrimoires(
    grimoires: { grimoire: Grimoire; slot: number }[],
    filter: string,
  ): { grimoire: Grimoire; slot: number }[] {
    const filters = filter.split(" ");
    const typeFilters = filters
      .filter(
        (f) => f.startsWith("type:") || f.startsWith("t:") || f.startsWith("#"),
      )
      .map((f) => f.split(":")[1] || f.split("#")[1]);
    const materialFilters = filters
      .filter(
        (f) =>
          f.startsWith("material:") || f.startsWith("m:") || f.startsWith("@"),
      )
      .map((f) => f.split(":")[1] || f.split("@")[1]);

    // Chat.log("Type filters: " + typeFilters);
    // Chat.log("Material filters: " + materialFilters);

    const filteredGrimoires = grimoires.filter((g) => {
      if (typeFilters.length > 0) {
        const taskTypes = g.grimoire.tasks.map((t) => t.type);
        let typeMatch = false;
        typeFilters.forEach((f) => {
          taskTypes.forEach((t) => {
            if (typeMatch === true) return;
            // Chat.log(`Checking: ${t} against ${f} : ${t.includes(f)}`);
            typeMatch = t.includes(f);
          });
        });
        if (!typeMatch) return false;
      }
      if (materialFilters.length > 0) {
        const taskMaterials = g.grimoire.tasks.map((t) => t.material);
        let materialMatch = false;
        materialFilters.forEach((f) => {
          taskMaterials.forEach((t) => {
            if (materialMatch === true) return;
            // Chat.log("Checking: " + t + " against " + f);
            materialMatch = t.includes(f);
          });
        });
        if (!materialMatch) return false;
      }
      return true;
    });
    return filteredGrimoires;
  }

  const openContainerListener = JsMacros.on(
    "OpenContainer",
    JavaWrapper.methodToJava((event) => {
      JsMacros.waitForEvent("ContainerUpdate");
      // Chat.log("Container opened");
      const inventory = event.inventory;
      const screen = event.screen;

      // Chat.log("Inventory: " + inventory.getMap());
      const toggleMaps = [["container"], ["main", "hotbar"]];
      let toggleIndex = 0;

      let grimoiresData: { grimoire: Grimoire; slot: number }[] =
        fetchGrimoires(inventory, toggleMaps[toggleIndex]);
      let filteredGrimoires = grimoiresData;

      // screen.addRect(10, 10, 100, 100, 0xf7f700, 100);
      //
      const grimoiresD2D = Hud.createDraw2D();
      screen.addDraw2D(grimoiresD2D, 0, 0, 100, screen.getHeight());

      const materialD2D = Hud.createDraw2D();
      screen.addDraw2D(materialD2D, 394, 162, 100, 100);

      // screen.setOnKeyPressed(
      //   JavaWrapper.methodToJava((key) => {
      //     Chat.log("Key: " + key);
      //     if (key === 69) return;
      //   }),
      // );
      //

      const filterInput = screen.addTextInput(
        screen.getWidth() - 100,
        10,
        90,
        20,
        "aa",
        JavaWrapper.methodToJava((text) => {
          GlobalVars.putString("grimoireFilters", text);

          filteredGrimoires = filterGrimoires(grimoiresData, text);

          renderGrimoires(grimoiresD2D, filteredGrimoires);
        }),
      );

      const takeAllButton = screen.addButton(
        screen.getWidth() - 100,
        40,
        90,
        20,
        "Quick filtered",
        JavaWrapper.methodToJava(() => {
          filteredGrimoires.forEach((g) => {
            inventory.quick(g.slot);
          });
          reloadGrimoires();
        }),
      );

      const toggleInventoryButton = screen.addButton(
        screen.getWidth() - 100,
        70,
        90,
        20,
        "Toggle main",
        JavaWrapper.methodToJava((b) => {
          toggleIndex = (toggleIndex += 1) % toggleMaps.length;
          // Chat.log("Toggle: " + toggleIndex);
          reloadGrimoires();
          b.setLabel(
            `Toggle ${toggleMaps[(toggleIndex + 1) % toggleMaps.length]}`,
          );
        }),
      );

      function reloadGrimoires() {
        grimoiresData = fetchGrimoires(inventory, toggleMaps[toggleIndex]);
        filteredGrimoires = filterGrimoires(
          grimoiresData,
          filterInput.getText(),
        );
        // renderMaterial(materialD2D, grimoiresData);
        renderGrimoires(grimoiresD2D, filteredGrimoires);
      }

      // Chat.log("Filter: " + GlobalVars.getString("grimoireFilters" ?? ""));
      // filterInput.addTooltip("aa");
      // filterInput.setSuggestion("aa");
      // filterInput.setText(GlobalVars.getString("grimoireFilters" ?? ""), true);
      //
      //
      reloadGrimoires();
    }),
  );
  // this fires when the service is stopped
  (event as Events.Service).stopListener = JavaWrapper.methodToJava(() => {
    JsMacros.off(openContainerListener);
  });
}

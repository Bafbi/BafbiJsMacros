{
  let afk_pos: BlockPosHelper | null = null;
  let afk_view: [number, number] | null = null;

  const tick_listener = JsMacros.on(
    "Tick",
    JavaWrapper.methodToJava((event) => {
      if (afk_pos === null || afk_view === null) return;
      const player = Player.getPlayer();
      const pos = player.getBlockPos();
      const view = [player.getYaw(), player.getPitch()] as [number, number];
      if (!pos.equals(afk_pos) || isViewChanged(view, afk_view)) {
        Chat.log("moved");
        afk_pos = null;
        Chat.log("stop attacking");
      } else {
        Player.interactions().attack();
      }
    }),
  );

  const automine_command = Chat.getCommandManager()
    .createCommandBuilder("attack")
    .executes(
      JavaWrapper.methodToJava((context) => {
        afk_pos = Player.getPlayer().getBlockPos();
        afk_view = [
          Player.getPlayer().getYaw(),
          Player.getPlayer().getPitch(),
        ] as [number, number];
      }),
    );

  automine_command.register();

  // this fires when the service is stopped
  (event as Events.Service).stopListener = JavaWrapper.methodToJava(() => {
    JsMacros.off(tick_listener);
    automine_command.unregister();
  });
}

export function isViewChanged(
  view: [number, number],
  other: [number, number],
): boolean {
  // within 5 degrees
  return Math.abs(view[0] - other[0]) > 20 || Math.abs(view[1] - other[1]) > 20;
}

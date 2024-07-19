// Get connnected players
const players = World.getPlayers();
// Chat.log(players[0]);
const testedPlayers =
  (GlobalVars.getObject("testedPlayers") as PlayerListEntryHelper[]) ?? [];
const bots = (GlobalVars.getObject("bots") as PlayerListEntryHelper[]) ?? [];

while (!testPlayer(players[Math.floor(Math.random() * players.length)]));

function testPlayer(player: PlayerListEntryHelper) {
  if (testedPlayers.find((p) => p.getName() === player.getName())) {
    return false;
  }
  Chat.log(`Testing player ${player.getName()}...`);
  Chat.say(`/ob info ${player.getName()}`);
  const listener = JsMacros.on(
    "RecvMessage",
    JavaWrapper.methodToJava((event) => {
      if (event.text.toString().includes("=====")) {
        Chat.log("Player is in a team");
      } else if (event.text.toString().includes("Empire")) {
        Chat.log("Player is not in a team");
        bots.push(player);
      } else return;

      testedPlayers.push(player);
      GlobalVars.putObject("testedPlayers", testedPlayers);
      GlobalVars.putObject("bots", bots);

      Chat.log(`${testedPlayers.length} players have been tested`);
      Chat.log(`${bots.length} bots have been found`);

      JsMacros.off(listener);
      Chat.log(`Finish testing player ${player.getName()}`);
    }),
  );
  return true;
}

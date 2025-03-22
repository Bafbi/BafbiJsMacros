function press(key) {
  KeyBind.key(key, true);
  KeyBind.key(key, false);
}

function random(min, max) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

if (event.sound == "minecraft:entity.fishing_bobber.splash") {
  Client.waitTick(random(2, 4));
  press("key.mouse.right");
  Client.waitTick(random(3, 6));
  press("key.mouse.right");
}

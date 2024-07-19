function press(key) {
    KeyBind.key(key, true)
    KeyBind.key(key, false)
}

if (event.sound == 'minecraft:entity.fishing_bobber.splash') {
    press('key.mouse.right')
    Client.waitTick(4)
    press('key.mouse.right')
}
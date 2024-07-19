function ticksToFormattedTime(ticks) {
    // Calculate total seconds
    let totalSeconds = Math.floor(ticks / 20);

    // Calculate hours, minutes, and seconds
    let hours = Math.floor(totalSeconds / 3600);
    let minutes = Math.floor((totalSeconds % 3600) / 60);
    let seconds = totalSeconds % 60;

    // Format hours, minutes, and seconds with leading zeros if needed
    let formattedHours = String(hours).padStart(2, '0');
    let formattedMinutes = String(minutes).padStart(2, '0');
    let formattedSeconds = String(seconds).padStart(2, '0');

    // Return formatted time string
    return `${formattedHours}:${formattedMinutes}:${formattedSeconds}`;
}

function exec() {
    Chat.say("/fish shop")

    JsMacros.once("OpenContainer", JavaWrapper.methodToJava((event, ctx) => { 
        ctx.releaseLock()
        // Chat.log(ctx)
        Time.sleep(200)
        event.inventory.click(32)
        Time.sleep(10)
        event.inventory.click(32)
        Time.sleep(10)
        event.inventory.close()
    }))
}


const d2d = Hud.createDraw2D();
const WAIT_TIME = 4000
let remaining_time = WAIT_TIME
let remaining_time_text
d2d.setOnInit(JavaWrapper.methodToJava(() => {
    remaining_time_text = d2d.addText(ticksToFormattedTime(remaining_time), d2d.getWidth() / 2 - 2, Math.floor(d2d.getHeight() / 2) + 8, 0xffffff, 0, true, 2, 0);
}));
const tickListener = JsMacros.on("Tick", JavaWrapper.methodToJava((event) => {
    remaining_time -= 1
    if (remaining_time < 0) {
        exec()
        remaining_time = WAIT_TIME
    }
    remaining_time_text?.setText(ticksToFormattedTime(remaining_time))
}));


d2d.register();
// this fires when the service is stopped
event.stopListener = JavaWrapper.methodToJava(() => {
    d2d.unregister();
    JsMacros.off(tickListener);
});
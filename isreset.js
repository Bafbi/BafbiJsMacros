Chat.say("/is delete")

JsMacros.once("OpenContainer", JavaWrapper.methodToJava((event, ctx) => { 
    ctx.releaseLock()
    // Chat.log(ctx)
    Time.sleep(200)
    event.inventory.click(12)
}))

Client.waitTick(40)
Chat.say("/is create zen jungle")
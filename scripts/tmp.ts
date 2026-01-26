/**
 * Utility script to clear all persistent HUD elements.
 * Best way to recover from messy/leaked HUDs.
 */

Hud.clearDraw2Ds();
Hud.clearDraw3Ds();

Chat.log("§c[Cleanup]§r All 2D and 3D custom HUD elements have been cleared.");

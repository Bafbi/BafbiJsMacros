# Agent Guidance - JsMacros Project

This document provides specialized instructions for AI agents working on this repository to ensure consistency, safety, and effective use of project-specific tools.

## 1. Project Architecture

The project is divided into two main areas:
- **`scripts/` (Source):** TypeScript source files. This is where all logic changes should be made.
- **`Macros/` (Runtime):** Compiled JavaScript files. These are the files executed by the JsMacros standalone runtime. 
- **`headers/` (API Docs):** TypeScript definition files for the JsMacros v2.0.0-dev API.

### Core Patterns
- **Services:** Found in `scripts/services/`. These use `JsMacros.assertEvent(event, "Service")` and are meant to be persistent.
- **Lifecycle Management:** Always implement `event.stopListener` in services to unregister listeners, clear HUDs, and release keys.
- **Utilities:** Shared logic (Logger, GUI helpers, math) resides in `scripts/utils/`.

## 2. API Knowledge & Information Retrieval

**CRITICAL:** The project uses **JsMacros v2.0.0-dev**. Standard documentation (web-based) might be outdated or slightly different.

- **Source of Truth:** The files in `headers/` are the absolute authority on available methods and classes.
- **Retrieval Strategy:**
    - Use the **`explore`** agent to search `headers/` for specific method definitions (e.g., `lookAt`, `getBlockPos`, `rayTraceBlock`).
    - Avoid `context7` unless searching for external libraries; the internal API is best documented in the local headers.
    - Example search: `explore search headers/ for ClientPlayerEntityHelper`

## 3. Tooling & Workflow

### Development Loop
1.  **Modify Source:** Edit files in `scripts/`.
2.  **Compile:** Use `npm run build` or `tsc` to update the `Macros/` directory.
3.  **Validate:** Check the compiled `.js` files in `Macros/` to ensure the `exports` polyfills or module resolutions are correct for the standalone environment.

### Code Style
- **TypeScript:** Use strict typing where possible.
- **Indentation:** 2 spaces.
- **Logging:** Use the custom `Logger` from `scripts/utils/debug.ts`. Avoid `Chat.log` directly in services; use `logger.trace`, `logger.debug`, etc.
- **HUDs:** Always use `draw2d` and `draw3d` and ensure they are cleaned up in `event.stopListener`.

## 4. Minecraft-Specific Constraints

- **Reused Objects:** Many JsMacros iterator methods (like `World.iterateSphere`) reuse the same helper object (cursor) for efficiency. **Always snapshot primitives** (x, y, z, id) when storing data in arrays to avoid reference corruption.
- **Interpolation:** For movement/aiming, prefer custom interpolation (Lerp) over instant snaps to maintain a natural "human-like" behavior.
- **Coordinate Systems:** 
    - Minecraft blocks are at integer coordinates. 
    - Centers of blocks are at `.5` offsets. 
    - Yaw/Pitch logic must handle the -180/180 degree wrap-around.

## 5. Agent Pro-Tips
- Before implementing a new feature, check `scripts/utils/` to see if a helper already exists.
- If a script is crashing with "ReferenceError: exports is not defined", ensure the TypeScript output is compatible with the standalone runtime (use `var exports = {}` polyfills if necessary).
- Use `scripts/tmp.ts` as a scratchpad for utility scripts (like clearing stuck HUDs).

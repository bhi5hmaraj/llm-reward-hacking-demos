# Postmortem: Colyseus Schema State Synchronization Failure

**Date**: January 20, 2025
**Severity**: Critical (P0)
**Duration**: ~2 hours debugging
**Status**: Resolved

## Executive Summary

Colyseus schema fields were not synchronizing from server to client. The client received only one field (`waitingPlayers`) while all other schema fields (`experimentName`, `requiredPlayers`, `isReady`, `experimenterConnected`) were missing. This caused the lobby UI to display incorrect information: "Experimenter: Not connected" and "0 / 0 joined" instead of "Connected" and "0 / 3 joined".

## Impact

- **User Experience**: Experimenter and players could not see accurate lobby state
- **Functionality**: Lobby appeared broken with missing player counts and connection status
- **Timeline**: Issue existed from initial implementation until fix was deployed

## Timeline

| Time | Event |
|------|-------|
| T+0m | Issue discovered: lobby showing "Not connected" and "0 / 0 joined" |
| T+30m | Initial hypothesis: tsx stripping decorators |
| T+45m | Changed dev script from `tsx watch` to `tsc --watch + nodemon` |
| T+60m | Confirmed decorators were properly compiled in dist/ files |
| T+90m | Web search revealed TypeScript `useDefineForClassFields` issue |
| T+105m | Added `"useDefineForClassFields": false` to tsconfig.json |
| T+110m | Verified fix: all schema fields now syncing correctly |

## Root Cause Analysis

### What Happened

When using TypeScript with `target: "ES2022"` or higher, the default value for `useDefineForClassFields` is `true`. This causes TypeScript to use modern JavaScript class field semantics where:

1. Class fields are initialized **after** the `super()` constructor returns
2. Fields are defined using `Object.defineProperty()` instead of simple assignment
3. This overwrites properties set up by Colyseus Schema's constructor

### Technical Details

**Before Fix** (tsconfig.json):
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
    // useDefineForClassFields defaults to true with ES2022
  }
}
```

**Compiled Output Behavior**:
```javascript
class LobbyState extends Schema {
  experimentId = '';  // This line executes AFTER super()
  experimentName = '';
  requiredPlayers = 0;
  // ...

  constructor(experimentId, experimentName, requiredPlayers) {
    super();  // Colyseus sets up property tracking here
    // BUT THEN class field initialization runs and overwrites everything!
    this.experimentId = experimentId;
    this.experimentName = experimentName;
    this.requiredPlayers = requiredPlayers;
  }
}
```

This caused Colyseus's schema system to lose track of these fields, preventing serialization.

### Why It Wasn't Obvious

1. **Decorators were working**: `@type()` decorators were properly emitted in compiled code
2. **Server-side state was correct**: Logs showed `requiredPlayers: 3` and `experimenterConnected: true`
3. **Only client-side was broken**: The issue was in serialization, not in state management
4. **One field worked**: `waitingPlayers` (an ArraySchema) somehow survived, masking the pattern

## Resolution

### The Fix

Added one line to `server/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": false,  // ← Added this
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  }
}
```

### Why This Works

Setting `useDefineForClassFields: false` tells TypeScript to use legacy behavior:
- Class fields are initialized as simple assignments in the constructor
- No `Object.defineProperty()` calls that could interfere with Colyseus
- Colyseus Schema's property tracking remains intact

## Verification

**Before Fix**:
- Client console: `{"waitingPlayers": 0}`
- UI: "Experimenter: Not connected", "0 / 0 joined"

**After Fix**:
- Client console: `{"waitingPlayers": [], "isReady": false, "experimentName": "Test useDefineForClassFields Fix", "experimenterConnected": true}`
- UI: "Experimenter: Connected", "0 / 3 joined" ✅

## Lessons Learned

### What Went Well

1. **Systematic debugging**: Checked decorators, compilation output, and package versions
2. **Web research**: Found GitHub issue #510 in colyseus/colyseus with exact problem
3. **Used proper tools**: Chrome DevTools MCP for debugging client state

### What Could Be Improved

1. **Earlier web search**: Should have searched for "colyseus schema not syncing" sooner
2. **Check TypeScript docs**: ES2022 target implications should have been reviewed
3. **Better initial diagnosis**: Server logs showed correct state, should have focused on serialization earlier

### Action Items

- [x] Document this issue in postmortem
- [ ] Add comment in tsconfig.json explaining why `useDefineForClassFields: false` is needed
- [ ] Add to project setup checklist: "When using Colyseus + TypeScript with ES2022+, set `useDefineForClassFields: false`"
- [ ] Consider adding a test that verifies schema serialization works correctly
- [ ] Share this with team/community to help others avoid this issue

## Prevention

### For This Project

1. **Add inline documentation**:
   ```json
   {
     "compilerOptions": {
       "useDefineForClassFields": false,  // Required for Colyseus Schema
       // See: docs/postmortems/2025-01-20-colyseus-schema-sync-issue.md
     }
   }
   ```

2. **Add validation test**:
   ```typescript
   // tests/schema.test.ts
   test('LobbyState serialization includes all fields', () => {
     const state = new LobbyState('id', 'Test', 3);
     const encoded = state.encode();
     const decoded = new LobbyState('', '', 0);
     decoded.decode(encoded);

     expect(decoded.experimentName).toBe('Test');
     expect(decoded.requiredPlayers).toBe(3);
   });
   ```

### For Future Projects

1. **When using Colyseus with TypeScript ES2022+**, always set `useDefineForClassFields: false`
2. **Add schema serialization tests** in CI pipeline
3. **Document class-based decorators** and their TypeScript compilation requirements
4. **Check official framework docs** for TypeScript configuration requirements

## References

- [Colyseus GitHub Issue #510](https://github.com/colyseus/colyseus/issues/510) - Server does not sync state with clients
- [TypeScript 3.7 Release Notes](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-7.html#the-usedefineforclassfields-flag-and-the-declare-property-modifier) - `useDefineForClassFields` flag
- [Colyseus Schema Documentation](https://docs.colyseus.io/state/schema/)

## Appendix

### Environment

- **Server**: Node.js, TypeScript 5.3.3, Colyseus 0.15.57, @colyseus/schema 2.0.37
- **Client**: React, TypeScript, colyseus.js 0.15.28
- **Build**: tsc with ES2022 target

### Key Files Modified

- `warden_dilemma/server/tsconfig.json` (added `useDefineForClassFields: false`)
- `warden_dilemma/server/package.json` (changed dev script from tsx to tsc+nodemon)

### Related Issues

This is a known TypeScript + decorator interaction issue that affects:
- Colyseus Schema
- TypeORM entities
- MobX observables
- Any library using decorators with class fields

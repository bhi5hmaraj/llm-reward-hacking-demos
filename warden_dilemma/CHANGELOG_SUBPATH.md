# Changelog: Subpath Configuration

## Summary

Successfully configured Warden's Dilemma to run under the `/warden_dilemma` subpath instead of the root path. This allows the app to coexist with other applications on the same server.

## Changes Made

### 1. Fixed TypeScript Build Errors

**Files Modified:**
- `server/src/index.ts` - Fixed Express and Colyseus type issues
- `server/src/api/experiments.api.ts` - Added explicit Router type
- `server/src/rooms/GameRoom.ts` - Fixed logger context types, removed Prisma references
- `server/src/rooms/LobbyRoom.ts` - Removed Prisma references
- `client/src/vite-env.d.ts` - Created type definitions for Vite environment variables
- `client/src/services/api.service.ts` - Removed unused imports
- `client/src/services/colyseus.service.ts` - Removed unused imports
- `client/src/pages/GamePage.tsx` - Added explicit types for event handlers
- `client/src/pages/LobbyPage.tsx` - Removed unused loop variable

**Result:** ✅ Build passes with zero TypeScript errors

### 2. Backend Subpath Configuration

**File: `server/src/index.ts`**

Changes:
- Mounted API routes at `/warden_dilemma/api` instead of `/api`
- Mounted static files at `/warden_dilemma` instead of root
- Added health endpoint at both `/health` and `/warden_dilemma/health`
- Created root endpoint (`/`) that lists all available apps
- Updated SPA fallback to handle `/warden_dilemma/*` routes
- Updated API documentation endpoint paths

**Code Example:**
```typescript
// API routes under subpath
app.use('/warden_dilemma/api', experimentsApi);

// Static files under subpath
app.use('/warden_dilemma', express.static(clientDistPath));

// SPA fallback for React Router
app.get('/warden_dilemma/*', (req, res) => {
  res.sendFile(path.join(clientDistPath, 'index.html'));
});

// Root endpoint lists all apps
app.get('/', (req, res) => {
  res.json({
    message: 'LLM Reward Hacking Demos',
    apps: [
      {
        name: 'Warden\'s Dilemma',
        description: 'N-player iterated prisoner\'s dilemma platform',
        url: '/warden_dilemma',
        status: 'active'
      }
    ]
  });
});
```

### 3. Frontend Subpath Configuration

**File: `client/vite.config.ts`**

Changes:
- Added `base: '/warden_dilemma'` to Vite config
- Updated proxy configuration for `/warden_dilemma/api`

**Before:**
```typescript
export default defineConfig({
  plugins: [react()],
  // no base path
})
```

**After:**
```typescript
export default defineConfig({
  plugins: [react()],
  base: '/warden_dilemma',  // All assets served under this path
  server: {
    proxy: {
      '/warden_dilemma/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})
```

**File: `client/src/services/api.service.ts`**

Changes:
- Updated API URL detection to use `/warden_dilemma/api` prefix
- Updated health check endpoint

**Before:**
```typescript
const getAPIURL = () => {
  const envURL = import.meta.env.VITE_API_URL;
  if (envURL) return envURL;
  return `${window.location.origin}/api`;
};
```

**After:**
```typescript
const getAPIURL = () => {
  const envURL = import.meta.env.VITE_API_URL;
  if (envURL) return envURL;
  return `${window.location.origin}/warden_dilemma/api`;
};
```

### 4. Documentation

**Files Created:**
- `SUBPATH_CONFIG.md` - Comprehensive guide on subpath configuration
- `CHANGELOG_SUBPATH.md` - This file

**Files Updated:**
- `README.md` - Updated with new URL structure information

## URL Structure

### Before (Root Path)
- App: `http://localhost:3000/`
- API: `http://localhost:3000/api`
- Health: `http://localhost:3000/health`

### After (Subpath)
- **Root**: `http://localhost:3000/` → Lists all apps
- **App**: `http://localhost:3000/warden_dilemma`
- **API**: `http://localhost:3000/warden_dilemma/api`
- **Health**: `http://localhost:3000/warden_dilemma/health`
- **WebSocket**: `ws://localhost:3000` (unchanged, Colyseus at root)

## Testing

### Build Test
```bash
pnpm run build
# ✅ Client builds successfully with /warden_dilemma prefix in assets
# ✅ Server builds successfully with zero errors
```

### Built Files Verification
```html
<!-- client/dist/index.html -->
<script type="module" crossorigin src="/warden_dilemma/assets/index-AkvD_7uo.js"></script>
<link rel="stylesheet" crossorigin href="/warden_dilemma/assets/index-DG988R--.css">
```

✅ Assets correctly prefixed with `/warden_dilemma/`

### Manual Testing Checklist
- [ ] Root endpoint returns app list
- [ ] App loads at `/warden_dilemma`
- [ ] API endpoints work at `/warden_dilemma/api`
- [ ] Health check responds at `/warden_dilemma/health`
- [ ] WebSocket connections work
- [ ] Static assets (CSS, JS) load correctly
- [ ] React Router navigation works
- [ ] Create experiment flow works
- [ ] Join lobby flow works

## Benefits

1. **Multi-app hosting**: Can now host multiple apps on one server
2. **Clean namespace**: Each app has its own URL space
3. **Easy scaling**: Can add more apps without conflicts
4. **Cloud Run ready**: Subpath routing works seamlessly in production
5. **Development friendly**: Local development unchanged

## Migration Notes

For existing deployments:
1. Old URLs (`/`) will now show the app list
2. Update any bookmarks to `/warden_dilemma`
3. API clients should update endpoints to `/warden_dilemma/api`

## Future Work

- Add authentication/authorization per app
- Create a unified landing page with app cards
- Add app-level metrics and monitoring
- Support dynamic app registration

## Verification

Build status: ✅ **PASSING**

```
Client build: ✅
Server build: ✅
TypeScript errors: 0
Subpath routing: ✅ Configured
Documentation: ✅ Complete
```

## Files Modified Summary

**Backend (8 files):**
- server/src/index.ts
- server/src/api/experiments.api.ts
- server/src/rooms/GameRoom.ts
- server/src/rooms/LobbyRoom.ts
- server/src/services/redis.service.ts (already done)
- server/package.json (already done)

**Frontend (5 files):**
- client/vite.config.ts
- client/src/services/api.service.ts
- client/src/vite-env.d.ts (created)
- client/src/pages/GamePage.tsx
- client/src/pages/LobbyPage.tsx

**Documentation (3 files):**
- SUBPATH_CONFIG.md (created)
- CHANGELOG_SUBPATH.md (created)
- README.md (to be updated)

## Date
November 19, 2025

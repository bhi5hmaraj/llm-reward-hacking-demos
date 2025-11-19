# Subpath Configuration - Warden's Dilemma

The Warden's Dilemma app is configured to run under the `/warden_dilemma` subpath, allowing it to coexist with other apps on the same server.

## Architecture

### URL Structure

- **Root**: `http://localhost:3000/` - Lists all available apps
- **App**: `http://localhost:3000/warden_dilemma` - Main app frontend
- **API**: `http://localhost:3000/warden_dilemma/api` - REST API endpoints
- **Health**: `http://localhost:3000/warden_dilemma/health` - Health check endpoint
- **WebSocket**: `ws://localhost:3000` - Colyseus WebSocket (root level)

### Key Files Modified

#### Backend (Server)

**`server/src/index.ts`:**
- API routes mounted at `/warden_dilemma/api`
- Static files served at `/warden_dilemma`
- Health check available at both `/health` and `/warden_dilemma/health`
- Root endpoint (`/`) lists all apps
- SPA fallback for `/warden_dilemma/*` routes

#### Frontend (Client)

**`client/vite.config.ts`:**
- `base: '/warden_dilemma'` - Sets the base path for all assets
- Updated proxy configuration for `/warden_dilemma/api`

**`client/src/services/api.service.ts`:**
- Auto-detects API URL with `/warden_dilemma/api` prefix
- Health check endpoint updated to `/warden_dilemma/health`

## Usage

### Development

```bash
# Start the server (builds client first)
pnpm dev

# Access the app
open http://localhost:3000/warden_dilemma

# View all apps
open http://localhost:3000
```

### Production

```bash
# Build everything
pnpm run build

# Start production server
pnpm start

# The app will be available at:
# http://your-domain.com/warden_dilemma
```

### Testing Subpath Routing

1. **Root endpoint** - Lists all apps:
   ```bash
   curl http://localhost:3000/
   ```

2. **App landing page**:
   ```bash
   curl http://localhost:3000/warden_dilemma
   ```

3. **API health check**:
   ```bash
   curl http://localhost:3000/warden_dilemma/health
   ```

4. **API endpoints**:
   ```bash
   curl http://localhost:3000/warden_dilemma/api
   ```

## Adding New Apps

To add more apps alongside Warden's Dilemma:

1. Mount your app under a different subpath (e.g., `/my_new_app`)
2. Add the app info to the root endpoint handler in `server/src/index.ts`
3. Follow the same pattern:
   - Static files at `/my_new_app`
   - API at `/my_new_app/api`
   - Health at `/my_new_app/health`

Example:

```typescript
// In server/src/index.ts
app.use('/my_new_app', express.static(myAppDistPath));
app.use('/my_new_app/api', myAppApiRouter);
app.get('/my_new_app/health', myAppHealthHandler);

// Update root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'LLM Reward Hacking Demos',
    apps: [
      {
        name: 'Warden\'s Dilemma',
        url: '/warden_dilemma',
        status: 'active'
      },
      {
        name: 'My New App',
        url: '/my_new_app',
        status: 'active'
      }
    ]
  });
});
```

## Cloud Run Deployment

The subpath configuration works seamlessly with Cloud Run. Update `cloudbuild.yaml` if needed, but the subpath routing is already configured.

When deployed:
- Root: `https://your-service.run.app/` - App list
- Warden's Dilemma: `https://your-service.run.app/warden_dilemma`
- API: `https://your-service.run.app/warden_dilemma/api`

## Environment Variables

No special environment variables needed for subpath routing. The frontend automatically detects the correct paths:

- **Development with Vite dev server**: Use `VITE_API_URL` to override
- **Production**: Auto-detects from `window.location.origin`

## Troubleshooting

### Assets not loading

**Issue**: CSS/JS files return 404

**Solution**: Ensure Vite's `base` is set to `/warden_dilemma` in `vite.config.ts`

### API calls failing

**Issue**: API requests go to wrong path

**Solution**: Check that `api.service.ts` uses `/warden_dilemma/api` prefix

### Routing issues

**Issue**: React Router not working under subpath

**Solution**: Ensure React Router's `basename` is set (if using BrowserRouter)

For HashRouter (current implementation), no changes needed.

### WebSocket connection fails

**Issue**: Colyseus can't connect

**Solution**: WebSocket remains at root level. Colyseus client should connect to:
```typescript
const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const wsUrl = `${protocol}//${window.location.host}`;
```

## Benefits

1. **Multi-app hosting**: Host multiple experimental apps on one server
2. **Clean separation**: Each app has its own namespace
3. **Easy migration**: Can move apps between servers easily
4. **Reverse proxy friendly**: Works well with nginx/Apache proxying
5. **Cloud Run compatible**: Seamlessly deploys to serverless platforms

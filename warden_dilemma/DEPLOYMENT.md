# Deployment Guide - Warden's Dilemma

This guide covers deploying Warden's Dilemma to Google Cloud Run with continuous deployment from GitHub.

## Table of Contents

1. [Quick Deploy to Cloud Run](#quick-deploy-to-cloud-run)
2. [Continuous Deployment from GitHub](#continuous-deployment-from-github)
3. [Environment Variables](#environment-variables)
4. [Local Docker Testing](#local-docker-testing)
5. [Troubleshooting](#troubleshooting)

---

## Quick Deploy to Cloud Run

### Prerequisites

- Google Cloud account with billing enabled
- [gcloud CLI](https://cloud.google.com/sdk/docs/install) installed and authenticated
- Upstash Redis account (optional but recommended for production)

### One-Time Setup

```bash
# 1. Set your project ID
export PROJECT_ID="your-project-id"
gcloud config set project $PROJECT_ID

# 2. Enable required APIs
gcloud services enable \
  cloudbuild.googleapis.com \
  run.googleapis.com \
  artifactregistry.googleapis.com

# 3. Create Artifact Registry repository (for Docker images)
gcloud artifacts repositories create warden-dilemma \
  --repository-format=docker \
  --location=us-central1 \
  --description="Warden's Dilemma Docker images"
```

### Manual Deploy from Local Machine

```bash
# Build and deploy
gcloud run deploy warden-dilemma \
  --source . \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --memory 1Gi \
  --cpu 1 \
  --max-instances 10 \
  --timeout 300 \
  --set-env-vars "NODE_ENV=production" \
  --set-env-vars "PORT=8080"

# Add Upstash Redis secrets (optional but recommended)
gcloud run services update warden-dilemma \
  --region us-central1 \
  --set-env-vars "UPSTASH_REDIS_REST_URL=your-upstash-url" \
  --set-env-vars "UPSTASH_REDIS_REST_TOKEN=your-upstash-token" \
  --set-env-vars "REDIS_URL=your-redis-url"
```

---

## Continuous Deployment from GitHub

This setup automatically deploys to Cloud Run whenever you push to the `main` branch.

### Option 1: Using Cloud Build (Recommended)

This method uses Google Cloud Build with a trigger that monitors your GitHub repository.

#### Step 1: Connect GitHub Repository

1. Go to [Google Cloud Console > Cloud Build > Triggers](https://console.cloud.google.com/cloud-build/triggers)
2. Click **"Connect Repository"**
3. Select **GitHub** as the source
4. Authenticate with GitHub and authorize Google Cloud Build
5. Select your repository: `bhi5hmaraj/llm-reward-hacking-demos`
6. Click **"Connect"**

#### Step 2: Create Build Trigger

**Using the Console UI:**

1. Go to [Cloud Build > Triggers](https://console.cloud.google.com/cloud-build/triggers)
2. Click **"Create Trigger"**
3. Configure:
   - **Name**: `deploy-warden-dilemma-main`
   - **Description**: `Deploy Warden's Dilemma to Cloud Run on main branch push`
   - **Event**: Push to a branch
   - **Source**: Select your connected repository
   - **Branch**: `^main$` (regex pattern to match only main branch)
   - **Configuration**: Cloud Build configuration file (yaml or json)
   - **Location**: Repository
   - **Cloud Build configuration file location**: `warden_dilemma/cloudbuild.yaml`
4. Click **"Create"**

**Using gcloud CLI:**

```bash
# Create trigger for main branch only
gcloud builds triggers create github \
  --name="deploy-warden-dilemma-main" \
  --repo-name="llm-reward-hacking-demos" \
  --repo-owner="bhi5hmaraj" \
  --branch-pattern="^main$" \
  --build-config="warden_dilemma/cloudbuild.yaml" \
  --description="Deploy Warden's Dilemma on main branch push"
```

#### Step 3: Grant Cloud Build Permissions

Cloud Build needs permission to deploy to Cloud Run:

```bash
# Get Cloud Build service account
export PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')
export CLOUD_BUILD_SA="${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com"

# Grant Cloud Run Admin role
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${CLOUD_BUILD_SA}" \
  --role="roles/run.admin"

# Grant Service Account User role (to deploy as Cloud Run service account)
gcloud iam service-accounts add-iam-policy-binding \
  ${PROJECT_NUMBER}-compute@developer.gserviceaccount.com \
  --member="serviceAccount:${CLOUD_BUILD_SA}" \
  --role="roles/iam.serviceAccountUser"
```

#### Step 4: Configure Environment Secrets

Store sensitive environment variables in Secret Manager:

```bash
# Enable Secret Manager API
gcloud services enable secretmanager.googleapis.com

# Create secrets
echo -n "your-upstash-redis-rest-url" | \
  gcloud secrets create upstash-redis-url --data-file=-

echo -n "your-upstash-redis-rest-token" | \
  gcloud secrets create upstash-redis-token --data-file=-

echo -n "your-redis-connection-url" | \
  gcloud secrets create redis-url --data-file=-

# Grant Cloud Build access to secrets
gcloud secrets add-iam-policy-binding upstash-redis-url \
  --member="serviceAccount:${CLOUD_BUILD_SA}" \
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding upstash-redis-token \
  --member="serviceAccount:${CLOUD_BUILD_SA}" \
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding redis-url \
  --member="serviceAccount:${CLOUD_BUILD_SA}" \
  --role="roles/secretmanager.secretAccessor"
```

#### Step 5: Test the Deployment

```bash
# Push to main branch to trigger deployment
git checkout main
git add .
git commit -m "test: trigger cloud run deployment"
git push origin main

# Monitor the build
gcloud builds list --limit=5

# View build logs
gcloud builds log <BUILD_ID>
```

### Option 2: Using GitHub Actions

If you prefer GitHub Actions over Cloud Build, create `.github/workflows/deploy-cloud-run.yml`:

```yaml
name: Deploy to Cloud Run

on:
  push:
    branches:
      - main  # Only deploy from main branch
    paths:
      - 'warden_dilemma/**'

env:
  PROJECT_ID: your-project-id
  SERVICE_NAME: warden-dilemma
  REGION: us-central1

jobs:
  deploy:
    runs-on: ubuntu-latest

    permissions:
      contents: read
      id-token: write

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Authenticate to Google Cloud
        uses: google-github-actions/auth@v2
        with:
          workload_identity_provider: projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/github-pool/providers/github-provider
          service_account: github-actions@${{ env.PROJECT_ID }}.iam.gserviceaccount.com

      - name: Set up Cloud SDK
        uses: google-github-actions/setup-gcloud@v2

      - name: Deploy to Cloud Run
        run: |
          gcloud run deploy ${{ env.SERVICE_NAME }} \
            --source ./warden_dilemma \
            --region ${{ env.REGION }} \
            --platform managed \
            --allow-unauthenticated \
            --memory 1Gi \
            --cpu 1 \
            --max-instances 10 \
            --set-env-vars "NODE_ENV=production,PORT=8080" \
            --set-secrets "UPSTASH_REDIS_REST_URL=upstash-redis-url:latest,UPSTASH_REDIS_REST_TOKEN=upstash-redis-token:latest,REDIS_URL=redis-url:latest"
```

---

## Environment Variables

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `production` |
| `PORT` | Server port (Cloud Run injects this) | `8080` |

### Optional Variables (Redis Persistence)

| Variable | Description | Example |
|----------|-------------|---------|
| `UPSTASH_REDIS_REST_URL` | Upstash REST API URL | `https://xxx.upstash.io` |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash REST API token | `AXXXxxxx` |
| `REDIS_URL` | Redis connection URL (for Colyseus driver) | `redis://default:password@region.upstash.io:6379` |

### Optional Variables (AI Agents)

| Variable | Description | Example |
|----------|-------------|---------|
| `OPENAI_API_KEY` | OpenAI API key for GPT agents | `sk-...` |
| `ANTHROPIC_API_KEY` | Anthropic API key for Claude agents | `sk-ant-...` |

### Setting Environment Variables in Cloud Run

**Via Console:**
1. Go to [Cloud Run > Services](https://console.cloud.google.com/run)
2. Click on your service
3. Click **"Edit & Deploy New Revision"**
4. Go to **"Variables & Secrets"** tab
5. Add environment variables or mount secrets

**Via gcloud CLI:**

```bash
# Set environment variables
gcloud run services update warden-dilemma \
  --region us-central1 \
  --set-env-vars "KEY=value"

# Mount secrets from Secret Manager
gcloud run services update warden-dilemma \
  --region us-central1 \
  --set-secrets "UPSTASH_REDIS_REST_URL=upstash-redis-url:latest"
```

---

## Local Docker Testing

Test the Docker build locally before deploying:

```bash
# Build the Docker image
cd warden_dilemma
docker build -t warden-dilemma:test .

# Run locally
docker run -p 3000:3000 \
  -e NODE_ENV=production \
  -e PORT=3000 \
  -e UPSTASH_REDIS_REST_URL="your-url" \
  -e UPSTASH_REDIS_REST_TOKEN="your-token" \
  warden-dilemma:test

# Test the application
curl http://localhost:3000/health
```

### Multi-platform Build (for Apple Silicon)

If you're on an M1/M2 Mac and deploying to Cloud Run (x86):

```bash
# Build for linux/amd64 platform
docker buildx build --platform linux/amd64 -t warden-dilemma:test .

# Or use Docker Compose
docker buildx build --platform linux/amd64 \
  -t us-central1-docker.pkg.dev/$PROJECT_ID/warden-dilemma/app:latest .
```

---

## Troubleshooting

### Build Fails with "Cannot find module"

**Problem**: Missing dependencies in production build.

**Solution**: Check that all dependencies are in `dependencies`, not `devDependencies`:

```bash
# Move packages from devDependencies to dependencies if needed
pnpm install <package> --save-prod
```

### Cloud Run: "Error: listen EADDRINUSE: address already in use"

**Problem**: Server not listening on Cloud Run's injected `PORT` environment variable.

**Solution**: Ensure `server/src/index.ts` uses `process.env.PORT`:

```typescript
const PORT = process.env.PORT || 3000;
```

### Build Timeout on Cloud Build

**Problem**: Build exceeds default timeout (10 minutes).

**Solution**: Increase timeout in `cloudbuild.yaml`:

```yaml
timeout: 1200s  # 20 minutes
```

### WebSocket Connection Fails

**Problem**: WebSocket connections don't work over HTTPS.

**Solution**:
1. Ensure Cloud Run allows WebSocket connections (enabled by default)
2. Check that client uses `wss://` protocol for HTTPS:

```typescript
const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
```

### Redis Connection Issues

**Problem**: Can't connect to Redis from Cloud Run.

**Solution**:
1. Verify Redis URL is accessible from public internet
2. For Upstash, use the REST API URL (not direct Redis connection)
3. Check Secret Manager permissions
4. Test connection with curl:

```bash
curl https://your-upstash-url.upstash.io/ping \
  -H "Authorization: Bearer your-token"
```

### View Logs

```bash
# Stream logs in real-time
gcloud run services logs tail warden-dilemma --region us-central1

# View recent logs
gcloud run services logs read warden-dilemma --region us-central1 --limit 50
```

---

## Cost Estimation

**Cloud Run Pricing (as of 2025):**

- **Free tier**: 2 million requests/month
- **Compute**: ~$0.00002400/vCPU-second, ~$0.00000250/GiB-second
- **Requests**: $0.40 per million requests

**Estimated monthly cost for moderate usage:**
- 50,000 requests/month
- Average 5 seconds per request
- 1 vCPU, 1 GiB memory
- **~$5-10/month**

**Upstash Redis Free Tier:**
- 10,000 commands/day
- 256 MB storage
- Sufficient for development and small experiments

---

## Security Best Practices

1. **Use Secret Manager** for sensitive data (never commit secrets to git)
2. **Enable authentication** for admin routes
3. **Set up Cloud Armor** for DDoS protection (if needed)
4. **Use VPC** for private Redis connections (if using GCP Redis)
5. **Enable audit logging** for Cloud Run
6. **Set up uptime monitoring** with Cloud Monitoring

---

## Updating the Deployment

To deploy updates:

1. **Automatic (via CI/CD)**: Just push to main branch
   ```bash
   git push origin main
   ```

2. **Manual**: Redeploy via gcloud
   ```bash
   gcloud run deploy warden-dilemma --source .
   ```

3. **Rollback**: Revert to previous revision
   ```bash
   gcloud run services update-traffic warden-dilemma \
     --region us-central1 \
     --to-revisions REVISION_NAME=100
   ```

---

## Additional Resources

- [Cloud Run Documentation](https://cloud.google.com/run/docs)
- [Cloud Build Triggers](https://cloud.google.com/build/docs/automating-builds/create-manage-triggers)
- [Secret Manager](https://cloud.google.com/secret-manager/docs)
- [Upstash Redis](https://docs.upstash.com/redis)
- [Colyseus Deployment Guide](https://docs.colyseus.io/deployment/)

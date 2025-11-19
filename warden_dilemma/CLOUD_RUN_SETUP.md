# Quick Setup: GitHub → Cloud Run (Main Branch Only)

This guide shows you how to set up **automatic deployment from GitHub to Google Cloud Run** that **only deploys when you push to the `main` branch**.

## Overview

When you push code to the `main` branch:
1. GitHub webhook triggers Google Cloud Build
2. Cloud Build reads `cloudbuild.yaml` and builds Docker image
3. Image is pushed to Artifact Registry
4. Cloud Run service is automatically updated with new image

**Other branches** (like `develop`, feature branches) will **NOT trigger deployments**.

---

## Prerequisites

✅ Google Cloud account with billing enabled
✅ GitHub repository: `bhi5hmaraj/llm-reward-hacking-demos`
✅ [gcloud CLI](https://cloud.google.com/sdk/docs/install) installed
✅ Upstash Redis account (optional but recommended)

---

## Step 1: Initial Cloud Setup (One-Time)

Run the automated setup script:

```bash
cd warden_dilemma
chmod +x scripts/setup-cloud-run.sh
./scripts/setup-cloud-run.sh
```

This script will:
- Enable required Google Cloud APIs
- Create Artifact Registry repository
- Set up IAM permissions for Cloud Build
- Create Secret Manager secrets for Redis credentials

**Or manually:**

```bash
# Set project
export PROJECT_ID="your-project-id"
gcloud config set project $PROJECT_ID

# Enable APIs
gcloud services enable cloudbuild.googleapis.com run.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com

# Create Artifact Registry
gcloud artifacts repositories create warden-dilemma \
  --repository-format=docker \
  --location=us-central1 \
  --description="Warden's Dilemma Docker images"

# Set up IAM
export PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')
export CLOUD_BUILD_SA="${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${CLOUD_BUILD_SA}" \
  --role="roles/run.admin"

gcloud iam service-accounts add-iam-policy-binding \
  ${PROJECT_NUMBER}-compute@developer.gserviceaccount.com \
  --member="serviceAccount:${CLOUD_BUILD_SA}" \
  --role="roles/iam.serviceAccountUser"
```

---

## Step 2: Connect GitHub Repository

### Option A: Using Google Cloud Console (Easiest)

1. Go to **[Cloud Build > Triggers](https://console.cloud.google.com/cloud-build/triggers)**
2. Click **"Connect Repository"**
3. Select **GitHub (Cloud Build GitHub App)**
4. Click **"Authenticate"** and sign in to GitHub
5. Select repository: `bhi5hmaraj/llm-reward-hacking-demos`
6. Click **"Connect"**

### Option B: Using gcloud CLI

First, you need to authenticate GitHub via the console (Option A, steps 1-5), then run:

```bash
gcloud builds triggers create github \
  --name="deploy-warden-dilemma-main" \
  --repo-name="llm-reward-hacking-demos" \
  --repo-owner="bhi5hmaraj" \
  --branch-pattern="^main$" \
  --build-config="warden_dilemma/cloudbuild.yaml" \
  --description="Deploy Warden's Dilemma on main branch push"
```

**Important:** The `--branch-pattern="^main$"` ensures **only the main branch triggers builds**.

---

## Step 3: Configure Secrets (Optional but Recommended)

If you want persistent data storage with Upstash Redis:

```bash
# Create secrets
echo -n "your-upstash-rest-url" | \
  gcloud secrets create upstash-redis-url --data-file=-

echo -n "your-upstash-rest-token" | \
  gcloud secrets create upstash-redis-token --data-file=-

echo -n "your-redis-connection-url" | \
  gcloud secrets create redis-url --data-file=-

# Grant Cloud Build access
for SECRET in upstash-redis-url upstash-redis-token redis-url; do
  gcloud secrets add-iam-policy-binding $SECRET \
    --member="serviceAccount:${CLOUD_BUILD_SA}" \
    --role="roles/secretmanager.secretAccessor"
done
```

**Get Upstash credentials:**
1. Sign up at [upstash.com](https://upstash.com) (free tier available)
2. Create a Redis database
3. Copy the REST URL and token from the dashboard

---

## Step 4: Verify Setup

### Check Build Trigger

```bash
# List triggers
gcloud builds triggers list

# You should see: deploy-warden-dilemma-main with branch-pattern: ^main$
```

### Test Deployment

Push a commit to the `main` branch:

```bash
git checkout main
git add .
git commit -m "test: trigger cloud run deployment"
git push origin main
```

### Monitor Build

```bash
# List recent builds
gcloud builds list --limit=5

# View specific build logs
gcloud builds log <BUILD_ID>

# Or watch in Cloud Console
# https://console.cloud.google.com/cloud-build/builds
```

### View Deployed Service

```bash
# Get service URL
gcloud run services describe warden-dilemma \
  --region us-central1 \
  --format='value(status.url)'

# Open in browser
gcloud run services browse warden-dilemma --region us-central1
```

---

## How It Works

### Files Involved

1. **`cloudbuild.yaml`** - Defines build steps (build Docker → push to registry → deploy to Cloud Run)
2. **`Dockerfile`** - Multi-stage build for production image
3. **`.dockerignore`** - Excludes unnecessary files from Docker build

### Build Process

```
GitHub Push (main)
  → Webhook
  → Cloud Build Trigger
  → Execute cloudbuild.yaml
    → Step 1: Build Docker image
    → Step 2: Push to Artifact Registry
    → Step 3: Deploy to Cloud Run
  → Service Updated ✅
```

### Branch Protection

The trigger uses regex pattern `^main$` which matches **only** the exact branch name "main":

- ✅ `main` → **Deploys**
- ❌ `develop` → Does not deploy
- ❌ `feature/new-ui` → Does not deploy
- ❌ `mainline` → Does not deploy (doesn't match exactly)

---

## Testing Branch Protection

Create a test branch to verify it doesn't trigger deployment:

```bash
# Create and push a test branch
git checkout -b test-no-deploy
echo "test" >> test.txt
git add test.txt
git commit -m "test: should not deploy"
git push origin test-no-deploy

# Check Cloud Build - no new builds should appear
gcloud builds list --limit=5
```

Only pushes to `main` will trigger builds.

---

## Managing Deployments

### View Current Deployment

```bash
# Service details
gcloud run services describe warden-dilemma --region us-central1

# List revisions
gcloud run revisions list --service warden-dilemma --region us-central1

# View logs
gcloud run services logs tail warden-dilemma --region us-central1
```

### Rollback to Previous Version

```bash
# List revisions
gcloud run revisions list --service warden-dilemma --region us-central1

# Rollback
gcloud run services update-traffic warden-dilemma \
  --region us-central1 \
  --to-revisions <REVISION_NAME>=100
```

### Manual Deployment (Bypass GitHub)

```bash
cd warden_dilemma
gcloud run deploy warden-dilemma --source . --region us-central1
```

---

## Updating Environment Variables

### Add New Secrets

```bash
# Create secret
echo -n "sk-..." | gcloud secrets create openai-api-key --data-file=-

# Update Cloud Run service to use secret
gcloud run services update warden-dilemma \
  --region us-central1 \
  --set-secrets "OPENAI_API_KEY=openai-api-key:latest"
```

### Update Existing Secrets

```bash
# Update secret value
echo -n "new-value" | gcloud secrets versions add upstash-redis-url --data-file=-

# Cloud Run automatically picks up latest version on next deployment
```

### Add Environment Variables (Non-Secret)

Edit `cloudbuild.yaml`:

```yaml
- '--set-env-vars'
- 'NODE_ENV=production,MY_NEW_VAR=value'
```

Or via gcloud:

```bash
gcloud run services update warden-dilemma \
  --region us-central1 \
  --set-env-vars "MY_NEW_VAR=value"
```

---

## Troubleshooting

### Build Fails: "Permission Denied"

**Issue:** Cloud Build doesn't have permission to deploy to Cloud Run.

**Fix:**
```bash
export PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')
export CLOUD_BUILD_SA="${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${CLOUD_BUILD_SA}" \
  --role="roles/run.admin"
```

### Build Fails: "Artifact Registry Not Found"

**Issue:** Artifact Registry repository doesn't exist.

**Fix:**
```bash
gcloud artifacts repositories create warden-dilemma \
  --repository-format=docker \
  --location=us-central1
```

### Trigger Not Firing

**Issue:** GitHub webhook not configured correctly.

**Fix:**
1. Go to [Cloud Build > Triggers](https://console.cloud.google.com/cloud-build/triggers)
2. Click on your trigger
3. Click "Run" to manually test
4. If it works, check GitHub webhook settings:
   - Go to GitHub repo → Settings → Webhooks
   - Verify Google Cloud Build webhook is present and active

### Service Not Accessible

**Issue:** Cloud Run service is deployed but returns 404/500.

**Fix:**
```bash
# Check service status
gcloud run services describe warden-dilemma --region us-central1

# Check logs for errors
gcloud run services logs read warden-dilemma --region us-central1 --limit 50

# Common issues:
# - PORT environment variable not used (should be process.env.PORT || 3000)
# - Static files not found (check client/dist exists in Docker image)
# - Redis connection timeout (use Upstash REST API, not direct connection)
```

---

## Cost Optimization

### Current Setup

- **Min instances:** 0 (scales to zero when idle = no cost)
- **Max instances:** 10 (prevents runaway costs)
- **Memory:** 1 GiB
- **CPU:** 1

### Estimated Costs

- **Free tier:** 2M requests/month, 360k GiB-seconds/month
- **Typical usage:** ~$5-10/month for moderate experiments
- **Scale to zero:** Only charged when service is actively processing requests

### Reduce Costs Further

1. **Decrease memory/CPU:**
   ```yaml
   - '--memory'
   - '512Mi'  # Down from 1Gi
   - '--cpu'
   - '1'
   ```

2. **Use Upstash free tier** (10k commands/day)

3. **Delete unused revisions:**
   ```bash
   gcloud run revisions delete <OLD_REVISION> --region us-central1 --quiet
   ```

---

## Next Steps

✅ **Your setup is complete!** Now:

1. Push to `main` branch to deploy
2. Monitor builds: https://console.cloud.google.com/cloud-build/builds
3. Access service: `gcloud run services describe warden-dilemma --region us-central1`
4. View logs: `gcloud run services logs tail warden-dilemma --region us-central1`

For full documentation, see [DEPLOYMENT.md](./DEPLOYMENT.md).

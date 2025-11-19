#!/bin/bash

# Warden's Dilemma - Cloud Run Setup Script
# This script sets up Google Cloud Run with continuous deployment from GitHub (main branch only)

set -e  # Exit on error

echo "🚀 Warden's Dilemma - Cloud Run Setup"
echo "======================================"
echo ""

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo "❌ Error: gcloud CLI is not installed"
    echo "Please install from: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Prompt for project ID
read -p "Enter your Google Cloud Project ID: " PROJECT_ID

if [ -z "$PROJECT_ID" ]; then
    echo "❌ Error: Project ID cannot be empty"
    exit 1
fi

echo ""
echo "📋 Setting up project: $PROJECT_ID"
gcloud config set project $PROJECT_ID

# Prompt for region
echo ""
echo "Available regions:"
echo "  - us-central1 (Iowa)"
echo "  - us-east1 (South Carolina)"
echo "  - europe-west1 (Belgium)"
echo "  - asia-southeast1 (Singapore)"
read -p "Enter region [us-central1]: " REGION
REGION=${REGION:-us-central1}

echo ""
echo "🔧 Step 1: Enabling required APIs..."
gcloud services enable \
  cloudbuild.googleapis.com \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com

echo ""
echo "📦 Step 2: Creating Artifact Registry repository..."
gcloud artifacts repositories create warden-dilemma \
  --repository-format=docker \
  --location=$REGION \
  --description="Warden's Dilemma Docker images" \
  2>/dev/null || echo "Repository already exists, skipping..."

echo ""
echo "🔐 Step 3: Setting up IAM permissions for Cloud Build..."

# Get project number and Cloud Build service account
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')
CLOUD_BUILD_SA="${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com"

# Grant Cloud Run Admin role
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${CLOUD_BUILD_SA}" \
  --role="roles/run.admin" \
  --quiet

# Grant Service Account User role
gcloud iam service-accounts add-iam-policy-binding \
  ${PROJECT_NUMBER}-compute@developer.gserviceaccount.com \
  --member="serviceAccount:${CLOUD_BUILD_SA}" \
  --role="roles/iam.serviceAccountUser" \
  --quiet

echo ""
echo "🔑 Step 4: Setting up Upstash Redis secrets..."
echo ""
echo "Do you have Upstash Redis credentials? (y/n)"
read -p "> " HAS_UPSTASH

if [ "$HAS_UPSTASH" = "y" ] || [ "$HAS_UPSTASH" = "Y" ]; then
    read -p "Enter Upstash Redis REST URL: " UPSTASH_URL
    read -p "Enter Upstash Redis REST Token: " UPSTASH_TOKEN
    read -p "Enter Redis Connection URL: " REDIS_URL

    # Create secrets
    echo -n "$UPSTASH_URL" | gcloud secrets create upstash-redis-url --data-file=- 2>/dev/null || \
        echo -n "$UPSTASH_URL" | gcloud secrets versions add upstash-redis-url --data-file=-

    echo -n "$UPSTASH_TOKEN" | gcloud secrets create upstash-redis-token --data-file=- 2>/dev/null || \
        echo -n "$UPSTASH_TOKEN" | gcloud secrets versions add upstash-redis-token --data-file=-

    echo -n "$REDIS_URL" | gcloud secrets create redis-url --data-file=- 2>/dev/null || \
        echo -n "$REDIS_URL" | gcloud secrets versions add redis-url --data-file=-

    # Grant Cloud Build access to secrets
    for SECRET in upstash-redis-url upstash-redis-token redis-url; do
        gcloud secrets add-iam-policy-binding $SECRET \
            --member="serviceAccount:${CLOUD_BUILD_SA}" \
            --role="roles/secretmanager.secretAccessor" \
            --quiet
    done

    echo "✅ Secrets created and permissions granted"
else
    echo "⚠️  Skipping Redis setup. App will run in in-memory mode."
    echo "   You can add secrets later using:"
    echo "   gcloud secrets create upstash-redis-url --data-file=-"
fi

echo ""
echo "🔗 Step 5: GitHub Repository Connection"
echo ""
echo "To complete the setup, you need to connect your GitHub repository:"
echo ""
echo "1. Go to: https://console.cloud.google.com/cloud-build/triggers?project=$PROJECT_ID"
echo "2. Click 'Connect Repository'"
echo "3. Select 'GitHub' and authorize the connection"
echo "4. Select repository: bhi5hmaraj/llm-reward-hacking-demos"
echo "5. Click 'Create Trigger' with these settings:"
echo "   - Name: deploy-warden-dilemma-main"
echo "   - Event: Push to a branch"
echo "   - Branch: ^main$ (regex pattern)"
echo "   - Configuration: Cloud Build configuration file"
echo "   - Location: warden_dilemma/cloudbuild.yaml"
echo ""
echo "Or use this gcloud command after connecting the repository:"
echo ""
echo "gcloud builds triggers create github \\"
echo "  --name=\"deploy-warden-dilemma-main\" \\"
echo "  --repo-name=\"llm-reward-hacking-demos\" \\"
echo "  --repo-owner=\"bhi5hmaraj\" \\"
echo "  --branch-pattern=\"^main$\" \\"
echo "  --build-config=\"warden_dilemma/cloudbuild.yaml\" \\"
echo "  --description=\"Deploy Warden's Dilemma on main branch push\""
echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Connect GitHub repository (see instructions above)"
echo "2. Push to main branch to trigger first deployment"
echo "3. Monitor deployment: gcloud builds list --limit=5"
echo "4. View service: https://console.cloud.google.com/run?project=$PROJECT_ID"
echo ""
echo "To deploy manually right now, run:"
echo "  cd warden_dilemma && gcloud run deploy warden-dilemma --source . --region $REGION"
echo ""

#!/usr/bin/env bash
# Deploy staging-rich-results-tester to Google Cloud Run (Artifact Registry).
# Prereqs: gcloud auth login && gcloud config set project rich-results-tester
#
# If Cloud Build fails on storage/artifact permissions, ask a project Owner
# to run: ./scripts/grant-cloudbuild-iam.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# Prefer project-local gcloud if present
if [ -x "${SCRIPT_DIR}/.tools/google-cloud-sdk/bin/gcloud" ]; then
  export CLOUDSDK_PYTHON="${CLOUDSDK_PYTHON:-/opt/homebrew/bin/python3.11}"
  export CLOUDSDK_CONFIG="${CLOUDSDK_CONFIG:-${SCRIPT_DIR}/.tools/gcloud-config}"
  export PATH="${SCRIPT_DIR}/.tools/google-cloud-sdk/bin:${PATH}"
fi

PROJECT_ID="${GCP_PROJECT_ID:-rich-results-tester}"
REGION="${GCP_REGION:-us-central1}"
SERVICE="${CLOUD_RUN_SERVICE:-staging-rich-results-tester}"
REPO="${ARTIFACT_REPO:-cloud-run-source}"
IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/${SERVICE}"

echo "Project:  ${PROJECT_ID}"
echo "Region:   ${REGION}"
echo "Service:  ${SERVICE}"
echo "Image:    ${IMAGE}"

gcloud config set project "${PROJECT_ID}"

gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  storage.googleapis.com

# Ensure Artifact Registry repo exists
if ! gcloud artifacts repositories describe "${REPO}" --location="${REGION}" >/dev/null 2>&1; then
  gcloud artifacts repositories create "${REPO}" \
    --repository-format=docker \
    --location="${REGION}" \
    --description="Docker images for Cloud Run"
fi

gcloud builds submit --tag "${IMAGE}"

gcloud run deploy "${SERVICE}" \
  --image "${IMAGE}" \
  --region "${REGION}" \
  --platform managed \
  --allow-unauthenticated \
  --memory 2Gi \
  --cpu 2 \
  --timeout 300 \
  --concurrency 5 \
  --min-instances 0 \
  --max-instances 3 \
  --set-env-vars "PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium,NODE_ENV=production"

echo ""
echo "Service URL:"
gcloud run services describe "${SERVICE}" \
  --region "${REGION}" \
  --format='value(status.url)'

#!/usr/bin/env bash
# Deploy staging-rich-results-tester to Google Cloud Run.
# Prereqs: gcloud auth login && gcloud config set project rich-results-tester
set -euo pipefail

PROJECT_ID="${GCP_PROJECT_ID:-rich-results-tester}"
REGION="${GCP_REGION:-us-central1}"
SERVICE="${CLOUD_RUN_SERVICE:-staging-rich-results-tester}"
IMAGE="gcr.io/${PROJECT_ID}/${SERVICE}"

echo "Project:  ${PROJECT_ID}"
echo "Region:   ${REGION}"
echo "Service:  ${SERVICE}"
echo "Image:    ${IMAGE}"

gcloud config set project "${PROJECT_ID}"

# APIs needed once per project
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  containerregistry.googleapis.com \
  artifactregistry.googleapis.com

# Build + push via Cloud Build, then deploy
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

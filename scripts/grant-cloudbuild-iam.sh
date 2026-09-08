#!/usr/bin/env bash
# Owner-only (optional): grant roles to the deploy service account via gcloud.
# Prefer Console IAM if that's easier — see Slack / team notes.
#
# Uses whatever `gcloud` is on PATH (no machine-specific config paths).
set -euo pipefail

if ! command -v gcloud >/dev/null 2>&1; then
  echo "gcloud not found on PATH. Install: https://cloud.google.com/sdk/docs/install"
  exit 1
fi

PROJECT_ID="${GCP_PROJECT_ID:-rich-results-tester}"
DEPLOY_SA="${DEPLOY_SA:-staging-rich-results-tester@${PROJECT_ID}.iam.gserviceaccount.com}"
PROJECT_NUMBER="$(gcloud projects describe "${PROJECT_ID}" --format='value(projectNumber)')"
CB_AGENT="service-${PROJECT_NUMBER}@gcp-sa-cloudbuild.iam.gserviceaccount.com"

gcloud config set project "${PROJECT_ID}"

echo "Project: ${PROJECT_ID} (${PROJECT_NUMBER})"
echo "Granting project roles to ${DEPLOY_SA}"

ROLES=(
  roles/logging.logWriter
  roles/artifactregistry.writer
  roles/storage.objectAdmin
  roles/run.admin
  roles/iam.serviceAccountUser
  roles/cloudbuild.builds.builder
)

for ROLE in "${ROLES[@]}"; do
  gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
    --member="serviceAccount:${DEPLOY_SA}" \
    --role="${ROLE}" \
    --condition=None \
    --quiet
  echo "OK ${ROLE}"
done

echo "Allowing Cloud Build agent + deployers to act as ${DEPLOY_SA}"
gcloud iam service-accounts add-iam-policy-binding "${DEPLOY_SA}" \
  --project="${PROJECT_ID}" \
  --member="serviceAccount:${CB_AGENT}" \
  --role="roles/iam.serviceAccountUser" \
  --quiet

# So Editors (e.g. you) can submit builds that run as this SA
gcloud iam service-accounts add-iam-policy-binding "${DEPLOY_SA}" \
  --project="${PROJECT_ID}" \
  --member="group:yodas@webfx.com" \
  --role="roles/iam.serviceAccountUser" \
  --quiet 2>/dev/null || true

echo "Done. Re-run ./deploy.cloudrun.sh"

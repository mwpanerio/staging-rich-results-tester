#!/usr/bin/env bash
# Owner-only: grant Cloud Build / Cloud Run SA the roles needed to build & deploy.
#
# Uses whatever `gcloud` is on PATH (no machine-specific config paths).
# Run once as a project Owner from any machine:
#   gcloud auth login
#   gcloud config set project rich-results-tester
#   ./scripts/grant-cloudbuild-iam.sh
#
# Or paste the equivalent commands from the README / Slack ask — no repo clone required.
set -euo pipefail

if ! command -v gcloud >/dev/null 2>&1; then
  echo "gcloud not found on PATH. Install: https://cloud.google.com/sdk/docs/install"
  exit 1
fi

PROJECT_ID="${GCP_PROJECT_ID:-rich-results-tester}"
gcloud config set project "${PROJECT_ID}"
PROJECT_NUMBER="$(gcloud projects describe "${PROJECT_ID}" --format='value(projectNumber)')"
COMPUTE_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

echo "Project: ${PROJECT_ID} (${PROJECT_NUMBER})"
echo "Granting roles to ${COMPUTE_SA}"

ROLES=(
  roles/logging.logWriter
  roles/artifactregistry.writer
  roles/storage.objectAdmin
  roles/run.admin
  roles/iam.serviceAccountUser
)

for ROLE in "${ROLES[@]}"; do
  gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
    --member="serviceAccount:${COMPUTE_SA}" \
    --role="${ROLE}" \
    --condition=None \
    --quiet
  echo "OK ${ROLE}"
done

echo "Done. Re-run ./deploy.cloudrun.sh as Editor."

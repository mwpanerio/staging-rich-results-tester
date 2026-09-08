#!/usr/bin/env bash
# Owner-only: grant Cloud Build / Cloud Run SA the roles needed to build & deploy.
# Run once as a project Owner (e.g. andrew@webfx.com):
#   gcloud auth login
#   ./scripts/grant-cloudbuild-iam.sh
set -euo pipefail

PROJECT_ID="${GCP_PROJECT_ID:-rich-results-tester}"
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

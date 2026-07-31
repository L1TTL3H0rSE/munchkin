output "terraform_deployer_service_account_id" {
  description = "Service account to impersonate for later reviewed infrastructure plans."
  value       = yandex_iam_service_account.terraform_deployer.id
}

output "state_backend_service_account_id" {
  description = "Service account for the owner-created S3 backend access key."
  value       = yandex_iam_service_account.state_backend.id
}

output "runtime_service_account_id" {
  description = "Keyless service account attached to the production Compute instance."
  value       = yandex_iam_service_account.runtime.id
}

output "github_images_service_account_id" {
  description = "Keyless service account used by the protected GitHub image publisher."
  value       = yandex_iam_service_account.github_images.id
}

output "github_actions_federation_id" {
  description = "GitHub Actions OIDC federation ID."
  value       = yandex_iam_workload_identity_oidc_federation.github_actions.id
}

output "github_actions_federated_credential_id" {
  description = "Exact production-images federated credential ID."
  value       = yandex_iam_workload_identity_federated_credential.github_images.id
}

output "github_actions_oidc_issuer" {
  description = "Issuer accepted by the GitHub Actions federation."
  value       = local.github_oidc_issuer
}

output "github_actions_oidc_audience" {
  description = "Exact audience accepted by the GitHub Actions federation."
  value       = local.github_oidc_audience
}

output "github_actions_oidc_subject" {
  description = "Exact immutable subject accepted by the GitHub Actions federation."
  value       = local.github_oidc_subject
}

output "state_bucket_name" {
  description = "Private, versioned and KMS-encrypted Terraform state bucket."
  value       = yandex_storage_bucket.terraform_state.bucket
}

output "state_kms_key_id" {
  description = "KMS key used by the Terraform state bucket."
  value       = yandex_kms_symmetric_key.terraform_state.id
}

output "state_object_keys" {
  description = "Only state objects authorized by the bucket policy."
  value       = local.state_keys
}

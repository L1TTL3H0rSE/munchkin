output "terraform_deployer_service_account_id" {
  description = "Service account to impersonate for later reviewed infrastructure plans."
  value       = yandex_iam_service_account.terraform_deployer.id
}

output "state_backend_service_account_id" {
  description = "Service account for the owner-created S3 backend access key."
  value       = yandex_iam_service_account.state_backend.id
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

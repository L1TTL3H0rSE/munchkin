output "runtime_service_account_id" {
  description = "Keyless service account attached to the production instance."
  value       = data.yandex_iam_service_account.runtime.id
}

output "github_images_service_account_id" {
  description = "Keyless service account used by the protected GitHub image publisher."
  value       = data.yandex_iam_service_account.github_images.id
}

output "container_registry_id" {
  description = "Private registry used by future immutable image pipelines."
  value       = yandex_container_registry.production.id
}

output "container_registry_endpoint" {
  description = "Yandex Container Registry endpoint used by immutable image publication."
  value       = "cr.yandex"
}

output "container_image_prefixes" {
  description = "Exact image repositories published by the protected workflow."
  value = {
    game = "cr.yandex/${yandex_container_registry.production.id}/game"
    web  = "cr.yandex/${yandex_container_registry.production.id}/web"
  }
}

output "container_repository_names" {
  description = "Explicit repositories reserved for game and web images."
  value = [
    yandex_container_repository.game.name,
    yandex_container_repository.web.name,
  ]
}

output "network_id" {
  description = "Dedicated production VPC network."
  value       = yandex_vpc_network.production.id
}

output "subnet_id" {
  description = "Single-zone production subnet."
  value       = yandex_vpc_subnet.production.id
}

output "security_group_id" {
  description = "Production host security group."
  value       = yandex_vpc_security_group.production.id
}

output "public_ipv4" {
  description = "Reserved public IPv4 attached to the production instance."
  value       = yandex_vpc_address.production.external_ipv4_address[0].address
}

output "dns_zone_id" {
  description = "Yandex Cloud DNS zone ID; registrar delegation remains owner-gated."
  value       = yandex_dns_zone.production.id
}

output "production_hostname" {
  description = "Exact production hostname represented by the managed A record."
  value       = var.production_hostname
}

output "runtime_lockbox_secret_id" {
  description = "Metadata-only Lockbox secret ID; payload remains owner-managed."
  value       = yandex_lockbox_secret.production.id
}

output "monium_writer_service_account_id" {
  description = "Dedicated keyless service account for Monium metrics and traces ingestion; no API key payload is managed here."
  value       = yandex_iam_service_account.monium_writer.id
}

output "monium_project" {
  description = "Monium project label used by the Collector header."
  value       = local.monium_project
}

output "monium_dashboard_id" {
  description = "Terraform-managed Monium dashboard ID."
  value       = yandex_monitoring_dashboard.production.dashboard_id
}

output "monium_api_key_expiry_days" {
  description = "Maximum owner-managed API-key lifetime; the key itself is outside Terraform state."
  value       = var.monium_api_key_expiry_days
}

output "postgres_backup_bucket_name" {
  description = "Dedicated private Object Storage bucket for encrypted PostgreSQL backups."
  value       = yandex_storage_bucket.postgres_backups.bucket
}

output "postgres_backup_kms_key_id" {
  description = "Deletion-protected KMS key used for server-side backup encryption."
  value       = yandex_kms_symmetric_key.postgres_backup.id
}

output "postgres_backup_uploader_service_account_id" {
  description = "Existing keyless runtime service account granted bucket-scoped upload/read-back access."
  value       = data.yandex_iam_service_account.runtime.id
}

output "postgres_backup_operator_subject" {
  description = "Optional owner-supplied isolated-restore subject; no secret value."
  value       = var.backup_operator_subject
}

output "postgres_backup_storage_ceiling_rub" {
  description = "Approved monthly backup storage soft ceiling in RUB."
  value       = var.backup_storage_ceiling_rub
}

output "instance_id" {
  description = "Production Compute instance."
  value       = yandex_compute_instance.production.id
}

output "instance_fqdn" {
  description = "Provider-assigned instance FQDN."
  value       = yandex_compute_instance.production.fqdn
}

output "postgres_data_disk_id" {
  description = "Protected standalone PostgreSQL data disk."
  value       = yandex_compute_disk.postgres.id
}

output "ubuntu_image_id" {
  description = "Resolved Ubuntu 24.04 LTS image used for the current instance plan."
  value       = data.yandex_compute_image.ubuntu.id
}

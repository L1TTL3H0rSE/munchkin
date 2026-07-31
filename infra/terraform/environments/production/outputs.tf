output "runtime_service_account_id" {
  description = "Keyless service account attached to the production instance."
  value       = data.yandex_iam_service_account.runtime.id
}

output "container_registry_id" {
  description = "Private registry used by future immutable image pipelines."
  value       = yandex_container_registry.production.id
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

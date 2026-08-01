data "yandex_compute_image" "ubuntu" {
  folder_id = "standard-images"
  family    = "ubuntu-2404-lts"
}

resource "yandex_compute_disk" "postgres" {
  folder_id   = local.folder_id
  name        = "munchkin-prod-postgres"
  description = "Persistent PostgreSQL data disk for the production host."
  type        = "network-ssd"
  zone        = local.default_zone
  size        = 20
  labels      = local.common_labels

  lifecycle {
    prevent_destroy = true
  }
}

resource "yandex_compute_instance" "production" {
  folder_id                 = local.folder_id
  name                      = "munchkin-prod"
  description               = "Single production host for the Munchkin application."
  hostname                  = "munchkin"
  zone                      = local.default_zone
  platform_id               = "standard-v3"
  service_account_id        = data.yandex_iam_service_account.runtime.id
  allow_stopping_for_update = true
  labels                    = local.common_labels

  resources {
    cores         = 2
    core_fraction = 50
    memory        = 4
  }

  boot_disk {
    auto_delete = true

    initialize_params {
      image_id = data.yandex_compute_image.ubuntu.id
      size     = 35
      type     = "network-ssd"
    }
  }

  secondary_disk {
    disk_id     = yandex_compute_disk.postgres.id
    device_name = "munchkin-data"
    mode        = "READ_WRITE"
    auto_delete = false
  }

  network_interface {
    subnet_id          = yandex_vpc_subnet.production.id
    nat                = true
    nat_ip_address     = yandex_vpc_address.production.external_ipv4_address[0].address
    security_group_ids = [yandex_vpc_security_group.production.id]
  }

  metadata = {
    serial-port-enable = "1"
    user-data = templatefile("${path.module}/cloud-init.yaml.tftpl", {
      ssh_public_key         = trimspace(var.ssh_public_key)
      ssh_ingress_cidrs_json = jsonencode(var.ssh_ingress_cidrs)
    })
  }
}

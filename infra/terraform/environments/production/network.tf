resource "yandex_vpc_network" "production" {
  folder_id   = local.folder_id
  name        = "munchkin-prod"
  description = "Dedicated production network for the single Munchkin host."
  labels      = local.common_labels
}

resource "yandex_vpc_subnet" "production" {
  folder_id      = local.folder_id
  name           = "munchkin-prod-ru-central1-d"
  description    = "Single-zone production subnet."
  zone           = local.default_zone
  network_id     = yandex_vpc_network.production.id
  v4_cidr_blocks = ["10.42.0.0/24"]
  labels         = local.common_labels
}

resource "yandex_vpc_security_group" "production" {
  folder_id   = local.folder_id
  name        = "munchkin-prod"
  description = "Public HTTPS edge and owner-restricted SSH for the production host."
  network_id  = yandex_vpc_network.production.id
  labels      = local.common_labels

  ingress {
    description    = "Owner SSH"
    protocol       = "TCP"
    port           = 22
    v4_cidr_blocks = var.ssh_ingress_cidrs
  }

  ingress {
    description    = "Public HTTP"
    protocol       = "TCP"
    port           = 80
    v4_cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description    = "Public HTTPS"
    protocol       = "TCP"
    port           = 443
    v4_cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    description    = "Required package, registry and future ACME access"
    protocol       = "ANY"
    v4_cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "yandex_vpc_address" "production" {
  folder_id           = local.folder_id
  name                = "munchkin-prod"
  description         = "Reserved public IPv4 for the production host."
  deletion_protection = true
  labels              = local.common_labels

  external_ipv4_address {
    zone_id = local.default_zone
  }
}

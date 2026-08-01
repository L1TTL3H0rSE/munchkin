resource "yandex_dns_zone" "production" {
  folder_id           = local.folder_id
  name                = "munchkin-production"
  description         = "Authoritative public DNS zone for the Munchkin production hostname."
  zone                = "${trimsuffix(var.domain_zone, ".")}."
  public              = true
  deletion_protection = true
  labels              = merge(local.common_labels, { component = "dns" })
}

resource "yandex_dns_recordset" "production" {
  zone_id = yandex_dns_zone.production.id
  name    = "${trimsuffix(var.production_hostname, ".")}."
  type    = "A"
  ttl     = 300
  data    = [yandex_vpc_address.production.external_ipv4_address[0].address]
}

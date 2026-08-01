resource "yandex_container_registry" "production" {
  folder_id = local.folder_id
  name      = "munchkin-prod"
  labels    = local.common_labels

  lifecycle {
    prevent_destroy = true
  }
}

resource "yandex_container_repository" "game" {
  name = "${yandex_container_registry.production.id}/game"

  lifecycle {
    prevent_destroy = true
  }
}

resource "yandex_container_repository" "web" {
  name = "${yandex_container_registry.production.id}/web"

  lifecycle {
    prevent_destroy = true
  }
}

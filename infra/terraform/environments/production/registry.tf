resource "yandex_container_registry" "production" {
  folder_id = local.folder_id
  name      = "munchkin-prod"
  labels    = local.common_labels
}

resource "yandex_container_repository" "game" {
  name = "${yandex_container_registry.production.id}/game"
}

resource "yandex_container_repository" "web" {
  name = "${yandex_container_registry.production.id}/web"
}

data "yandex_iam_service_account" "runtime" {
  folder_id = local.folder_id
  name      = "munchkin-runtime"
}

data "yandex_iam_service_account" "github_images" {
  folder_id = local.folder_id
  name      = "munchkin-github-images"
}

resource "yandex_container_registry_iam_binding" "runtime_puller" {
  registry_id = yandex_container_registry.production.id
  role        = "container-registry.images.puller"
  members = [
    "serviceAccount:${data.yandex_iam_service_account.runtime.id}",
  ]
}

resource "yandex_container_registry_iam_binding" "github_images_pusher" {
  registry_id = yandex_container_registry.production.id
  role        = "container-registry.images.pusher"
  members = [
    "serviceAccount:${data.yandex_iam_service_account.github_images.id}",
  ]
}

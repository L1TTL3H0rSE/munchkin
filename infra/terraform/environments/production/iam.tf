data "yandex_iam_service_account" "runtime" {
  folder_id = local.folder_id
  name      = "munchkin-runtime"
}

resource "yandex_container_registry_iam_binding" "runtime_puller" {
  registry_id = yandex_container_registry.production.id
  role        = "container-registry.images.puller"
  members = [
    "serviceAccount:${data.yandex_iam_service_account.runtime.id}",
  ]
}

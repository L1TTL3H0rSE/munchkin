resource "yandex_lockbox_secret" "production" {
  folder_id           = local.folder_id
  name                = "munchkin-production-runtime"
  description         = "Metadata-only runtime secret container; payload is owner-managed outside Terraform."
  deletion_protection = true
  labels              = merge(local.common_labels, { component = "runtime-secrets" })
}

resource "yandex_lockbox_secret_iam_member" "runtime_viewer" {
  secret_id = yandex_lockbox_secret.production.id
  role      = "viewer"
  member    = "serviceAccount:${data.yandex_iam_service_account.runtime.id}"
}

locals {
  github_oidc_issuer   = "https://token.actions.githubusercontent.com"
  github_oidc_jwks_url = "https://token.actions.githubusercontent.com/.well-known/jwks"
  github_oidc_audience = "https://github.com/L1TTL3H0rSE"
  github_oidc_subject  = "repo:L1TTL3H0rSE@32160016/munchkin@1316069622:environment:production-images"
}

resource "yandex_iam_service_account" "github_images" {
  folder_id   = local.folder_id
  name        = "munchkin-github-images"
  description = "Keyless GitHub Actions identity for immutable image publication."

  lifecycle {
    prevent_destroy = true
  }
}

resource "yandex_iam_workload_identity_oidc_federation" "github_actions" {
  name        = "munchkin-github-actions"
  folder_id   = local.folder_id
  description = "Exact GitHub Actions production-images trust for Munchkin image publication."
  disabled    = false
  audiences   = [local.github_oidc_audience]
  issuer      = local.github_oidc_issuer
  jwks_url    = local.github_oidc_jwks_url

  labels = {
    managed_by = "terraform"
    purpose    = "github-actions-images"
  }

  lifecycle {
    prevent_destroy = true
  }
}

resource "yandex_iam_workload_identity_federated_credential" "github_images" {
  service_account_id  = yandex_iam_service_account.github_images.id
  federation_id       = yandex_iam_workload_identity_oidc_federation.github_actions.id
  external_subject_id = local.github_oidc_subject

  lifecycle {
    prevent_destroy = true
  }
}

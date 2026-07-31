locals {
  cloud_id              = "b1gppf0332cb1uanlrqf"
  folder_id             = "b1g55l8i2mtpv23b5ql7"
  default_zone          = "ru-central1-d"
  state_bucket_name     = "munchkin-prod-tfstate-b1g55l8i2mtpv23b5ql7"
  operator_principal_id = split(":", var.operator_subject)[1]

  deployer_folder_roles = toset([
    "compute.editor",
    "container-registry.admin",
    "vpc.privateAdmin",
    "vpc.publicAdmin",
    "vpc.securityGroups.admin",
  ])
  state_keys = [
    "bootstrap/terraform.tfstate",
    "environments/production/terraform.tfstate",
    "tests/state-lock/terraform.tfstate",
  ]
  lock_keys     = [for key in local.state_keys : "${key}.tflock"]
  list_prefixes = concat(local.state_keys, local.lock_keys)
  state_object_arns = [
    for key in local.state_keys :
    "arn:aws:s3:::${local.state_bucket_name}/${key}"
  ]
  lock_object_arns = [
    for key in local.lock_keys :
    "arn:aws:s3:::${local.state_bucket_name}/${key}"
  ]
}

resource "yandex_iam_service_account" "terraform_deployer" {
  folder_id   = local.folder_id
  name        = "munchkin-terraform-deployer"
  description = "Short-lived-token identity for reviewed Munchkin infrastructure changes."

  lifecycle {
    prevent_destroy = true
  }
}

resource "yandex_iam_service_account" "state_backend" {
  folder_id   = local.folder_id
  name        = "munchkin-terraform-state"
  description = "Dedicated Object Storage backend identity; no runtime or folder-wide role."

  lifecycle {
    prevent_destroy = true
  }
}

resource "yandex_iam_service_account" "runtime" {
  folder_id   = local.folder_id
  name        = "munchkin-runtime"
  description = "Keyless runtime identity attached only to the production Compute instance."

  lifecycle {
    prevent_destroy = true
  }
}

resource "yandex_resourcemanager_folder_iam_member" "terraform_deployer" {
  for_each = local.deployer_folder_roles

  folder_id = local.folder_id
  role      = each.value
  member    = "serviceAccount:${yandex_iam_service_account.terraform_deployer.id}"
}

resource "yandex_iam_service_account_iam_member" "terraform_deployer_can_use_runtime" {
  service_account_id = yandex_iam_service_account.runtime.id
  role               = "iam.serviceAccounts.user"
  member             = "serviceAccount:${yandex_iam_service_account.terraform_deployer.id}"
}

resource "yandex_iam_service_account_iam_member" "operator_can_impersonate_deployer" {
  service_account_id = yandex_iam_service_account.terraform_deployer.id
  role               = "iam.serviceAccounts.tokenCreator"
  member             = var.operator_subject
}

resource "yandex_kms_symmetric_key" "terraform_state" {
  folder_id           = local.folder_id
  name                = "munchkin-terraform-state"
  description         = "KMS key dedicated to encrypted Munchkin Terraform state."
  default_algorithm   = "AES_256"
  rotation_period     = "8760h"
  deletion_protection = true

  lifecycle {
    prevent_destroy = true
  }
}

resource "yandex_kms_symmetric_key_iam_member" "state_backend" {
  symmetric_key_id = yandex_kms_symmetric_key.terraform_state.id
  role             = "kms.keys.encrypterDecrypter"
  member           = "serviceAccount:${yandex_iam_service_account.state_backend.id}"
}

resource "yandex_storage_bucket" "terraform_state" {
  bucket        = local.state_bucket_name
  folder_id     = local.folder_id
  force_destroy = false

  anonymous_access_flags {
    read        = false
    list        = false
    config_read = false
  }

  versioning {
    enabled = true
  }

  server_side_encryption_configuration {
    rule {
      apply_server_side_encryption_by_default {
        kms_master_key_id = yandex_kms_symmetric_key.terraform_state.id
        sse_algorithm     = "aws:kms"
      }
    }
  }

  lifecycle {
    prevent_destroy = true
  }
}

# Yandex requires storage.configurer in addition to the KMS key role when
# working with a KMS-encrypted bucket. This role is configuration-only and does
# not satisfy the initial IAM/ACL gate for object data. Scope it to this
# dedicated bucket: it can still change bucket policy/encryption and is
# therefore a trusted control-plane boundary, while object policy grants remain
# exact-key below.
resource "yandex_storage_bucket_iam_binding" "state_backend_configurer" {
  bucket = yandex_storage_bucket.terraform_state.bucket
  role   = "storage.configurer"
  members = [
    "serviceAccount:${yandex_iam_service_account.state_backend.id}",
  ]
}

# Object Storage evaluates IAM/bucket ACL before bucket policy. Terraform's
# lock lifecycle requires read, upload, and delete, so the smallest suitable
# built-in data role is storage.editor. Keep it bucket-scoped and rely on the
# exact-key policy below as the second gate. The static-key identity remains a
# trusted principal because configurer already lets it rewrite that policy.
resource "yandex_storage_bucket_iam_binding" "state_backend_editor" {
  bucket = yandex_storage_bucket.terraform_state.bucket
  role   = "storage.editor"
  members = [
    "serviceAccount:${yandex_iam_service_account.state_backend.id}",
  ]
}

resource "yandex_storage_bucket_policy" "terraform_state" {
  bucket = yandex_storage_bucket.terraform_state.bucket
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      # Trusted control-plane administrator: no object ARN is granted directly,
      # but policy/config management can change future access and availability.
      {
        Sid    = "ManageBucketConfigurationWithoutObjectAccess"
        Effect = "Allow"
        Principal = {
          CanonicalUser = local.operator_principal_id
        }
        Action   = "s3:*"
        Resource = "arn:aws:s3:::${local.state_bucket_name}"
      },
      {
        Sid    = "ReadBucketLocation"
        Effect = "Allow"
        Principal = {
          CanonicalUser = yandex_iam_service_account.state_backend.id
        }
        Action   = "s3:GetBucketLocation"
        Resource = "arn:aws:s3:::${local.state_bucket_name}"
      },
      {
        Sid    = "ListOnlyStatePrefixes"
        Effect = "Allow"
        Principal = {
          CanonicalUser = yandex_iam_service_account.state_backend.id
        }
        Action   = "s3:ListBucket"
        Resource = "arn:aws:s3:::${local.state_bucket_name}"
        Condition = {
          StringEquals = {
            "s3:prefix" = local.list_prefixes
          }
        }
      },
      {
        Sid    = "ReadWriteExactStateObjects"
        Effect = "Allow"
        Principal = {
          CanonicalUser = yandex_iam_service_account.state_backend.id
        }
        Action = [
          "s3:GetObject",
          "s3:GetObjectVersion",
          "s3:PutObject",
        ]
        Resource = local.state_object_arns
      },
      {
        Sid    = "ManageExactLockObjects"
        Effect = "Allow"
        Principal = {
          CanonicalUser = yandex_iam_service_account.state_backend.id
        }
        Action = [
          "s3:DeleteObject",
          "s3:GetObject",
          "s3:PutObject",
        ]
        Resource = local.lock_object_arns
      },
    ]
  })

  depends_on = [
    yandex_kms_symmetric_key_iam_member.state_backend,
    yandex_storage_bucket_iam_binding.state_backend_configurer,
    yandex_storage_bucket_iam_binding.state_backend_editor,
  ]
}

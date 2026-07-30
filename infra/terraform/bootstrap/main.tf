locals {
  cloud_id          = "b1gppf0332cb1uanlrqf"
  folder_id         = "b1g55l8i2mtpv23b5ql7"
  default_zone      = "ru-central1-d"
  state_bucket_name = "munchkin-prod-tfstate-b1g55l8i2mtpv23b5ql7"

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

resource "yandex_storage_bucket_policy" "terraform_state" {
  bucket = yandex_storage_bucket.terraform_state.bucket
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "ReadBucketLocation"
        Effect = "Allow"
        Principal = {
          CanonicalUser = yandex_iam_service_account.state_backend.id
        }
        Action   = ["s3:GetBucketLocation"]
        Resource = ["arn:aws:s3:::${local.state_bucket_name}"]
      },
      {
        Sid    = "ListOnlyStatePrefixes"
        Effect = "Allow"
        Principal = {
          CanonicalUser = yandex_iam_service_account.state_backend.id
        }
        Action = [
          "s3:ListBucket",
        ]
        Resource = ["arn:aws:s3:::${local.state_bucket_name}"]
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
  ]
}

locals {
  backup_bucket_name     = "munchkin-production-backups-${local.folder_id}"
  backup_daily_prefix    = "munchkin/postgres/daily/"
  backup_weekly_prefix   = "munchkin/postgres/weekly/"
  backup_manifest_prefix = "munchkin/postgres/manifests/"
}

resource "yandex_kms_symmetric_key" "postgres_backup" {
  folder_id           = local.folder_id
  name                = "munchkin-postgres-backups"
  description         = "KMS key dedicated to encrypted off-host PostgreSQL backups."
  default_algorithm   = "AES_256"
  rotation_period     = "8760h"
  deletion_protection = true

  labels = merge(local.common_labels, { component = "postgres-backup" })

  lifecycle {
    prevent_destroy = true
  }
}

resource "yandex_storage_bucket" "postgres_backups" {
  bucket                  = local.backup_bucket_name
  folder_id               = local.folder_id
  force_destroy           = false
  disabled_statickey_auth = true

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
        kms_master_key_id = yandex_kms_symmetric_key.postgres_backup.id
        sse_algorithm     = "aws:kms"
      }
    }
  }

  lifecycle_rule {
    id      = "retain-seven-daily"
    enabled = true

    filter {
      prefix = local.backup_daily_prefix
    }

    expiration {
      days = 8
    }
  }

  lifecycle_rule {
    id      = "retain-four-weekly"
    enabled = true

    filter {
      prefix = local.backup_weekly_prefix
    }

    expiration {
      days = 35
    }
  }

  lifecycle_rule {
    id                                     = "abort-incomplete-multipart"
    enabled                                = true
    abort_incomplete_multipart_upload_days = 1

    filter {
      prefix = ""
    }
  }

  tags = merge(local.common_labels, { component = "postgres-backup" })

  lifecycle {
    prevent_destroy = true
  }
}

# The VM's existing keyless runtime identity can upload and read-back objects,
# but cannot delete objects or configure the bucket. Terraform's provider
# identity remains the separately reviewed provisioning/configuration actor.
resource "yandex_storage_bucket_iam_binding" "postgres_backup_uploader" {
  bucket = yandex_storage_bucket.postgres_backups.bucket
  role   = "storage.uploader"
  members = [
    "serviceAccount:${data.yandex_iam_service_account.runtime.id}",
  ]
}

# Restore access is deliberately absent until the owner supplies a separate
# interactive operator subject. An empty value creates no reader binding.
resource "yandex_storage_bucket_iam_binding" "postgres_backup_viewer" {
  count  = trimspace(var.backup_operator_subject) == "" ? 0 : 1
  bucket = yandex_storage_bucket.postgres_backups.bucket
  role   = "storage.viewer"
  members = [
    trimspace(var.backup_operator_subject),
  ]
}

resource "yandex_kms_symmetric_key_iam_member" "postgres_backup_uploader" {
  symmetric_key_id = yandex_kms_symmetric_key.postgres_backup.id
  role             = "kms.keys.encrypter"
  member           = "serviceAccount:${data.yandex_iam_service_account.runtime.id}"
}

resource "yandex_kms_symmetric_key_iam_member" "postgres_backup_operator" {
  count            = trimspace(var.backup_operator_subject) == "" ? 0 : 1
  symmetric_key_id = yandex_kms_symmetric_key.postgres_backup.id
  role             = "kms.keys.decrypter"
  member           = trimspace(var.backup_operator_subject)
}

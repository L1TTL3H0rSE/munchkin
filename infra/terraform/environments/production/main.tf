locals {
  cloud_id     = "b1gppf0332cb1uanlrqf"
  folder_id    = "b1g55l8i2mtpv23b5ql7"
  default_zone = "ru-central1-d"

  common_labels = {
    environment = "production"
    managed_by  = "terraform"
    project     = "munchkin"
  }
}

variable "operator_subject" {
  type        = string
  description = "IAM subject allowed to impersonate the Terraform deployer service account."
  nullable    = false

  validation {
    condition = can(regex(
      "^(userAccount|federatedUser):[a-z0-9]+$",
      var.operator_subject,
    ))
    error_message = "operator_subject must be userAccount:<id> or federatedUser:<id>."
  }
}

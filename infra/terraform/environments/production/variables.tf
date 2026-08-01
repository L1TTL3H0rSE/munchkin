variable "ssh_public_key" {
  type        = string
  description = "Owner ED25519 public key for the trusted human bootstrap user."
  nullable    = false
  sensitive   = true

  validation {
    condition = can(regex(
      "^ssh-ed25519 [A-Za-z0-9+/]+={0,3}( [^\\r\\n]+)?$",
      trimspace(var.ssh_public_key),
    ))
    error_message = "ssh_public_key must contain exactly one OpenSSH ED25519 public key."
  }
}

variable "ssh_ingress_cidrs" {
  type        = set(string)
  description = "Explicit owner IPv4 CIDRs allowed to reach TCP 22."
  nullable    = false
  sensitive   = true

  validation {
    condition = length(var.ssh_ingress_cidrs) > 0 && alltrue([
      for cidr in var.ssh_ingress_cidrs :
      can(cidrnetmask(cidr)) && cidr != "0.0.0.0/0"
    ])
    error_message = "ssh_ingress_cidrs must contain valid IPv4 CIDRs and must not include 0.0.0.0/0."
  }
}

variable "domain_zone" {
  type        = string
  description = "Authoritative public DNS zone without a required trailing dot."
  nullable    = false
  default     = "l1ttl3h0rse.ru"

  validation {
    condition     = can(regex("^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$", var.domain_zone))
    error_message = "domain_zone must be a lowercase DNS name without a wildcard."
  }
}

variable "production_hostname" {
  type        = string
  description = "Exact public hostname routed by Traefik and represented in DNS."
  nullable    = false
  default     = "munchkin.l1ttl3h0rse.ru"

  validation {
    condition     = can(regex("^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$", var.production_hostname))
    error_message = "production_hostname must be a lowercase DNS name without a wildcard."
  }
}

variable "monium_project" {
  type        = string
  description = "Public Monium project label; defaults to the production folder project and never contains a credential."
  nullable    = false
  default     = ""

  validation {
    condition = trimspace(var.monium_project) == "" || can(regex(
      "^folder__[a-z0-9]+$",
      trimspace(var.monium_project),
    ))
    error_message = "monium_project must be empty or a folder__<id> project label."
  }
}

variable "monium_api_key_expiry_days" {
  type        = number
  description = "Owner-managed maximum lifetime for the separately inserted Monium API key. The key is not a Terraform resource."
  nullable    = false
  default     = 90

  validation {
    condition     = floor(var.monium_api_key_expiry_days) == var.monium_api_key_expiry_days && var.monium_api_key_expiry_days >= 1 && var.monium_api_key_expiry_days <= 90
    error_message = "monium_api_key_expiry_days must be an integer between 1 and 90 days."
  }
}

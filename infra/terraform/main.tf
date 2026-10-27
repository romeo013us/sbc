terraform {
  required_version = ">= 1.6.0"
}

variable "region" { type = string, default = "us-east-1" }
variable "secondary_regions" { type = list(string), default = [] }
variable "database_endpoint" { type = string, default = "" }
variable "read_replica_endpoint" { type = string, default = "" }
variable "redis_endpoint" { type = string, default = "" }
variable "rabbitmq_endpoint" { type = string, default = "" }
variable "otel_endpoint" { type = string, default = "" }
variable "oidc_issuer" { type = string, default = "" }

output "sbc_region" { value = var.region }
output "active_active_regions" { value = var.secondary_regions }
output "activation_required" { value = true }

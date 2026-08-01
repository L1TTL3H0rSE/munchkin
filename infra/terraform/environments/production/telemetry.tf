locals {
  monium_project = trimspace(var.monium_project) == "" ? "folder__${local.folder_id}" : trimspace(var.monium_project)
  monium_cluster = "production"

  monium_api_key_scopes = [
    "yc.monium.metrics.write",
    "yc.monium.traces.write",
  ]

  monium_dashboard_queries = {
    request_rate  = "series_sum({project=\"${local.monium_project}\", cluster=\"${local.monium_cluster}\", service=\"munchkin-game|munchkin-web\", env=\"production\", name=\"http.server.request.count\"})"
    http_5xx      = "series_sum({project=\"${local.monium_project}\", cluster=\"${local.monium_cluster}\", service=\"munchkin-game|munchkin-web\", env=\"production\", name=\"http.server.request.count\", http.response.status_class=\"5xx\"})"
    http_4xx      = "series_sum({project=\"${local.monium_project}\", cluster=\"${local.monium_cluster}\", service=\"munchkin-game|munchkin-web\", env=\"production\", name=\"http.server.request.count\", http.response.status_class=\"4xx\"})"
    http_p95      = "histogram_percentile(95, {project=\"${local.monium_project}\", cluster=\"${local.monium_cluster}\", service=\"munchkin-game|munchkin-web\", env=\"production\", name=\"http.server.request.duration\"})"
    readiness_5xx = "series_sum({project=\"${local.monium_project}\", cluster=\"${local.monium_cluster}\", service=\"munchkin-game\", env=\"production\", name=\"http.server.request.count\", http.route.class=\"health_ready\", http.response.status_class=\"5xx\"})"
    readiness_2xx = "series_sum({project=\"${local.monium_project}\", cluster=\"${local.monium_cluster}\", service=\"munchkin-game\", env=\"production\", name=\"http.server.request.count\", http.route.class=\"health_ready\", http.response.status_class=\"2xx\"})"
    interactions  = "series_sum({project=\"${local.monium_project}\", cluster=\"${local.monium_cluster}\", service=\"munchkin-game\", env=\"production\", name=\"game.interaction.response.count\"})"
    timeouts      = "series_sum({project=\"${local.monium_project}\", cluster=\"${local.monium_cluster}\", service=\"munchkin-game\", env=\"production\", name=\"game.interaction.timeout.count\"})"
  }
}

resource "yandex_iam_service_account" "monium_writer" {
  folder_id   = local.folder_id
  name        = "munchkin-monium-writer"
  description = "Dedicated keyless identity for production Monium metrics and traces ingestion."
  labels      = merge(local.common_labels, { component = "telemetry" })

  lifecycle {
    prevent_destroy = true
  }
}

resource "yandex_resourcemanager_folder_iam_member" "monium_metrics_writer" {
  folder_id = local.folder_id
  role      = "monium.metrics.writer"
  member    = "serviceAccount:${yandex_iam_service_account.monium_writer.id}"
}

resource "yandex_resourcemanager_folder_iam_member" "monium_traces_writer" {
  folder_id = local.folder_id
  role      = "monium.traces.writer"
  member    = "serviceAccount:${yandex_iam_service_account.monium_writer.id}"
}

resource "yandex_monitoring_dashboard" "production" {
  folder_id   = local.folder_id
  name        = "munchkin-production-telemetry"
  title       = "Munchkin production telemetry"
  description = "Low-cardinality metrics for the production API, readiness boundary and bounded gameplay interactions."
  labels      = merge(local.common_labels, { component = "observability" })

  widgets {
    chart {
      title          = "Request rate"
      description    = "Aggregated application request counter."
      display_legend = false
      freeze         = "FREEZE_DURATION_HOUR"
      queries {
        target {
          query = local.monium_dashboard_queries.request_rate
        }
      }
    }
    position {
      h = 10
      w = 12
      x = 0
      y = 0
    }
  }

  widgets {
    chart {
      title          = "HTTP errors"
      description    = "Aggregated 5xx and 4xx request counters."
      display_legend = true
      freeze         = "FREEZE_DURATION_HOUR"
      queries {
        target {
          query = local.monium_dashboard_queries.http_5xx
        }
      }
      queries {
        target {
          query = local.monium_dashboard_queries.http_4xx
        }
      }
    }
    position {
      h = 10
      w = 12
      x = 12
      y = 0
    }
  }

  widgets {
    chart {
      title          = "HTTP p95 latency"
      description    = "Histogram percentile over bounded route and status dimensions."
      display_legend = true
      freeze         = "FREEZE_DURATION_HOUR"
      queries {
        target {
          query = local.monium_dashboard_queries.http_p95
        }
      }
    }
    position {
      h = 10
      w = 12
      x = 0
      y = 10
    }
  }

  widgets {
    chart {
      title          = "Readiness and PostgreSQL dependency"
      description    = "The readiness route is backed by the bounded PostgreSQL probe."
      display_legend = true
      freeze         = "FREEZE_DURATION_HOUR"
      queries {
        target {
          query = local.monium_dashboard_queries.readiness_5xx
        }
      }
      queries {
        target {
          query = local.monium_dashboard_queries.readiness_2xx
        }
      }
    }
    position {
      h = 10
      w = 12
      x = 12
      y = 10
    }
  }

  widgets {
    chart {
      title          = "Bounded gameplay interactions"
      description    = "Allowlisted interaction outcomes and timeout signals only."
      display_legend = true
      freeze         = "FREEZE_DURATION_HOUR"
      queries {
        target {
          query = local.monium_dashboard_queries.interactions
        }
      }
      queries {
        target {
          query = local.monium_dashboard_queries.timeouts
        }
      }
    }
    position {
      h = 10
      w = 12
      x = 0
      y = 20
    }
  }

  widgets {
    text {
      text = "Deploy and migration revision: inspect service.revision on the trace resource and immutable release evidence. Migration contract: health-migrations-v1. Traces: 4d. Metrics without new values: 30d. Logs: disabled."
    }
    position {
      h = 5
      w = 12
      x = 12
      y = 20
    }
  }
}

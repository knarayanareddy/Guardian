import { diag, DiagConsoleLogger, DiagLogLevel, metrics, trace, SpanStatusCode } from "@opentelemetry/api";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { Resource } from "@opentelemetry/resources";
import { SemanticResourceAttributes } from "@opentelemetry/semantic-conventions";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";

type Attributes = Record<string, string | number | boolean | undefined>;

let sdk: NodeSDK | null = null;
let _enabled = false;

// Instruments (created lazily after init)
let runsTotal: ReturnType<ReturnType<typeof metrics.getMeter>["createCounter"]> | null = null;
let runsFailures: ReturnType<ReturnType<typeof metrics.getMeter>["createCounter"]> | null = null;
let runDurationMs: ReturnType<ReturnType<typeof metrics.getMeter>["createHistogram"]> | null = null;

function envTrue(name: string): boolean {
  return (process.env[name] ?? "").toLowerCase() === "true";
}

function getEndpointBase(): string {
  // OTLP/HTTP receiver base (exporters will hit /v1/traces and /v1/metrics)
  return (process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? "http://localhost:4318").replace(/\/$/, "");
}

function parseResourceAttributes(raw: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!raw) return out;
  for (const part of raw.split(",")) {
    const [k, ...rest] = part.split("=");
    const key = (k ?? "").trim();
    const val = rest.join("=").trim();
    if (key && val) out[key] = val;
  }
  return out;
}

export function observabilityEnabled(): boolean {
  return _enabled;
}

export async function initObservability(): Promise<void> {
  if (_enabled) return;

  if (!envTrue("OBSERVABILITY_ENABLED")) {
    return; // No-op when disabled
  }

  _enabled = true;

  // Optional: minimal diag logs
  if (envTrue("OTEL_DIAG_DEBUG")) {
    diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);
  }

  const endpointBase = getEndpointBase();
  const tracesUrl = `${endpointBase}/v1/traces`;
  const metricsUrl = `${endpointBase}/v1/metrics`;

  const serviceName = process.env.OTEL_SERVICE_NAME ?? "guardian";
  const version = process.env.npm_package_version ?? "0.0.0";

  const extraAttrs = parseResourceAttributes(process.env.OTEL_RESOURCE_ATTRIBUTES);

  const { resourceFromAttributes } = await import("@opentelemetry/resources");

  const resource = resourceFromAttributes({
    [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
    [SemanticResourceAttributes.SERVICE_VERSION]: version,
    ...extraAttrs,
  });

  const traceExporter = new OTLPTraceExporter({ url: tracesUrl });
  const metricExporter = new OTLPMetricExporter({ url: metricsUrl });

  const metricReader = new PeriodicExportingMetricReader({
    exporter: metricExporter,
    exportIntervalMillis: 10_000,
  });

  sdk = new NodeSDK({
    resource,
    traceExporter,
    metricReader,
  });

  await sdk.start();

  // Create instruments
  const meter = metrics.getMeter("guardian");
  runsTotal = meter.createCounter("guardian_runs_total", {
    description: "Total run cycles executed",
  });
  runsFailures = meter.createCounter("guardian_run_failures_total", {
    description: "Total run cycles with ok=false",
  });
  runDurationMs = meter.createHistogram("guardian_run_duration_ms", {
    description: "Duration of a run cycle in milliseconds",
    unit: "ms",
  });

  // Clean shutdown
  const shutdown = async () => {
    try {
      await sdk?.shutdown();
    } catch {
      // ignore
    }
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

export async function instrumentRunCycle<T extends { ok: boolean; status?: string; message?: string; errorMessage?: string }>(
  attrs: Attributes,
  fn: () => Promise<T>
): Promise<T> {
  const tracer = trace.getTracer("guardian");
  const start = Date.now();

  return tracer.startActiveSpan(
    "guardian.run",
    { attributes: attrs as Record<string, any> },
    async (span) => {
      try {
        const result = await fn();

        const dur = Date.now() - start;

        // Metrics
        runsTotal?.add(1, {
          ok: String(result.ok),
          status: result.status ?? "unknown",
        });

        if (!result.ok) {
          runsFailures?.add(1, { status: result.status ?? "unknown" });
          span.setStatus({ code: SpanStatusCode.ERROR });
          span.setAttribute("guardian.error", result.errorMessage ?? result.message ?? "unknown");
        } else {
          span.setStatus({ code: SpanStatusCode.OK });
        }

        runDurationMs?.record(dur, {
          ok: String(result.ok),
          status: result.status ?? "unknown",
        });

        // Span attributes
        span.setAttribute("guardian.ok", result.ok);
        if (result.status) span.setAttribute("guardian.status", result.status);
        if (result.message) span.setAttribute("guardian.message", result.message.slice(0, 200));

        span.end();
        return result;
      } catch (err) {
        const dur = Date.now() - start;
        const msg = err instanceof Error ? err.message : String(err);

        runsTotal?.add(1, { ok: "false", status: "exception" });
        runsFailures?.add(1, { status: "exception" });
        runDurationMs?.record(dur, { ok: "false", status: "exception" });

        span.setStatus({ code: SpanStatusCode.ERROR });
        span.setAttribute("guardian.exception", msg.slice(0, 500));
        span.end();

        throw err;
      }
    }
  );
}

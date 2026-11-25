# NVIDIA NeMo Guardrails real SDK acceptance

This standalone lab targets NeMo Guardrails 0.25.0 and the IORails tool-call validation flow, not deprecated Colang dialog execution. It derives the nine permitted review tool names directly from the existing Kim policy. The supplied tool schema binds the argument to one synthetic tenant; no actual business action exists in the adapter.

The dedicated CI job installs the Python SDK in an isolated environment, disables usage telemetry and OpenTelemetry, and executes synthetic checks in a network-disabled Linux namespace. It requires real SDK policy violations for unauthorized tools and tenant/schema mismatches; a crashed SDK is not counted as a successful NVIDIA block. The existing SBC policy remains the final authority. No model or GPU is needed for these structural checks.

Local isolated environment: Python 3.10–3.13, Node 22, pip install nemoguardrails==0.25.0; run python -m unittest discover -s scripts/nvidia_guardrails -p 'test_*.py' -v. Keep the test environment isolated with no credentials and no customer data. Dependency version is pinned at top level; transitive dependencies are not yet fully hash-locked. Do not install this environment in the GoDaddy Node runtime. No runtime enablement, customer-data processing, production authorization, or semantic prompt-injection certification is claimed.

References: https://docs.nvidia.com/nemo/guardrails/v0.25.0/run-guardrailed-inference/using-python-apis/check-messages and https://docs.nvidia.com/nemo/guardrails/configure-guardrails/guardrail-catalog/tool-calling .

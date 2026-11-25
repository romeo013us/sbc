# SBC NVIDIA integration lab V1

This standalone Node 22 client makes actual HTTP requests to the documented NIM API when an operator explicitly enables it on an isolated host. It is not registered as a server route, scheduled task or provider fallback. The default command makes no network calls. Test mocks prove the client protocol, not NVIDIA model performance.

## Start with an already-installed, locally licensed NIM service

Never use a public endpoint, port-forward to a cloud-paid service, production credentials or real customer records. Install the selected NVIDIA runtime separately following its support matrix, model license and capacity checks. No new host or GPU purchase is authorized. Configure an IPv4 loopback service; use the exact served NVIDIA model ID. Optional embedding service can be at a distinct local port.

```sh
node enterprise/sbc-nvidia-lab.cjs
# Explicit opt-in on the isolated lab host only:
SBC_NVIDIA_LAB_ENABLED=1 \
SBC_NVIDIA_NIM_URL=http://127.0.0.1:8000 \
SBC_NVIDIA_NIM_MODEL='<served NVIDIA model ID>' \
node enterprise/sbc-nvidia-lab.cjs
```

For Retriever also set SBC_NVIDIA_EMBED_URL and SBC_NVIDIA_EMBED_MODEL. Synthetic fixed prompts only. No credentials, redirects, tool execution, raw vectors or generated text are emitted. Readiness and model discovery precede inference. Responses and time are bounded. One successful probe is not model authenticity attestation, production readiness or proof of zero infrastructure cost.

## Ten-component acceptance register

| Technology | Current integration boundary | Next evidence |
|---|---|---|
| Agent Toolkit / Relay | Factory advisory contracts; deprecated Toolkit not installed | Relay SDK compatibility, redacted OTel tracing, lifecycle evaluation |
| Guardrails | SBC least-privilege proposal policy, not NeMo library | isolated Python supported release and real tool-call denial tests |
| AI-Q | Research source-evidence validator, not AI-Q service | self-host research backend with auth, sources and injection tests |
| NemoClaw | Not installed | compatible container host, approved sandbox onboarding |
| OpenShell | Not installed | deny-by-default egress/filesystem and escalation tests |
| Nemotron | NIM client synthetic completion interface | real served model, reasoning quality and model license evidence |
| Retriever | NIM client synthetic embedding interface | real service, tenant-separated retrieval, deletion and recall |
| Riva / Nemotron Speech | EN/ES synthetic WER evaluator | supported GPU/runtime, consent and actual bilingual accuracy |
| NIM | documented HTTP readiness/model/completion/embedding client | real local provider probe |
| CUDA | Not installed | compatible driver/device/runtime and measured GPU benchmark |

Official references: https://docs.nvidia.com/nemo/agent-toolkit/latest/index.html ; https://docs.nvidia.com/nemo/relay/latest/about-nemo-relay/overview ; https://docs.nvidia.com/nemo/guardrails/latest/get-started/installation-guide ; https://docs.nvidia.com/aiq-blueprint/latest/index.html ; https://docs.nvidia.com/nemoclaw/latest/user-guide/openclaw/get-started/prerequisites ; https://docs.nvidia.com/nim/large-language-models/get-started/quickstart ; https://docs.nvidia.com/nim/nemo-retriever/embedding/latest/reference.html ; https://docs.nvidia.com/deeplearning/riva/user-guide/docs/support-matrix/support-matrix.html .

Do not install a deprecated toolkit or add GPU/container dependencies to the GoDaddy web runtime. Existing financial, tenant, writer and consent checks remain authoritative. None of these optional lab capabilities is authorized to execute a business action.

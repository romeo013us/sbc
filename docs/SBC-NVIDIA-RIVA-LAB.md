# SBC Riva bilingual synthetic lab

Python 3.12, nvidia-riva-client 2.28.0, espeak-ng. The actual NVIDIA protobuf and gRPC client sends two fixed generated PCM phrases (en-US, es-US) to an explicitly enabled local speech endpoint. The output contains word error rates and timings only. No microphones, phone recordings, customer data, API keys, or model transcripts are stored. Temporary audio is removed after reading.

Default disabled: python scripts/nvidia_riva/sbc_riva_lab.py. For an isolated host running compatible licensed English and Spanish Riva models, explicitly set SBC_RIVA_LAB_ENABLED=1 and SBC_RIVA_ENDPOINT=127.0.0.1:50051. The loopback endpoint must not proxy to a remote paid service. No provider fallback or automatic retry. The local endpoint is plaintext gRPC for synthetic lab only.

CI installs the actual Riva client and executes the real protocol against a fixture server in a network namespace with loopback enabled. A zero WER from the fixture proves only the scoring and transport contract, not speech model accuracy. Actual model deployment, representative bilingual accuracy, noisy telephone audio, privacy and consent controls, streaming and translation acceptance remain required before Call Center use. No production route, scheduler or service install is introduced.

References: https://docs.nvidia.com/deeplearning/riva/archives/2-24-0/public/tutorials/asr-basics.html ; https://pypi.org/project/nvidia-riva-client/2.28.0/ .

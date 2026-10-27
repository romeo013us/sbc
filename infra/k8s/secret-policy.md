# V32.2.1 Secret Handling Policy

Production credentials are not shipped in application files, ConfigMaps, Docker images, ZIP uploads, or browser code.

Use Kubernetes Secrets, an external secret operator, or the configured encrypted SBC vault for:

- `SBC_ADMIN_PASSWORD`
- `SBC_SESSION_SECRET`
- `SBC_VAULT_KEY`
- `SQUARE_ACCESS_TOKEN`
- `SQUARE_WEBHOOK_SIGNATURE_KEY`
- Twilio credentials
- GoDaddy credentials
- print-vendor credentials
- `OPENAI_API_KEY`
- Microsoft Graph client secret
- `SBC_DEMO_WORKER_TOKEN`

`infra/k8s/configmap.yaml` contains only non-secret configuration. Rotate credentials at the provider before moving them into the production secret store. Never paste live secrets into Git, ZIP files, the browser, or Kim chat.

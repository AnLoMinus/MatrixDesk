# Security Policy

## Reporting a Vulnerability

If you discover a security issue, please report it privately by emailing
`security@matrixdesk.local` with details about the issue and steps to reproduce.
We will respond within 72 hours.

## Supported Versions

Only the latest release is supported with security updates.

## Best Practices

- Never expose API keys to the renderer process.
- Keep `contextIsolation` enabled and `nodeIntegration` disabled.
- Validate all IPC payloads on the main process.

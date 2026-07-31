# Signing and notarization

Local builds and CI builds without secrets are unsigned development builds.
They work, but macOS Gatekeeper and Windows SmartScreen may display a warning.
Never commit certificates or passwords to the repository.

## macOS

You need a **Developer ID Application** certificate, an Apple Developer account,
and notarization credentials. Configure these GitHub secrets:

- `APPLE_CERTIFICATE`: Base64-encoded `.p12` certificate;
- `APPLE_CERTIFICATE_PASSWORD`;
- `APPLE_SIGNING_IDENTITY`;
- `APPLE_ID`, `APPLE_PASSWORD` (an app-specific password), and `APPLE_TEAM_ID`;
  alternatively, use the App Store Connect credentials supported by Tauri.

During a release, Tauri signs the bundle, submits the package to Apple, and
staples the notarization ticket. Reference:
<https://v2.tauri.app/distribute/sign/macos/>.

## Windows

Use a compatible code-signing certificate. For a certificate in the Windows
Certificate Store, configure these values in `src-tauri/tauri.conf.json`:

- `bundle.windows.certificateThumbprint`;
- `bundle.windows.digestAlgorithm` set to `sha256`;
- `bundle.windows.timestampUrl` set to the provider's RFC 3161 service.

For EV certificates, HSMs, or cloud services such as Azure Trusted Signing,
configure `bundle.windows.signCommand` instead and store only the credentials
required by the selected provider in GitHub secrets. The concrete values depend
on that provider and are not included in the repository.

Reference: <https://v2.tauri.app/distribute/sign/windows/>.

## Tauri updater signatures

`TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` sign Tauri
updater artifacts. They are different from operating-system signing
certificates and do not replace Windows or macOS signing. This first version
does not enable automatic updates. If updates are added later, the private key
must remain exclusively in CI secrets.

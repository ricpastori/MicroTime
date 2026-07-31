# Issues and forks

MicroTime is feature-complete and currently in maintenance mode. The project is
not actively seeking new features or general code contributions.

## Issues

Issues are welcome for:

- reproducible bugs;
- broken release packages;
- macOS, Windows, or Linux compatibility problems;
- accessibility problems;
- data-loss or security concerns.

Before opening an issue, search the existing reports. Include the operating
system, MicroTime version, steps to reproduce the problem, expected behavior,
and actual behavior. Never include private backup data, credentials, or other
sensitive information.

Feature requests may be discussed, but they are not part of an active roadmap
and may be closed without implementation.

## Pull requests

Unsolicited pull requests are not expected. A pull request is appropriate only
when explicitly requested by the maintainer in an issue. Other pull requests may
be closed so the original project can remain intentionally small and stable.

## Forking MicroTime

If you want different features, behavior, or design choices, fork the repository
and adapt it to your needs. The MIT license allows reuse and modification under
its terms.

To run a fork locally, install Node.js 22+, npm, stable Rust, and the Tauri 2
prerequisites for your platform. Then run:

```bash
npm install
npm run sounds:generate
npm run check
cargo test --manifest-path src-tauri/Cargo.toml
npm run tauri:dev
```

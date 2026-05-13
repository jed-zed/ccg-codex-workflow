# CCG Quality Gate Rule

Run the bundled quality gates when the scenario matches:

- New module: `/ccg:gen-docs <module-path>`, then `/ccg:verify-module <module-path>`, and `/ccg:verify-security <module-path>` when the module has a security surface.
- Changes over roughly 30 lines: `/ccg:verify-change`, then `/ccg:verify-quality <changed-path>`.
- Auth, authorization, crypto, validation, secrets, file upload, command execution, network boundaries: `/ccg:verify-security <changed-path>`.
- Refactors: `/ccg:verify-change`, `/ccg:verify-quality <refactored-path>`, and security review when relevant.

Quality gates are advisory except for Critical or High findings, which should be fixed before delivery unless the user explicitly accepts the risk.

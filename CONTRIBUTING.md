# Contributing Guidelines — Indian Railways AI Platform
### Standards, Development Workflow & Mission-Critical Railway Safety Principles

---

## 1. Railway Mission-Critical Safety Principles

The software developed in this repository controls operational decisions directly impacting railway passenger safety and high-density freight corridors. All contributors must adhere to the following tenets:

1. **Safety First (IRPWM Compliance)**: Never alter safety thresholds (e.g. downgrading P1 criteria or relaxing cross-department conflict distances) without official sanction from the Railway Board Safety Directorate.
2. **Deterministic Fallbacks**: Every AI prediction model or asynchronous solver must provide a deterministic rule-based fallback if external services fail or time out.
3. **Auditability & Traceability**: Every schedule generated or manual override executed must include structured cryptographic provenance logging.
4. **Zero-Trust Security**: No hardcoded credentials, tokens, or private endpoints in repository code.

---

## 2. Development Workflow

### Step 1: Branch Naming Conventions
Use descriptive prefixes for all Git branches:
- `feat/<feature-name>`: New capabilities (e.g. `feat/vande-bharat-timetable-adapter`)
- `fix/<bug-name>`: Bug fixes and performance patches (e.g. `fix/eaddrinuse-port-release`)
- `ai/<model-update>`: AI model retraining or parameter calibration (e.g. `ai/retrain-priority-rf`)
- `docs/<doc-update>`: Documentation enhancements (e.g. `docs/api-specs`)

### Step 2: Coding Standards

#### JavaScript (Node.js & Frontend)
- **Formatting**: Adhere to ESLint and Prettier standard rules (2 spaces indentation, single quotes, trailing commas).
- **Aesthetics & Performance**: For frontend web components, use semantic HTML5, Vanilla CSS custom properties, and modern typography (`Inter`, `Orbitron`). Avoid unapproved third-party utility bloat.
- **Port Handling**: Never hardcode listening ports in tests; always use ephemeral port `0` (`server.address().port`).

#### Python (AI Microservices)
- **Standards**: Strictly follow **PEP 8**. Use `black` and `isort` for formatting.
- **Type Annotations**: All functions must include comprehensive type hints (`typing.List`, `typing.Dict`, `typing.Optional`).
- **Pydantic Models**: Validate all incoming payloads with Pydantic V2 schemas.

---

## 3. Pre-Commit Quality Gates & Verification

Before submitting a Pull Request, you **MUST** run the master test runner and verify that all 12 test suites pass:

```powershell
node testing/run-all-tests.js
```

### Verification Checklist
- [ ] All 12 test suites pass with 100% green status (`>>> STATUS: ALL TESTS PASSED!`).
- [ ] No regression in defect prioritization scoring or CP-SAT solver benchmarks.
- [ ] Code syntax validated with `node -c <file.js>` and `python -m py_compile <file.py>`.
- [ ] No secrets, private keys, or API tokens committed.
- [ ] All new endpoints documented in `docs/api-specs/`.

---

## 4. Pull Request Process

1. Fork the repository and create your feature branch from `main`.
2. Commit your changes with conventional commit messages:
   ```
   feat(optimizer): introduce dynamic headway buffer for heavy freight rakes
   fix(gateway): resolve port collision during parallel regression testing
   ```
3. Push to your branch and open a Pull Request against `main`.
4. Fill out the PR template with:
   - Summary of changes
   - Railway safety impact assessment
   - Test execution logs from `node testing/run-all-tests.js`
5. Await review from the Lead Railway Systems Engineer and Safety Directorate reviewer.

---

## 5. Security Vulnerability Reporting

If you discover a security vulnerability or critical safety edge case:
- **DO NOT** create a public GitHub issue.
- Email `soc-incident@railnet.gov.in` and `cert-in@cert-in.org.in` immediately with the subject line: `[SECURITY-DISCLOSURE] IR-AI Block Planner`.
- Encrypt your report using the Railway SOC PGP public key published on RailTel Portal.
- Allow 48 hours for the Security Operations Centre to acknowledge and triage the finding.

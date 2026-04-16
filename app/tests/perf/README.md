# Performance Tests

Large-case performance probes land in Phase F.2. The `largeCase.perf.ts`
scaffold in this directory contains the test structure and budget constants
but runs as a `.todo` suite until the fixture seeding infrastructure
(500 documents, 50-instrument battery) is wired in the integration layer.

The three performance targets for v1.0 are:

- Workspace sync completes in under 5 seconds with 500 documents present.
- PDF report generation completes in under 30 seconds for a full case.
- Audit trail tab loads in under 1 second for a case with 10,000 audit rows.

Run with:

```bash
npx vitest run tests/perf/
```

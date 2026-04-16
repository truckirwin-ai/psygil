/**
 * Thin test re-export of the production HARD RULE scanner. The real module
 * lives at app/src/main/publish/hardRuleScan.ts so it can be called by
 * main-process code (publish pipeline, agent runner). This shim preserves
 * the existing test import paths.
 */

export {
  scanForProhibited,
  findProhibited,
  HardRuleViolationError,
  type ScanOptions,
  type HardRuleViolation,
} from '../../src/main/publish/hardRuleScan'

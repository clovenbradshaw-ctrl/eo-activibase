# Sync Compliance Audit

Run a full compliance audit against the Sync Handbook rules.

## Instructions

1. Load the compliance checker:
```javascript
// In browser console or test file
const log = EOEventLog.getLog();
const derivation = EOStateDerivation.get();
const checker = new EOCompliance.ComplianceChecker(log, derivation);
```

2. Run the audit:
```javascript
checker.printReport();
```

3. Check specific rules:
```javascript
checker.checkAxiom0();  // Log Primacy
checker.checkRule1();   // Origin
checker.checkRule2();   // Identity
// ... etc
```

## Quick Summary

```javascript
const summary = checker.getSummary();
console.log(`Level: ${summary.levelName}`);
console.log(`Passed: ${summary.passed}/${summary.passed + summary.failed}`);
```

## What to Look For

- **Level 0**: Critical violations - fix immediately
- **Level 1**: Core compliance - acceptable for internal tools
- **Level 2**: Collaborative compliance - good for team tools
- **Level 3**: Full compliance - ready for production sync

## See Also

- [SYNC_HANDBOOK.md](/SYNC_HANDBOOK.md) - Full rule reference
- [eo_compliance.js](/eo_compliance.js) - Implementation

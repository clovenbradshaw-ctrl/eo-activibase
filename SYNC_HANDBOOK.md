# Sync System Compliance Handbook

> **This document is the authoritative reference for sync system design in this codebase.**
> All changes to data handling, state management, or synchronization MUST comply with these rules.

## Quick Reference Card

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         THE NON-NEGOTIABLES                             │
├─────────────────────────────────────────────────────────────────────────┤
│ AXIOM 0: The event log is THE database. State is always derived.       │
│                                                                         │
│ MUST:                                                                   │
│  ✓ Store ALL changes as immutable events                               │
│  ✓ Include actor, timestamp, context on EVERY event                    │
│  ✓ Derive state from events, never sync state directly                 │
│  ✓ Distinguish Given (raw) from Meant (interpreted) events             │
│  ✓ Support offline operation                                           │
│  ✓ Handle duplicate events idempotently                                │
│  ✓ Represent deletions as tombstone events                             │
│                                                                         │
│ MUST NOT:                                                               │
│  ✗ Implement UPDATE or DELETE on event storage                         │
│  ✗ Strip authorship during sync                                        │
│  ✗ Use wall-clock time as authoritative ordering                       │
│  ✗ Silently resolve conflicts                                          │
│  ✗ Generate Given events from Meant events                             │
│  ✗ Require network for local operations                                │
└─────────────────────────────────────────────────────────────────────────┘
```

## The Three Collapse Modes

Every sync failure traces to one of these:

### Identity Collapse
> "The system decided."

When authorship disappears, responsibility disappears. If you can't answer "who did this?", you have identity collapse.

**Signs:**
- Events with `actor: 'system'` for user actions
- No way to audit who changed what
- "The data just appeared"

### Space Collapse
> "Last write wins."

When concurrent changes are silently merged, you're lying about reality.

**Signs:**
- Offline work disappears after reconnect
- No conflict detection
- Two people edit, one loses

### Time Collapse
> "Current state is all that matters."

When history is overwritten, learning and recovery become impossible.

**Signs:**
- Can't answer "what was the value yesterday?"
- Undo doesn't work correctly
- Deleted items reappear

---

## Axiom 0: Log Primacy

```
The append-only log is the database. Everything else is a view.
```

### What This Means

```javascript
// ❌ WRONG: Mutating state directly
state.records.set(id, newRecord);
history.push({ action: 'updated', id });  // History is secondary

// ✓ CORRECT: Log first, derive state
eventLog.append({
    type: 'given',
    actor: currentUser,
    payload: { action: 'record:update', recordId: id, data: newRecord }
});
// State is automatically derived from log
```

### Implementation

Use `EOEventLog` for all data changes:

```javascript
import { EOEventLog } from './eo_event_log.js';

const log = EOEventLog.getLog();

// All mutations go through append()
log.append({
    type: 'given',
    actor: userId,
    parents: log.getHeads(),
    context: { workspace: 'default', schemaVersion: '1.0' },
    payload: { action: 'record:create', ... }
});
```

### Enforcement

The `EOEventLog` class:
- Has NO `update()` or `delete()` methods
- Validates all events before append
- Rejects events missing required fields

---

## Rule 1: Origin Is Part of the Record

Every event MUST contain:

| Field | Required | Purpose |
|-------|----------|---------|
| `id` | Yes | Globally unique identifier |
| `actor` | Yes | Who created this event |
| `timestamp` | Yes | When (for display, not ordering) |
| `logicalClock` | Yes | Causal ordering |
| `parents` | Yes | DAG structure |
| `context` | Yes | Workspace, device, schema version |

### Event Template

```javascript
{
    id: 'evt_abc123',           // Unique, content-addressable preferred
    type: 'given',              // or 'meant'
    actor: 'user_alice',        // NEVER 'system' for user actions
    timestamp: '2025-01-15T10:30:00Z',
    logicalClock: 42,
    parents: ['evt_prev'],
    context: {
        workspace: 'project_alpha',
        device: 'device_001',
        session: 'sess_789',
        schemaVersion: '1.0'
    },
    payload: { ... }
}
```

### Validation

```javascript
// This validation runs automatically in EOEventLog.append()
if (!event.actor) throw new Error('RULE_1: Missing actor');
if (!event.context?.workspace) throw new Error('RULE_1: Missing context.workspace');
```

---

## Rule 2: Identity Must Not Be Laundered

Sync MUST preserve the original author. The server cannot claim credit.

```javascript
// ❌ WRONG: Server overwrites authorship
function syncToServer(event) {
    return { ...event, actor: 'server' };  // VIOLATION!
}

// ✓ CORRECT: Preserve original actor
function syncToServer(event) {
    return event;  // Send exactly as-is
}
```

### Enforcement

`EOSyncProtocol` validates incoming events:
```javascript
if (!event.actor) {
    reject('RULE_2: Missing actor - identity laundered');
}
```

---

## Rule 3: Capture Before Coordination

Events are recorded locally FIRST. Network is async.

```javascript
// ❌ WRONG: Requires network
async function saveRecord(record) {
    await server.save(record);  // Blocks on network!
}

// ✓ CORRECT: Local first
function saveRecord(record, actor) {
    // 1. Append to local log (always succeeds offline)
    eventLog.append({
        type: 'given',
        actor,
        payload: { action: 'record:create', record }
    });

    // 2. Queue for async sync
    syncQueue.enqueue(event);
}
```

### Implementation

Use `EOPersistence` for local-first storage:

```javascript
const persistence = EOPersistence.init({ backend: 'auto' });
await persistence.connect(eventLog);

// Events are now:
// 1. Appended to memory log
// 2. Persisted to IndexedDB/localStorage
// 3. Queued for sync when online
```

---

## Rule 4: Non-Collapse of Concurrency

Concurrent events MUST remain distinct. Never hide conflicts.

```javascript
// ❌ WRONG: Silent merge
function merge(local, remote) {
    return remote.timestamp > local.timestamp ? remote : local;
}

// ✓ CORRECT: Record the conflict
function merge(local, remote) {
    if (areConcurrent(local, remote)) {
        eventLog.append({
            type: 'given',
            actor: 'system',
            payload: {
                action: 'conflict:detected',
                events: [local.id, remote.id],
                resolution: 'user_required'
            }
        });
        return { status: 'conflict', events: [local, remote] };
    }
}
```

### SUP (Superposition)

Multiple values can coexist when contexts differ:

```javascript
// Cell can have multiple observations
cell.values = [
    { value: 100, context_schema: { method: 'measured', scale: 'individual' } },
    { value: 95,  context_schema: { method: 'declared', scale: 'team' } }
];
// Both are valid! Different contexts = different truths
```

---

## Rule 5: Views Are Local and Disposable

State is NEVER authoritative. It can always be rebuilt.

```javascript
// State derivation
const state = EOStateDerivation.init(eventLog);

// If state is corrupted, just rebuild
state.rebuild();  // Recomputes from log

// Views are per-replica and may differ
// That's fine! The log is the truth.
```

---

## Rule 6: Operations, Not Snapshots

Sync transmits EVENTS, not reconstructed state.

```javascript
// ❌ WRONG: Syncing state
async function sync() {
    const state = getState();
    await server.send({ type: 'state', data: state });
}

// ✓ CORRECT: Syncing events
async function sync() {
    const events = eventLog.getSince(lastSyncClock);
    await server.send({ type: 'events', data: events });
}
```

### Protocol

```
Node A                          Node B
   |                               |
   |------ INV(heads) ------------>|
   |<----- WANT(missing) ----------|
   |------ SEND(events) ---------->|  // Events, not state!
   |<----- ACK --------------------|
```

---

## Rule 7: Failure Is a State

Sync failures are recorded as events, not swallowed.

```javascript
try {
    await syncWithServer();
} catch (err) {
    // Record the failure!
    eventLog.append({
        type: 'given',
        actor: 'system',
        payload: {
            action: 'sync:failure',
            error: err.message,
            failedAt: new Date().toISOString()
        }
    });
}
```

---

## Rule 8: Idempotent Replay

Duplicate events are safe. Re-applying must not create new effects.

```javascript
// EOEventLog handles this automatically
const result1 = eventLog.append(event);
const result2 = eventLog.append(event);  // Same event

// result2.duplicate === true
// Log still has exactly one copy
```

### Content-Addressable IDs

```javascript
// IDs are derived from content
function generateEventId(event) {
    const hash = hashContent(event.payload, event.actor, event.parents);
    return `evt_${hash}`;
}
// Same content = same ID = duplicate detected
```

---

## Rule 9: Revision Without Erasure

Deletion is a NEW EVENT, not removal of old events.

```javascript
// ❌ WRONG: True deletion
function deleteRecord(id) {
    eventLog.events = eventLog.events.filter(e => e.id !== id);
}

// ✓ CORRECT: Tombstone event
function deleteRecord(id, actor, reason) {
    eventLog.append({
        type: 'given',
        actor,
        payload: {
            action: 'tombstone',
            targetId: id,
            reason
        }
    });
}
```

### Supersession

For interpretations (Meant events), use supersession:

```javascript
eventLog.append({
    type: 'meant',
    actor: userId,
    supersedes: originalEventId,  // References what it replaces
    frame: { purpose: 'summary', horizon: 'weekly' },
    provenance: ['evt_source1', 'evt_source2'],
    payload: { summary: 'Updated interpretation...' }
});
// Original event remains! This one takes precedence.
```

---

## Given vs Meant Events

### Given (Raw Records)
- Actions taken: user clicks, API calls
- Observations: sensor readings, imports
- Messages: chat, emails

```javascript
{ type: 'given', payload: { action: 'button:clicked' } }
```

### Meant (Interpretations)
- Summaries, conclusions
- AI outputs
- Tags, classifications

```javascript
{
    type: 'meant',
    frame: { purpose: 'meeting_summary', horizon: 'session' },
    provenance: ['evt_msg1', 'evt_msg2'],  // REQUIRED: source events
    epistemicStatus: 'preliminary',
    payload: { summary: 'Team decided...' }
}
```

### The Separation Rule

```
┌─────────────────────────────────────────────────────────────┐
│  Given events can NEVER be generated from Meant events.    │
│  Meant events MUST always have provenance to Given events. │
└─────────────────────────────────────────────────────────────┘
```

---

## Compliance Checking

### Run Audit

```javascript
const checker = new EOCompliance.ComplianceChecker(eventLog, stateDerivation);
checker.printReport();
```

### Compliance Levels

| Level | Name | Requirements |
|-------|------|--------------|
| 0 | Pre-Conformance | Critical rules violated |
| 1 | Core Conformance | Axiom 0 + Rules 1, 8, 9 |
| 2 | Collaborative | + Rules 2, 3, 4, 5, 6 |
| 3 | Full Conformance | All rules satisfied |

---

## Code Review Checklist

When reviewing PRs, check:

- [ ] **Axiom 0**: Does any code mutate state directly without going through event log?
- [ ] **Rule 1**: Do all events have actor, timestamp, context?
- [ ] **Rule 2**: Is actor preserved through sync operations?
- [ ] **Rule 3**: Can this operation succeed offline?
- [ ] **Rule 4**: Are concurrent changes detected, not hidden?
- [ ] **Rule 5**: Is any state treated as authoritative (should be derived)?
- [ ] **Rule 6**: Does sync send events or state snapshots?
- [ ] **Rule 7**: Are sync failures recorded?
- [ ] **Rule 8**: Would duplicate events cause problems?
- [ ] **Rule 9**: Are deletions true deletes or tombstones?

---

## Anti-Patterns to Watch For

### 1. Direct State Mutation
```javascript
// ❌ BAD
state.records.set(id, record);

// ✓ GOOD
eventLog.append({ payload: { action: 'record:create', ... } });
```

### 2. Anonymous Events
```javascript
// ❌ BAD
{ actor: 'system', payload: { action: 'user_edit' } }

// ✓ GOOD
{ actor: currentUserId, payload: { action: 'cell:edit' } }
```

### 3. Network-Blocking Operations
```javascript
// ❌ BAD
const result = await fetch('/api/save', { body: data });

// ✓ GOOD
eventLog.append(event);  // Local first
syncQueue.enqueue(event);  // Sync later
```

### 4. Silent Conflict Resolution
```javascript
// ❌ BAD
const winner = a.timestamp > b.timestamp ? a : b;

// ✓ GOOD
if (concurrent(a, b)) recordConflict(a, b);
```

### 5. True Deletion
```javascript
// ❌ BAD
events = events.filter(e => e.id !== targetId);

// ✓ GOOD
eventLog.tombstone(targetId, actor, reason);
```

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        User Interface                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     EOStateDerivation                            │
│                   (Derived, Disposable View)                     │
│                                                                  │
│    getState() → computed from log, never authoritative           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        EOEventLog                                │
│                  (THE Source of Truth)                           │
│                                                                  │
│  append() → only way to change data                             │
│  get() → retrieve by ID                                         │
│  tombstone() → delete without erasure                           │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
┌─────────────────────────┐     ┌─────────────────────────────────┐
│     EOPersistence       │     │       EOSyncProtocol            │
│   (Local Storage)       │     │    (Network Sync)               │
│                         │     │                                 │
│  IndexedDB/localStorage │     │  Event-based, conflict-aware    │
│  Offline-first          │     │  Identity-preserving            │
└─────────────────────────┘     └─────────────────────────────────┘
```

---

## File Reference

| File | Purpose | Key Rules |
|------|---------|-----------|
| `eo_event_log.js` | Append-only event store | Axiom 0, Rules 1, 8, 9 |
| `eo_state_derivation.js` | State = f(Log) | Axiom 0, Rule 5 |
| `eo_persistence.js` | Local-first storage | Rules 3, 7 |
| `eo_sync_protocol.js` | Event-based sync | Rules 2, 4, 6, 7 |
| `eo_compliance.js` | Audit & validation | All rules |

---

## Updating This Handbook

This handbook is embedded in the codebase. If you need to update sync behavior:

1. Propose changes to this document first
2. Get consensus on rule modifications
3. Update the code to match
4. Run compliance audit to verify

**Remember: These aren't arbitrary rules. Each prevents a specific class of failures that cause real damage—lost work, broken trust, unrecoverable state.**

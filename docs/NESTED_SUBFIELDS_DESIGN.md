# Nested Subfields Design (OBJECT Field Type)

## Overview

This document describes the **OBJECT field type** - a general-purpose nested record structure that allows any field to contain multiple subfields with their own schema.

Key capabilities:
1. Display as a single "complete" value in a view
2. Expand to reveal individual subfields when clicked
3. Each OBJECT field spawns its own embedded view for managing the nested schema
4. "Split out" subfields into top-level columns (morphing into linked records + lookups)
5. Handle multiple entries (arrays of objects) with cardinality: 'one' or 'many'

---

## Core Concept: The OBJECT Field Type

### What Is an OBJECT Field?

An **OBJECT field** is a field that contains a structured object with named subfields, rather than a single value. Each OBJECT field has its own schema (subfields) that can be managed independently.

```javascript
// Traditional field value
"status": "Active"

// OBJECT field value - single entry
"metadata": {
  _id: "obj_123",
  createdBy: "John",
  source: "Import",
  confidence: 0.95
}

// OBJECT field value - multiple entries (cardinality: 'many')
"addresses": [
  { _id: "obj_1", type: "Home", street: "123 Main St", city: "Boston" },
  { _id: "obj_2", type: "Work", street: "456 Office Blvd", city: "Cambridge" }
]
```

### The Key Insight

**An OBJECT field is secretly a linked record to a hidden/embedded set.** When you create an OBJECT field:
1. An embedded set is created with the subfield schema
2. An embedded view is created for that set
3. The OBJECT field stores inline data OR can be split to use linked record IDs

This unified model means "split out" is just making the embedded set visible.

---

## Design Option 1: Inline Composite Fields

### Schema Definition

```javascript
EOFieldType: 'COMPOSITE'  // New field type

EOFieldSchema: {
  id: 'fld_contact_info',
  name: 'Contact Info',
  type: 'COMPOSITE',
  config: {
    // Subfield definitions (like a mini-schema)
    subfields: [
      { id: 'sf_phone', name: 'Phone', type: 'TEXT' },
      { id: 'sf_email', name: 'Email', type: 'EMAIL' },
      { id: 'sf_address', name: 'Address', type: 'LONG_TEXT' },
      { id: 'sf_preferred', name: 'Preferred', type: 'SELECT',
        options: ['Phone', 'Email', 'Text'] }
    ],
    // How to display in compact form
    displayTemplate: '{Email}',  // or '{Email}, {Phone}'
    // Allow multiple entries?
    cardinality: 'one' | 'many'
  }
}
```

### Value Structure

```javascript
// Single entry (cardinality: 'one')
record.fields['contactInfo'] = {
  sf_phone: '+1-555-123-4567',
  sf_email: 'john@example.com',
  sf_address: '123 Main St, City, ST 12345',
  sf_preferred: 'Email'
}

// Multiple entries (cardinality: 'many')
record.fields['contacts'] = [
  { sf_phone: '+1-555-123-4567', sf_email: 'john@work.com', sf_type: 'Work' },
  { sf_phone: '+1-555-987-6543', sf_email: 'john@home.com', sf_type: 'Home' }
]
```

### Pros/Cons

| Pros | Cons |
|------|------|
| Simple mental model | Data lives inline (not normalized) |
| Fast reads (no joins) | Harder to query across records |
| Works with existing cell structure | Splitting requires migration |

---

## Design Option 2: Implicit Linked Records (Recommended)

### The Insight

Every composite field is **secretly a linked record** to an implicit/embedded set. This unifies the model and makes "splitting out" a natural operation.

### Schema Definition

```javascript
EOFieldSchema: {
  id: 'fld_contact_info',
  name: 'Contact Info',
  type: 'COMPOSITE',  // Renders as composite, but...
  config: {
    // The "hidden" linked set
    embeddedSetSchema: {
      id: 'set_contact_info_embedded',
      name: '_ContactInfo',  // Internal naming convention
      isEmbedded: true,      // Not shown in set sidebar
      schema: [
        { id: 'sf_phone', name: 'Phone', type: 'TEXT' },
        { id: 'sf_email', name: 'Email', type: 'EMAIL' },
        { id: 'sf_address', name: 'Address', type: 'LONG_TEXT' },
        { id: 'sf_preferred', name: 'Preferred', type: 'SELECT' }
      ]
    },
    displayTemplate: '{Email}',
    cardinality: 'one' | 'many'
  }
}
```

### How It Works

1. **Under the hood**: Creates a hidden set `_ContactInfo` with the subfield schema
2. **The composite field**: Is actually a `LINKED_RECORD` to this hidden set
3. **Display**: Renders the linked record(s) using `displayTemplate`
4. **Expansion**: Shows the embedded record's fields in a sub-panel
5. **Splitting**: Simply "surfaces" the hidden set and converts to regular linked record

### The "Split Out" Operation

When user clicks "Split Out Subfields":

```javascript
splitOutSubfields(compositeFieldId) {
  const field = getField(compositeFieldId);
  const embeddedSet = field.config.embeddedSetSchema;

  // 1. Make the embedded set visible
  embeddedSet.isEmbedded = false;
  embeddedSet.name = embeddedSet.name.replace('_', '');  // "ContactInfo"
  addSetToSidebar(embeddedSet);

  // 2. Convert COMPOSITE field to LINKED_RECORD
  field.type = 'LINKED_RECORD';
  field.config = {
    linkedSetId: embeddedSet.id,
    cardinality: field.config.cardinality
  };

  // 3. Add LOOKUP fields for each subfield user wants visible
  for (const subfield of selectedSubfields) {
    addField({
      type: 'LOOKUP',
      name: subfield.name,
      config: {
        sourceFieldId: field.id,
        targetSetId: embeddedSet.id,
        targetFieldId: subfield.id
      }
    });
  }
}
```

### Pros/Cons

| Pros | Cons |
|------|------|
| Unified data model (everything is sets + links) | More complex implementation |
| Split-out is a config change, not data migration | Hidden sets add overhead |
| Works with existing rollup/lookup engine | Need UI to manage embedded sets |
| Natural progression to full relational model | |

---

## Design Option 3: Virtual Subfields (View-Level Only)

### The Concept

Subfields don't exist in the schema—they're defined at the **view level** as virtual projections of a JSON/Object field.

```javascript
// Field stores raw JSON
field: {
  type: 'OBJECT',  // Stores any JSON
  value: { phone: '...', email: '...', address: '...' }
}

// View defines how to "see" subfields
viewColumn: {
  fieldId: 'fld_contact',
  subfield: 'email',  // Project just this key
  name: 'Email'       // Display name
}
```

### Pros/Cons

| Pros | Cons |
|------|------|
| Maximum flexibility | No schema validation |
| Easy to add new subfields | Inconsistent data possible |
| No migration needed | No type safety on subfields |

---

## Recommended Approach: Hybrid Composite Fields

Combine the best of Options 1 and 2:

### 1. COMPOSITE Type with Embedded Set Semantics

```javascript
EOFieldType: 'COMPOSITE'

EOFieldSchema: {
  id: 'fld_contact_info',
  name: 'Contact Info',
  type: 'COMPOSITE',
  config: {
    subfields: [
      { id: 'phone', name: 'Phone', type: 'TEXT', required: false },
      { id: 'email', name: 'Email', type: 'EMAIL', required: true },
      { id: 'address', name: 'Address', type: 'LONG_TEXT' }
    ],
    displayMode: 'template' | 'first' | 'summary',
    displayTemplate: '{email}',
    cardinality: 'one' | 'many',
    // If split, this becomes the set ID
    promotedSetId: null  // Set when "split out" happens
  }
}
```

### 2. Rendering Hierarchy

**Level 1 - Cell (Grid View)**
```
┌─────────────────────────────────────────┐
│ john@example.com              [+2 more] │  ← Compact display
└─────────────────────────────────────────┘
```

**Level 2 - Expansion (Inline or Modal)**
```
┌─────────────────────────────────────────┐
│ Contact Info                    [▼]     │
├─────────────────────────────────────────┤
│ Phone:    +1-555-123-4567              │
│ Email:    john@example.com             │
│ Address:  123 Main St, City, ST        │
│                                         │
│ [+ Add Another] [Split to Table →]     │
└─────────────────────────────────────────┘
```

**Level 3 - Split Out (Becomes Linked Set)**
```
Clients Table                          Contact Info Table (new!)
┌────────┬─────────────────┬────────┐  ┌─────────────────────────┐
│ Name   │ Contact (link)  │ Email  │  │ Phone │ Email │ Address │
├────────┼─────────────────┼────────┤  ├───────┼───────┼─────────┤
│ Acme   │ Contact #1      │ a@b.c  │  │ ...   │ ...   │ ...     │
│ Beta   │ Contact #2, #3  │ x@y.z  │  │ ...   │ ...   │ ...     │
└────────┴─────────────────┴────────┘  └───────┴───────┴─────────┘
          ↑ Linked Record    ↑ Lookup
```

---

## Handling Multiple Entries

### Visual Representation in Grid

For `cardinality: 'many'`:

**Option A: Stacked Chips**
```
┌────────────────────────────────────────┐
│ [Work: john@work.com] [Home: j@h.com]  │
└────────────────────────────────────────┘
```

**Option B: Primary + Count**
```
┌────────────────────────────────────────┐
│ john@work.com                   +1     │
└────────────────────────────────────────┘
```

**Option C: Expandable Row**
```
┌────────────────────────────────────────┐
│ ▶ 2 contacts                           │  ← Collapsed
└────────────────────────────────────────┘

┌────────────────────────────────────────┐
│ ▼ 2 contacts                           │  ← Expanded
│   • Work: john@work.com, +1-555-1234   │
│   • Home: john@home.com, +1-555-5678   │
└────────────────────────────────────────┘
```

### View Configuration

```javascript
EOViewColumn: {
  fieldId: 'fld_contacts',
  // For multi-entry composites
  multiDisplay: {
    mode: 'chips' | 'primary' | 'expandable' | 'count',
    primarySelector: 'first' | 'latest' | { subfield: 'type', value: 'Work' },
    chipTemplate: '{type}: {email}',
    maxVisible: 3
  }
}
```

---

## Distinguishing Entries Across Views

### Problem

When a composite field has multiple entries, how do different views show/filter them?

### Solution: Entry Faceting

Each entry in a multi-value composite can be distinguished by:

1. **Index** - "First", "Second", "Last"
2. **Subfield Value** - "Where type = Work"
3. **Timestamp** - "Most Recent"
4. **Explicit ID** - Each entry has a unique ID

### View-Level Entry Selection

```javascript
EOViewColumn: {
  fieldId: 'fld_contacts',
  type: 'COMPOSITE',
  // Which entry(ies) to show
  entrySelector: {
    mode: 'all' | 'first' | 'filter' | 'aggregate',

    // For mode: 'filter'
    filter: { subfield: 'type', operator: 'equals', value: 'Work' },

    // For mode: 'aggregate'
    aggregation: 'count' | 'list' | 'first' | 'last'
  },
  // Which subfield to display (if showing single subfield)
  displaySubfield: 'email' | null  // null = show formatted composite
}
```

### Example Views

**View: "All Contacts"**
```javascript
{ fieldId: 'fld_contacts', entrySelector: { mode: 'all' }, displaySubfield: null }
// Shows: [Work: john@work.com] [Home: john@home.com]
```

**View: "Work Email Only"**
```javascript
{
  fieldId: 'fld_contacts',
  entrySelector: { mode: 'filter', filter: { subfield: 'type', value: 'Work' } },
  displaySubfield: 'email'
}
// Shows: john@work.com
```

**View: "Contact Count"**
```javascript
{ fieldId: 'fld_contacts', entrySelector: { mode: 'aggregate', aggregation: 'count' } }
// Shows: 2
```

---

## Split-Out Mechanics

### Before Split

```
Clients (Set)
├── Name (TEXT)
├── Contact Info (COMPOSITE) ← Contains phone, email, address
└── Status (SELECT)
```

### After "Split to Table"

```
Clients (Set)
├── Name (TEXT)
├── Contact Info (LINKED_RECORD) → Contact Info (Set)
├── Email (LOOKUP) ← from Contact Info.Email
├── Phone (LOOKUP) ← from Contact Info.Phone
└── Status (SELECT)

Contact Info (Set) [NEW - previously embedded]
├── Phone (TEXT)
├── Email (EMAIL)
├── Address (LONG_TEXT)
└── Client (LINKED_RECORD) → Clients  [back-link]
```

### Split Operation Steps

1. **Create Set** from embedded schema
2. **Migrate Data** - Each composite value becomes a record
3. **Update Field Type** - COMPOSITE → LINKED_RECORD
4. **Create Lookups** - For each "pinned" subfield
5. **Create Back-Link** - Optional reverse relationship
6. **Update Views** - Existing column configs still work

### Provenance Tracking

```javascript
{
  operation: 'SPLIT_COMPOSITE',
  sourceFieldId: 'fld_contact_info',
  createdSetId: 'set_contact_info',
  createdFieldIds: ['fld_email_lookup', 'fld_phone_lookup'],
  timestamp: '2024-01-15T10:30:00Z',
  agent: { type: 'person', id: 'user_123' }
}
```

---

## UI Components Needed

### 1. Composite Field Editor

```
┌─ Contact Info ─────────────────────────┐
│                                        │
│  Phone     [+1-555-123-4567        ]   │
│  Email     [john@example.com       ]   │
│  Address   [123 Main St            ]   │
│            [City, ST 12345         ]   │
│  Preferred (●) Phone (○) Email         │
│                                        │
│  [Save]  [Cancel]                      │
└────────────────────────────────────────┘
```

### 2. Multi-Entry Manager

```
┌─ Contacts (2) ──────────────────────────────────┐
│                                                  │
│  ┌─ Work ─────────────────────────────────┐     │
│  │ Phone: +1-555-123-4567                 │ [×] │
│  │ Email: john@work.com                   │     │
│  └────────────────────────────────────────┘     │
│                                                  │
│  ┌─ Home ─────────────────────────────────┐     │
│  │ Phone: +1-555-987-6543                 │ [×] │
│  │ Email: john@home.com                   │     │
│  └────────────────────────────────────────┘     │
│                                                  │
│  [+ Add Contact]                                │
│                                                  │
│  ─────────────────────────────────────────      │
│  [Split to Separate Table...]                   │
└─────────────────────────────────────────────────┘
```

### 3. Split Wizard

```
┌─ Split "Contact Info" to Table ─────────────────┐
│                                                  │
│  This will:                                      │
│  • Create a new "Contact Info" table            │
│  • Convert existing data to linked records      │
│  • Keep your view layouts intact                │
│                                                  │
│  ─────────────────────────────────────────      │
│                                                  │
│  Subfields to show as columns:                  │
│  [✓] Email                                      │
│  [✓] Phone                                      │
│  [ ] Address                                    │
│  [ ] Preferred                                  │
│                                                  │
│  [Cancel]              [Split to Table →]       │
└─────────────────────────────────────────────────┘
```

### 4. Column Header for Composite Fields

```
┌────────────────────────────────┐
│ Contact Info          ▾  ⋮    │
│ ─────────────────────────────│
│ Show subfield:                │
│   (○) All (compact)           │
│   (●) Email only              │
│   (○) Phone only              │
│ ─────────────────────────────│
│ [Expand All Rows]             │
│ [Split to Table...]           │
└────────────────────────────────┘
```

---

## Integration with Existing Systems

### SUP (Superposition) Compatibility

Composite fields work with SUP when subfields have multiple observations:

```javascript
EOCell: {
  field_name: 'contactInfo',
  values: [
    {
      value: { phone: '+1-555-OLD', email: 'old@email.com' },
      timestamp: '2023-01-01',
      source: 'import_v1'
    },
    {
      value: { phone: '+1-555-NEW', email: 'new@email.com' },
      timestamp: '2024-01-01',
      source: 'manual_update'
    }
  ]
}
```

### Formula Support

```javascript
// Reference subfields in formulas
"{Contact Info.email}"
"{Contact Info.phone}"

// Aggregations across entries
"ARRAYUNIQUE({Contacts.type})"
"COUNTIF({Contacts.type}, 'Work')"
```

### Filter/Sort Support

```javascript
// Filter by subfield value
{
  fieldId: 'fld_contact',
  subfield: 'email',  // Target specific subfield
  operator: 'contains',
  value: '@company.com'
}

// Sort by subfield
{ fieldId: 'fld_contact', subfield: 'email', direction: 'asc' }
```

---

## Type Definitions

```javascript
/**
 * Composite field schema
 * @typedef {Object} EOCompositeFieldConfig
 * @property {EOSubfieldSchema[]} subfields - Subfield definitions
 * @property {'template'|'first'|'summary'} displayMode - How to render in cell
 * @property {string} displayTemplate - Template string like "{email}, {phone}"
 * @property {'one'|'many'} cardinality - Single or multiple entries
 * @property {string|null} promotedSetId - Set ID if split out
 */

/**
 * Subfield schema (mini field definition)
 * @typedef {Object} EOSubfieldSchema
 * @property {string} id - Subfield ID
 * @property {string} name - Display name
 * @property {EOFieldType} type - Field type (TEXT, EMAIL, etc.)
 * @property {boolean} [required] - Is this subfield required
 * @property {Object} [config] - Type-specific config
 */

/**
 * View configuration for composite columns
 * @typedef {Object} EOCompositeViewConfig
 * @property {'all'|'first'|'filter'|'aggregate'} entryMode - Entry selection
 * @property {Object} [entryFilter] - Filter for selecting entries
 * @property {string} [displaySubfield] - Show only this subfield
 * @property {EOMultiDisplayConfig} [multiDisplay] - Multi-entry display options
 */

/**
 * Multi-entry display configuration
 * @typedef {Object} EOMultiDisplayConfig
 * @property {'chips'|'primary'|'expandable'|'count'} mode
 * @property {'first'|'latest'|Object} primarySelector
 * @property {string} chipTemplate
 * @property {number} maxVisible
 */
```

---

## Implementation Phases

### Phase 1: Core COMPOSITE Type
- [ ] Add COMPOSITE to EOFieldType
- [ ] Implement subfield schema storage
- [ ] Basic cell rendering (compact display)
- [ ] Subfield editor in record modal

### Phase 2: Multi-Entry Support
- [ ] cardinality: 'many' support
- [ ] Entry management UI (add/remove/reorder)
- [ ] Multi-display modes (chips, expandable, etc.)
- [ ] Entry IDs and tracking

### Phase 3: View Integration
- [ ] Per-column subfield selection
- [ ] Entry filtering in views
- [ ] Sort by subfield
- [ ] Filter by subfield

### Phase 4: Split-Out Operation
- [ ] Set creation from embedded schema
- [ ] Data migration (composite → linked records)
- [ ] Automatic lookup field creation
- [ ] Provenance tracking for split

### Phase 5: Advanced Features
- [ ] Formula support for subfields
- [ ] Rollup across composite entries
- [ ] SUP integration
- [ ] Import/export handling

---

## Open Questions

1. **Nested Composites** - Can a subfield itself be COMPOSITE? (Probably yes, but limit depth)

2. **Shared Composite Schemas** - Can multiple fields share the same subfield schema? (e.g., "Contact Info" used in both Clients and Vendors)

3. **Subfield-Level Permissions** - Can some subfields be hidden/read-only while others are editable?

4. **Computed Subfields** - Can a subfield be a formula based on other subfields?

5. **Entry Ordering** - Is order of entries significant? Should there be a "primary" flag?

---

## Summary

The recommended approach is **Design Option 2 (Implicit Linked Records)** because:

1. **Unified Mental Model** - Everything is sets and links, just at different visibility levels
2. **Natural Progression** - Split-out is a visibility change, not a data restructure
3. **Existing Infrastructure** - Leverages LINKED_RECORD, LOOKUP, ROLLUP engines
4. **Future-Proof** - Easy to add features like cross-composite queries

The key insight is: **A composite field is a linked record to a set that happens to be hidden.** When you "split out", you're just making that set visible and adding lookup columns.

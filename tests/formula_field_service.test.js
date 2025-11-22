const assert = require('assert');
const FormulaFieldService = require('../formula_field_service');
const FormulaEngine = require('../formula_engine');

function createService() {
  return new FormulaFieldService({ engine: new FormulaEngine() });
}

function runTest(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (error) {
    console.error(`✗ ${name}`);
    console.error(error);
    process.exitCode = 1;
  }
}

runTest('resolves braced references case-insensitively', () => {
  const service = createService();
  const schema = [
    { id: 'client_name', name: 'Client Name', type: 'TEXT' }
  ];
  const record = { client_name: 'Acme Corp' };

  ['{Client Name}', '{client name}', '{CLIENT NAME}'].forEach((formula) => {
    const result = service.evaluateForRecord(formula, record, schema);
    assert.ok(result.success, `Expected success for ${formula}`);
    assert.strictEqual(result.result, 'Acme Corp');
  });
});

runTest('fails to resolve concatenated field name', () => {
  const service = createService();
  const schema = [
    { id: 'client_name', name: 'Client Name', type: 'TEXT' }
  ];
  const record = { client_name: 'Acme Corp' };

  const result = service.evaluateForRecord('{ClientName}', record, schema);
  assert.strictEqual(result.success, false);
  assert.ok(result.error.message.includes('ClientName'));
});

runTest('preview and runtime evaluations stay consistent', () => {
  const previewService = createService();
  const runtimeService = createService();
  const schema = [
    { id: 'amount', name: 'Amount', type: 'NUMBER' },
    { id: 'tax_rate', name: 'Tax Rate', type: 'NUMBER' }
  ];
  const record = { amount: 100, tax_rate: 0.1 };
  const formula = '{amount} + ({Tax Rate} * 10)';

  const previewResult = previewService.evaluateForRecord(formula, record, schema);
  const runtimeResult = runtimeService.evaluateForRecord(formula, record, schema);

  assert.strictEqual(previewResult.success, true);
  assert.strictEqual(runtimeResult.success, true);
  assert.strictEqual(previewResult.result, runtimeResult.result);
});

runTest('autocomplete suggestions only include real schema fields', () => {
  const service = createService();
  const schema = [
    { id: 'visible', name: 'Visible', type: 'TEXT' },
    { id: 'formula_field', name: 'Calculated', type: 'FORMULA' },
    { id: 'virtual_field', name: 'Virtual', type: 'TEXT', virtual: true },
    { id: 'hidden_field', name: 'Hidden', type: 'TEXT', hidden: true }
  ];

  const suggestions = service.getFieldSuggestions(schema);
  assert.deepStrictEqual(suggestions.map(f => f.name), ['Visible']);
});

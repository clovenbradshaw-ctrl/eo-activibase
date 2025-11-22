/**
 * Tests for Formula Field Service
 */

const FormulaFieldService = require('../formula_field_service');
const FormulaEngine = require('../formula_engine');

// Simple test runner
function test(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (error) {
    console.error(`✗ ${name}`);
    console.error(`  ${error.message}`);
    process.exit(1);
  }
}

function assertEquals(actual, expected, message = '') {
  if (actual !== expected) {
    throw new Error(`${message}\n  Expected: ${expected}\n  Actual: ${actual}`);
  }
}

function assertDeepEquals(actual, expected, message = '') {
  const actualStr = JSON.stringify(actual);
  const expectedStr = JSON.stringify(expected);
  if (actualStr !== expectedStr) {
    throw new Error(`${message}\n  Expected: ${expectedStr}\n  Actual: ${actualStr}`);
  }
}

function assertTrue(value, message = '') {
  if (!value) {
    throw new Error(`${message}\n  Expected truthy value, got: ${value}`);
  }
}

console.log('\n=== Formula Engine Tests ===\n');

test('FormulaEngine - Simple arithmetic', () => {
  const engine = new FormulaEngine();
  const result = engine.evaluate('2 + 2');
  assertEquals(result, 4, 'Should evaluate 2 + 2');
});

test('FormulaEngine - Field reference', () => {
  const engine = new FormulaEngine();
  engine.setField('Price', 100);
  const result = engine.evaluate('{Price} * 2');
  assertEquals(result, 200, 'Should evaluate {Price} * 2');
});

test('FormulaEngine - Multiple field references', () => {
  const engine = new FormulaEngine();
  engine.setFields({ Price: 10, Quantity: 5 });
  const result = engine.evaluate('{Price} * {Quantity}');
  assertEquals(result, 50, 'Should calculate price times quantity');
});

test('FormulaEngine - SUM function', () => {
  const engine = new FormulaEngine();
  const result = engine.evaluate('SUM(1, 2, 3, 4, 5)');
  assertEquals(result, 15, 'Should sum numbers');
});

test('FormulaEngine - SUM with field references', () => {
  const engine = new FormulaEngine();
  engine.setFields({ A: 10, B: 20, C: 30 });
  const result = engine.evaluate('SUM({A}, {B}, {C})');
  assertEquals(result, 60, 'Should sum field values');
});

test('FormulaEngine - IF function', () => {
  const engine = new FormulaEngine();
  engine.setField('Score', 85);
  const result = engine.evaluate('IF({Score} >= 80, "Pass", "Fail")');
  assertEquals(result, 'Pass', 'Should return Pass for score >= 80');
});

test('FormulaEngine - CONCATENATE function', () => {
  const engine = new FormulaEngine();
  engine.setFields({ FirstName: 'John', LastName: 'Doe' });
  const result = engine.evaluate('CONCATENATE({FirstName}, " ", {LastName})');
  assertEquals(result, 'John Doe', 'Should concatenate strings');
});

test('FormulaEngine - AVERAGE function', () => {
  const engine = new FormulaEngine();
  const result = engine.evaluate('AVERAGE(10, 20, 30)');
  assertEquals(result, 20, 'Should calculate average');
});

test('FormulaEngine - Handles formula with = prefix', () => {
  const engine = new FormulaEngine();
  engine.setField('Value', 42);
  const result = engine.evaluate('={Value} * 2');
  assertEquals(result, 84, 'Should handle = prefix');
});

test('FormulaEngine - String field values', () => {
  const engine = new FormulaEngine();
  engine.setField('Name', 'Alice');
  const result = engine.evaluate('UPPER({Name})');
  assertEquals(result, 'ALICE', 'Should convert to uppercase');
});

test('FormulaEngine - Get field references', () => {
  const engine = new FormulaEngine();
  const refs = engine.getFieldReferences('{Price} * {Quantity} + {Tax}');
  assertDeepEquals(refs, ['Price', 'Quantity', 'Tax'], 'Should extract field names');
});

console.log('\n=== Formula Field Service Tests ===\n');

test('FormulaFieldService - Basic evaluation', () => {
  const service = new FormulaFieldService();

  const record = { field_1: 100, field_2: 5 };
  const schema = [
    { id: 'field_1', name: 'Price', displayName: 'Price' },
    { id: 'field_2', name: 'Quantity', displayName: 'Quantity' }
  ];

  const result = service.evaluateForRecord('{Price} * {Quantity}', record, schema);

  assertTrue(result.success, 'Should succeed');
  assertEquals(result.value, 500, 'Should calculate correctly');
});

test('FormulaFieldService - Field name variations', () => {
  const service = new FormulaFieldService();

  const record = { user_name: 'Alice' };
  const schema = [
    { id: 'user_name', name: 'userName', displayName: 'User Name' }
  ];

  // Should work with displayName
  const result1 = service.evaluateForRecord('UPPER({User Name})', record, schema);
  assertTrue(result1.success, 'Should work with display name');
  assertEquals(result1.value, 'ALICE', 'Should convert to uppercase');

  // Should work with name
  const result2 = service.evaluateForRecord('UPPER({userName})', record, schema);
  assertTrue(result2.success, 'Should work with field name');
  assertEquals(result2.value, 'ALICE', 'Should convert to uppercase');

  // Should work with ID
  const result3 = service.evaluateForRecord('UPPER({user_name})', record, schema);
  assertTrue(result3.success, 'Should work with field ID');
  assertEquals(result3.value, 'ALICE', 'Should convert to uppercase');
});

test('FormulaFieldService - Missing field error', () => {
  const service = new FormulaFieldService();

  const record = { field_1: 100 };
  const schema = [
    { id: 'field_1', name: 'Price', displayName: 'Price' }
  ];

  const result = service.evaluateForRecord('{Price} * {Quantity}', record, schema);

  assertEquals(result.success, false, 'Should fail');
  assertTrue(result.error.includes('Missing fields'), 'Should report missing field');
});

test('FormulaFieldService - Complex formula', () => {
  const service = new FormulaFieldService();

  const record = {
    base_price: 100,
    tax_rate: 0.08,
    discount: 10
  };

  const schema = [
    { id: 'base_price', name: 'basePrice', displayName: 'Base Price' },
    { id: 'tax_rate', name: 'taxRate', displayName: 'Tax Rate' },
    { id: 'discount', name: 'discount', displayName: 'Discount' }
  ];

  const formula = '({Base Price} - {Discount}) * (1 + {Tax Rate})';
  const result = service.evaluateForRecord(formula, record, schema);

  assertTrue(result.success, 'Should succeed');
  assertEquals(result.value, 97.2, 'Should calculate correctly');
});

test('FormulaFieldService - Validate formula', () => {
  const service = new FormulaFieldService();

  const schema = [
    { id: 'field_1', name: 'Price', displayName: 'Price' },
    { id: 'field_2', name: 'Quantity', displayName: 'Quantity' }
  ];

  const result = service.validateFormula('{Price} * {Quantity}', schema);
  assertTrue(result.valid, 'Should be valid');
  assertEquals(result.errors.length, 0, 'Should have no errors');
});

test('FormulaFieldService - Validate formula with unknown field', () => {
  const service = new FormulaFieldService();

  const schema = [
    { id: 'field_1', name: 'Price', displayName: 'Price' }
  ];

  const result = service.validateFormula('{Price} * {Quantity}', schema);
  assertEquals(result.valid, false, 'Should be invalid');
  assertTrue(result.errors[0].includes('Unknown fields'), 'Should report unknown field');
});

test('FormulaFieldService - Get available functions', () => {
  const service = new FormulaFieldService();
  const functions = service.getAvailableFunctions();

  assertTrue(functions.includes('SUM'), 'Should include SUM');
  assertTrue(functions.includes('AVERAGE'), 'Should include AVERAGE');
  assertTrue(functions.includes('IF'), 'Should include IF');
  assertTrue(functions.includes('CONCATENATE'), 'Should include CONCATENATE');
});

test('FormulaFieldService - Get function help', () => {
  const service = new FormulaFieldService();
  const help = service.getFunctionHelp('SUM');

  assertTrue(help.description.length > 0, 'Should have description');
  assertTrue(help.syntax.length > 0, 'Should have syntax');
});

test('FormulaFieldService - Get field suggestions', () => {
  const service = new FormulaFieldService();

  const schema = [
    { id: 'field_1', name: 'price', displayName: 'Price', type: 'NUMBER' },
    { id: 'field_2', name: 'quantity', displayName: 'Quantity', type: 'NUMBER' },
    { id: 'field_3', name: 'total', displayName: 'Total', type: 'FORMULA' }
  ];

  const suggestions = service.getFieldSuggestions(schema);

  assertEquals(suggestions.length, 2, 'Should not include formula fields');
  assertTrue(suggestions.some(s => s.name === 'Price'), 'Should include Price');
  assertTrue(suggestions.some(s => s.name === 'Quantity'), 'Should include Quantity');
});

test('FormulaFieldService - Filter field suggestions', () => {
  const service = new FormulaFieldService();

  const schema = [
    { id: 'field_1', name: 'firstName', displayName: 'First Name', type: 'TEXT' },
    { id: 'field_2', name: 'lastName', displayName: 'Last Name', type: 'TEXT' },
    { id: 'field_3', name: 'age', displayName: 'Age', type: 'NUMBER' }
  ];

  const suggestions = service.getFieldSuggestions(schema, 'name');

  assertEquals(suggestions.length, 2, 'Should filter by name');
  assertTrue(suggestions.every(s => s.name.toLowerCase().includes('name')), 'All should contain "name"');
});

console.log('\n=== All tests passed! ===\n');

#!/usr/bin/env node

// Simple test script to verify Airtable-style formula syntax
// This doesn't require a browser - runs in Node.js

// Minimal formula engine implementation for testing
class SimpleFormulaEngine {
  constructor() {
    this.pos = 0;
    this.formula = '';
    this.dependencies = new Set();
  }

  evaluate(formula, record) {
    this.formula = formula;
    this.pos = 0;
    this.dependencies = new Set();

    try {
      const ast = this.parse();
      const value = this.evaluateNode(ast, record);
      return {
        success: true,
        value: value,
        dependencies: Array.from(this.dependencies)
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  parse() {
    return this.parseExpression();
  }

  parseExpression() {
    return this.parseConcatenation();
  }

  parseConcatenation() {
    let left = this.parsePrimary();

    while (this.peek() === '&') {
      this.advance(); // consume '&'
      this.skipWhitespace();
      const right = this.parsePrimary();
      left = { type: 'concat', left, right };
    }

    return left;
  }

  parsePrimary() {
    this.skipWhitespace();

    // String literal
    if (this.peek() === '"' || this.peek() === "'") {
      return this.parseString();
    }

    // Field reference {FieldName}
    if (this.peek() === '{') {
      return this.parseField();
    }

    // Number
    if (this.isDigit(this.peek())) {
      return this.parseNumber();
    }

    // Parentheses
    if (this.peek() === '(') {
      this.advance();
      this.skipWhitespace();
      const expr = this.parseExpression();
      this.skipWhitespace();
      if (this.peek() !== ')') {
        throw new Error('Expected closing parenthesis');
      }
      this.advance();
      return expr;
    }

    throw new Error(`Unexpected character: ${this.peek()}`);
  }

  parseString() {
    const quote = this.advance();
    let str = '';

    while (!this.isAtEnd() && this.peek() !== quote) {
      str += this.advance();
    }

    if (this.isAtEnd()) {
      throw new Error('Unterminated string');
    }

    this.advance(); // closing quote
    return { type: 'literal', value: str };
  }

  parseField() {
    this.advance(); // {
    let fieldName = '';

    while (!this.isAtEnd() && this.peek() !== '}') {
      fieldName += this.advance();
    }

    if (this.isAtEnd()) {
      throw new Error('Unterminated field reference');
    }

    this.advance(); // }

    fieldName = fieldName.trim();
    this.dependencies.add(fieldName);

    return { type: 'field', name: fieldName };
  }

  parseNumber() {
    let numStr = '';

    while (this.isDigit(this.peek()) || this.peek() === '.') {
      numStr += this.advance();
    }

    return { type: 'literal', value: parseFloat(numStr) };
  }

  evaluateNode(node, record) {
    switch (node.type) {
      case 'literal':
        return node.value;

      case 'field':
        return record[node.name] ?? '';

      case 'concat':
        const left = this.evaluateNode(node.left, record);
        const right = this.evaluateNode(node.right, record);
        return String(left ?? '') + String(right ?? '');

      default:
        throw new Error(`Unknown node type: ${node.type}`);
    }
  }

  peek() {
    return this.formula[this.pos] || '';
  }

  advance() {
    return this.formula[this.pos++];
  }

  isAtEnd() {
    return this.pos >= this.formula.length;
  }

  isDigit(char) {
    return /[0-9]/.test(char);
  }

  skipWhitespace() {
    while (!this.isAtEnd() && /\s/.test(this.peek())) {
      this.advance();
    }
  }
}

// Test cases
const engine = new SimpleFormulaEngine();

console.log('\n🎯 Testing Airtable-Style Formula Syntax\n');
console.log('=' .repeat(60));

// Test 1: Basic concatenation
console.log('\n📝 Test 1: {Name} & " dog " & {Color}');
console.log('-'.repeat(60));
const test1Data = [
  { Name: 'Howard', Color: 'blue' },
  { Name: 'Sarah', Color: 'red' },
  { Name: 'Max', Color: 'green' }
];

test1Data.forEach(record => {
  const result = engine.evaluate('{Name} & " dog " & {Color}', record);
  console.log(`Input: Name="${record.Name}", Color="${record.Color}"`);
  console.log(`Result: "${result.value}"`);
  console.log(`Dependencies: ${result.dependencies.join(', ')}`);
  console.log();
});

// Test 2: Complex concatenation
console.log('📝 Test 2: {FirstName} & " " & {LastName} & " is " & {Age} & " years old"');
console.log('-'.repeat(60));
const test2Data = [
  { FirstName: 'John', LastName: 'Smith', Age: 25 },
  { FirstName: 'Jane', LastName: 'Doe', Age: 30 }
];

test2Data.forEach(record => {
  const result = engine.evaluate('{FirstName} & " " & {LastName} & " is " & {Age} & " years old"', record);
  console.log(`Input: FirstName="${record.FirstName}", LastName="${record.LastName}", Age=${record.Age}`);
  console.log(`Result: "${result.value}"`);
  console.log();
});

// Test 3: With numbers
console.log('📝 Test 3: {Product} & ": $" & {Price}');
console.log('-'.repeat(60));
const test3Data = [
  { Product: 'Laptop', Price: 999 },
  { Product: 'Mouse', Price: 25 }
];

test3Data.forEach(record => {
  const result = engine.evaluate('{Product} & ": $" & {Price}', record);
  console.log(`Input: Product="${record.Product}", Price=${record.Price}`);
  console.log(`Result: "${result.value}"`);
  console.log();
});

// Test 4: Edge cases
console.log('📝 Test 4: Edge Cases');
console.log('-'.repeat(60));

// Empty strings
const result1 = engine.evaluate('{Name} & " dog " & {Color}', { Name: '', Color: '' });
console.log('Empty strings: "' + result1.value + '"');

// Missing fields
const result2 = engine.evaluate('{Name} & " dog " & {Color}', { Name: 'Bob' });
console.log('Missing Color field: "' + result2.value + '"');

// Single quotes
const result3 = engine.evaluate("{Name} & ' cat ' & {Color}", { Name: 'Alice', Color: 'purple' });
console.log('Single quotes: "' + result3.value + '"');

console.log('\n' + '='.repeat(60));
console.log('✅ All tests completed!\n');

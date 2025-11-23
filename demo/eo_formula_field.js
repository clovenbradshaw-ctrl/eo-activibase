/**
 * EO Formula Field Manager
 * Manages formula fields and their integration with the EO data structure
 */

class EOFormulaField {
  constructor(formulaEngine, dataStructures) {
    this.engine = formulaEngine || new EOFormulaEngine();
    this.ds = dataStructures;
    this.formulaFields = new Map(); // fieldName -> formula config
    this.dependencyGraph = new Map(); // fieldName -> Set of dependent formula fields
  }

  /**
   * Register a formula field
   */
  registerFormulaField(fieldName, config) {
    const { formula, displayFormat = 'number', decimals = 2 } = config;

    // Parse formula to get dependencies
    const parseResult = this.engine.parse(formula);

    if (!parseResult.valid) {
      throw new Error(`Invalid formula: ${parseResult.error}`);
    }

    // Check for circular dependencies
    if (this.wouldCreateCircularDependency(fieldName, parseResult.dependencies)) {
      throw new Error(`Circular dependency detected for field: ${fieldName}`);
    }

    // Store formula field configuration
    this.formulaFields.set(fieldName, {
      formula,
      displayFormat,
      decimals,
      dependencies: parseResult.dependencies,
      ast: parseResult.ast
    });

    // Update dependency graph
    for (const dep of parseResult.dependencies) {
      if (!this.dependencyGraph.has(dep)) {
        this.dependencyGraph.set(dep, new Set());
      }
      this.dependencyGraph.get(dep).add(fieldName);
    }

    return {
      success: true,
      fieldName,
      dependencies: parseResult.dependencies
    };
  }

  /**
   * Unregister a formula field
   */
  unregisterFormulaField(fieldName) {
    const config = this.formulaFields.get(fieldName);
    if (!config) return false;

    // Remove from dependency graph
    for (const dep of config.dependencies) {
      const dependents = this.dependencyGraph.get(dep);
      if (dependents) {
        dependents.delete(fieldName);
        if (dependents.size === 0) {
          this.dependencyGraph.delete(dep);
        }
      }
    }

    this.formulaFields.delete(fieldName);
    return true;
  }

  /**
   * Check if adding a dependency would create a circular reference
   */
  wouldCreateCircularDependency(fieldName, dependencies) {
    const visited = new Set();
    const stack = new Set();

    const hasCycle = (current) => {
      if (stack.has(current)) return true;
      if (visited.has(current)) return false;

      visited.add(current);
      stack.add(current);

      // Check if current field is a formula field
      const config = this.formulaFields.get(current);
      if (config) {
        for (const dep of config.dependencies) {
          if (hasCycle(dep)) return true;
        }
      }

      stack.delete(current);
      return false;
    };

    // Temporarily add the new dependencies
    const tempConfig = { dependencies };
    const originalConfig = this.formulaFields.get(fieldName);
    this.formulaFields.set(fieldName, tempConfig);

    const result = hasCycle(fieldName);

    // Restore original state
    if (originalConfig) {
      this.formulaFields.set(fieldName, originalConfig);
    } else {
      this.formulaFields.delete(fieldName);
    }

    return result;
  }

  /**
   * Calculate formula value for a record
   */
  calculateFormulaValue(fieldName, record) {
    const config = this.formulaFields.get(fieldName);
    if (!config) {
      throw new Error(`Formula field not found: ${fieldName}`);
    }

    // Evaluate the formula
    const result = this.engine.evaluate(config.formula, record);

    if (!result.success) {
      return {
        value: null,
        error: result.error,
        success: false
      };
    }

    // Format the result
    const formattedValue = this.formatValue(result.value, config.displayFormat, config.decimals);

    return {
      value: result.value,
      formattedValue,
      context: result.context,
      dependencies: result.dependencies,
      success: true,
      error: null
    };
  }

  /**
   * Calculate all formula fields for a record
   */
  calculateAllFormulas(record) {
    const results = {};
    const calculationOrder = this.getCalculationOrder();

    for (const fieldName of calculationOrder) {
      try {
        const result = this.calculateFormulaValue(fieldName, record);
        if (result.success) {
          // Add calculated value to record for dependent formulas
          record[fieldName] = result.value;
          results[fieldName] = result;
        } else {
          results[fieldName] = {
            value: null,
            error: result.error,
            success: false
          };
        }
      } catch (error) {
        results[fieldName] = {
          value: null,
          error: error.message,
          success: false
        };
      }
    }

    return results;
  }

  /**
   * Get topologically sorted order for formula calculation
   * (dependencies before dependents)
   */
  getCalculationOrder() {
    const visited = new Set();
    const order = [];

    const visit = (fieldName) => {
      if (visited.has(fieldName)) return;

      visited.add(fieldName);

      const config = this.formulaFields.get(fieldName);
      if (config) {
        // Visit dependencies first
        for (const dep of config.dependencies) {
          if (this.formulaFields.has(dep)) {
            visit(dep);
          }
        }
      }

      order.push(fieldName);
    };

    // Visit all formula fields
    for (const fieldName of this.formulaFields.keys()) {
      visit(fieldName);
    }

    return order;
  }

  /**
   * Get fields that depend on the given field
   */
  getDependentFields(fieldName) {
    const dependents = this.dependencyGraph.get(fieldName);
    return dependents ? Array.from(dependents) : [];
  }

  /**
   * Format a formula result value
   */
  formatValue(value, format, decimals) {
    if (value == null) return 'null';

    switch (format) {
      case 'number':
        if (typeof value === 'number') {
          return value.toFixed(decimals);
        }
        return String(value);

      case 'currency':
        if (typeof value === 'number') {
          return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
          }).format(value);
        }
        return String(value);

      case 'percentage':
        if (typeof value === 'number') {
          return (value * 100).toFixed(decimals) + '%';
        }
        return String(value);

      case 'date':
        if (value instanceof Date) {
          return value.toLocaleDateString();
        }
        if (typeof value === 'number' || typeof value === 'string') {
          return new Date(value).toLocaleDateString();
        }
        return String(value);

      case 'datetime':
        if (value instanceof Date) {
          return value.toLocaleString();
        }
        if (typeof value === 'number' || typeof value === 'string') {
          return new Date(value).toLocaleString();
        }
        return String(value);

      case 'text':
      default:
        return String(value);
    }
  }

  /**
   * Get all registered formula fields
   */
  getFormulaFields() {
    const fields = [];
    for (const [fieldName, config] of this.formulaFields.entries()) {
      fields.push({
        fieldName,
        formula: config.formula,
        displayFormat: config.displayFormat,
        decimals: config.decimals,
        dependencies: config.dependencies
      });
    }
    return fields;
  }

  /**
   * Export formula field configuration
   */
  exportConfig() {
    const config = {};
    for (const [fieldName, fieldConfig] of this.formulaFields.entries()) {
      config[fieldName] = {
        formula: fieldConfig.formula,
        displayFormat: fieldConfig.displayFormat,
        decimals: fieldConfig.decimals
      };
    }
    return config;
  }

  /**
   * Import formula field configuration
   */
  importConfig(config) {
    const results = [];

    for (const [fieldName, fieldConfig] of Object.entries(config)) {
      try {
        this.registerFormulaField(fieldName, fieldConfig);
        results.push({
          fieldName,
          success: true,
          error: null
        });
      } catch (error) {
        results.push({
          fieldName,
          success: false,
          error: error.message
        });
      }
    }

    return results;
  }

  /**
   * Validate a formula without registering it
   */
  validateFormula(formula) {
    const parseResult = this.engine.parse(formula);
    return {
      valid: parseResult.valid,
      error: parseResult.error,
      dependencies: parseResult.dependencies
    };
  }

  /**
   * Test a formula against sample data
   */
  testFormula(formula, sampleRecord) {
    const result = this.engine.evaluate(formula, sampleRecord);
    return {
      success: result.success,
      value: result.value,
      error: result.error,
      dependencies: result.dependencies
    };
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = EOFormulaField;
}

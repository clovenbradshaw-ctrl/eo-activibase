/**
 * EO Formula Field UI Component
 * Provides UI for creating and managing formula fields
 */

class EOFormulaUI {
  constructor(formulaField) {
    this.formulaField = formulaField;
    this.activeEditor = null;
  }

  /**
   * Render formula field editor modal
   */
  renderFormulaEditor(fieldName = '', existingConfig = null) {
    const modal = document.createElement('div');
    modal.className = 'formula-editor-modal';
    modal.innerHTML = `
      <div class="formula-editor-overlay"></div>
      <div class="formula-editor-container">
        <div class="formula-editor-header">
          <h2>${existingConfig ? 'Edit' : 'Create'} Formula Field</h2>
          <button class="close-btn" onclick="this.closest('.formula-editor-modal').remove()">×</button>
        </div>

        <div class="formula-editor-content">
          <div class="form-group">
            <label for="formula-field-name">Field Name</label>
            <input
              type="text"
              id="formula-field-name"
              class="form-control"
              value="${fieldName}"
              placeholder="e.g., Total Revenue"
              ${existingConfig ? 'readonly' : ''}
            />
          </div>

          <div class="form-group">
            <label for="formula-input">Formula</label>
            <textarea
              id="formula-input"
              class="form-control formula-textarea"
              placeholder="e.g., {Price} * {Quantity}"
              rows="4"
            >${existingConfig?.formula || ''}</textarea>
            <div class="formula-help">
              <small>Use {FieldName} to reference other fields</small>
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label for="display-format">Display Format</label>
              <select id="display-format" class="form-control">
                <option value="number" ${existingConfig?.displayFormat === 'number' ? 'selected' : ''}>Number</option>
                <option value="currency" ${existingConfig?.displayFormat === 'currency' ? 'selected' : ''}>Currency</option>
                <option value="percentage" ${existingConfig?.displayFormat === 'percentage' ? 'selected' : ''}>Percentage</option>
                <option value="text" ${existingConfig?.displayFormat === 'text' ? 'selected' : ''}>Text</option>
                <option value="date" ${existingConfig?.displayFormat === 'date' ? 'selected' : ''}>Date</option>
                <option value="datetime" ${existingConfig?.displayFormat === 'datetime' ? 'selected' : ''}>Date & Time</option>
              </select>
            </div>

            <div class="form-group">
              <label for="decimals">Decimal Places</label>
              <input
                type="number"
                id="decimals"
                class="form-control"
                min="0"
                max="10"
                value="${existingConfig?.decimals || 2}"
              />
            </div>
          </div>

          <div class="formula-validation">
            <div id="formula-status" class="formula-status"></div>
            <div id="formula-dependencies" class="formula-dependencies"></div>
          </div>

          <div class="formula-reference">
            <details>
              <summary><strong>Formula Functions Reference</strong></summary>
              <div class="reference-grid">
                <div class="reference-section">
                  <h4>Math</h4>
                  <code>SUM(a, b, ...)</code><br>
                  <code>AVG(a, b, ...)</code><br>
                  <code>MIN(a, b, ...)</code><br>
                  <code>MAX(a, b, ...)</code><br>
                  <code>ROUND(num, decimals)</code><br>
                  <code>ABS(num)</code><br>
                  <code>SQRT(num)</code><br>
                  <code>POWER(base, exp)</code>
                </div>
                <div class="reference-section">
                  <h4>Logic</h4>
                  <code>IF(condition, true, false)</code><br>
                  <code>AND(a, b, ...)</code><br>
                  <code>OR(a, b, ...)</code><br>
                  <code>NOT(value)</code>
                </div>
                <div class="reference-section">
                  <h4>Text</h4>
                  <code>CONCAT(a, b, ...)</code><br>
                  <code>UPPER(text)</code><br>
                  <code>LOWER(text)</code><br>
                  <code>TRIM(text)</code><br>
                  <code>LEN(text)</code><br>
                  <code>LEFT(text, count)</code><br>
                  <code>RIGHT(text, count)</code>
                </div>
                <div class="reference-section">
                  <h4>Date</h4>
                  <code>TODAY()</code><br>
                  <code>NOW()</code><br>
                  <code>YEAR(date)</code><br>
                  <code>MONTH(date)</code><br>
                  <code>DAY(date)</code><br>
                  <code>DATEDIFF(d1, d2, unit)</code><br>
                  <code>DATEADD(date, count, unit)</code>
                </div>
                <div class="reference-section">
                  <h4>Operators</h4>
                  <code>+  -  *  /  ^  %</code><br>
                  <code>=  !=  &lt;  &gt;  &lt;=  &gt;=</code><br>
                  <code>&amp; (string concat)</code>
                </div>
              </div>
            </details>
          </div>
        </div>

        <div class="formula-editor-footer">
          <button class="btn btn-secondary" onclick="this.closest('.formula-editor-modal').remove()">Cancel</button>
          <button class="btn btn-primary" id="save-formula-btn">Save Formula</button>
        </div>
      </div>
    `;

    // Add event listeners
    const formulaInput = modal.querySelector('#formula-input');
    const saveBtn = modal.querySelector('#save-formula-btn');

    formulaInput.addEventListener('input', () => {
      this.validateFormulaInput(modal);
    });

    saveBtn.addEventListener('click', () => {
      this.saveFormula(modal);
    });

    // Initial validation
    if (existingConfig) {
      setTimeout(() => this.validateFormulaInput(modal), 100);
    }

    return modal;
  }

  /**
   * Validate formula input and show status
   */
  validateFormulaInput(modal) {
    const formulaInput = modal.querySelector('#formula-input');
    const statusDiv = modal.querySelector('#formula-status');
    const depsDiv = modal.querySelector('#formula-dependencies');
    const saveBtn = modal.querySelector('#save-formula-btn');

    const formula = formulaInput.value.trim();

    if (!formula) {
      statusDiv.innerHTML = '';
      depsDiv.innerHTML = '';
      saveBtn.disabled = false;
      return;
    }

    const validation = this.formulaField.validateFormula(formula);

    if (validation.valid) {
      statusDiv.innerHTML = `<span class="status-success">✓ Valid formula</span>`;
      saveBtn.disabled = false;

      if (validation.dependencies.length > 0) {
        depsDiv.innerHTML = `
          <div class="dependencies-info">
            <strong>Dependencies:</strong> ${validation.dependencies.map(d => `<code>{${d}}</code>`).join(', ')}
          </div>
        `;
      } else {
        depsDiv.innerHTML = '';
      }
    } else {
      statusDiv.innerHTML = `<span class="status-error">✗ ${validation.error}</span>`;
      saveBtn.disabled = true;
      depsDiv.innerHTML = '';
    }
  }

  /**
   * Save formula field
   */
  saveFormula(modal) {
    const fieldNameInput = modal.querySelector('#formula-field-name');
    const formulaInput = modal.querySelector('#formula-input');
    const formatSelect = modal.querySelector('#display-format');
    const decimalsInput = modal.querySelector('#decimals');

    const fieldName = fieldNameInput.value.trim();
    const formula = formulaInput.value.trim();
    const displayFormat = formatSelect.value;
    const decimals = parseInt(decimalsInput.value) || 2;

    if (!fieldName) {
      alert('Please enter a field name');
      return;
    }

    if (!formula) {
      alert('Please enter a formula');
      return;
    }

    try {
      this.formulaField.registerFormulaField(fieldName, {
        formula,
        displayFormat,
        decimals
      });

      // Close modal
      modal.remove();

      // Trigger event
      this.triggerFormulaFieldEvent('created', { fieldName, formula, displayFormat, decimals });

      // Show success message
      this.showNotification(`Formula field "${fieldName}" created successfully`, 'success');
    } catch (error) {
      alert(`Error saving formula: ${error.message}`);
    }
  }

  /**
   * Render formula field value in a cell
   */
  renderFormulaCell(fieldName, record, config) {
    const cell = document.createElement('div');
    cell.className = 'formula-cell';

    try {
      const result = this.formulaField.calculateFormulaValue(fieldName, record);

      if (result.success) {
        cell.innerHTML = `
          <span class="formula-value" title="Formula: ${config.formula}">
            ${result.formattedValue}
          </span>
        `;
        cell.classList.add('formula-success');
      } else {
        cell.innerHTML = `
          <span class="formula-error" title="${result.error}">
            #ERROR
          </span>
        `;
        cell.classList.add('formula-error');
      }
    } catch (error) {
      cell.innerHTML = `
        <span class="formula-error" title="${error.message}">
          #ERROR
        </span>
      `;
      cell.classList.add('formula-error');
    }

    return cell;
  }

  /**
   * Render list of all formula fields
   */
  renderFormulaFieldsList() {
    const fields = this.formulaField.getFormulaFields();

    const container = document.createElement('div');
    container.className = 'formula-fields-list';

    if (fields.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <p>No formula fields defined yet</p>
          <button class="btn btn-primary" onclick="formulaUI.showFormulaEditor()">
            Create Formula Field
          </button>
        </div>
      `;
      return container;
    }

    container.innerHTML = `
      <div class="formula-fields-header">
        <h3>Formula Fields (${fields.length})</h3>
        <button class="btn btn-primary btn-sm" onclick="formulaUI.showFormulaEditor()">
          + New Formula
        </button>
      </div>
      <div class="formula-fields-table">
        ${fields.map(field => `
          <div class="formula-field-row">
            <div class="formula-field-info">
              <strong>${field.fieldName}</strong>
              <code class="formula-code">${field.formula}</code>
              <div class="formula-meta">
                <span class="badge">${field.displayFormat}</span>
                ${field.dependencies.length > 0 ?
                  `<span class="dependencies-badge">${field.dependencies.length} dependencies</span>` :
                  ''}
              </div>
            </div>
            <div class="formula-field-actions">
              <button class="btn-icon" onclick="formulaUI.editFormula('${field.fieldName}')" title="Edit">
                ✎
              </button>
              <button class="btn-icon" onclick="formulaUI.deleteFormula('${field.fieldName}')" title="Delete">
                🗑
              </button>
            </div>
          </div>
        `).join('')}
      </div>
    `;

    return container;
  }

  /**
   * Show formula editor modal
   */
  showFormulaEditor(fieldName = '') {
    const existingConfig = fieldName ?
      this.formulaField.formulaFields.get(fieldName) : null;

    const modal = this.renderFormulaEditor(fieldName, existingConfig);
    document.body.appendChild(modal);
    this.activeEditor = modal;

    // Focus on field name or formula input
    setTimeout(() => {
      if (!existingConfig) {
        modal.querySelector('#formula-field-name').focus();
      } else {
        modal.querySelector('#formula-input').focus();
      }
    }, 100);
  }

  /**
   * Edit existing formula
   */
  editFormula(fieldName) {
    this.showFormulaEditor(fieldName);
  }

  /**
   * Delete formula field
   */
  deleteFormula(fieldName) {
    if (!confirm(`Are you sure you want to delete the formula field "${fieldName}"?`)) {
      return;
    }

    const success = this.formulaField.unregisterFormulaField(fieldName);

    if (success) {
      this.triggerFormulaFieldEvent('deleted', { fieldName });
      this.showNotification(`Formula field "${fieldName}" deleted`, 'success');
    } else {
      this.showNotification(`Failed to delete formula field "${fieldName}"`, 'error');
    }
  }

  /**
   * Show notification message
   */
  showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.classList.add('show');
    }, 10);

    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }

  /**
   * Trigger custom event for formula field changes
   */
  triggerFormulaFieldEvent(action, data) {
    const event = new CustomEvent('formulaFieldChange', {
      detail: { action, ...data }
    });
    document.dispatchEvent(event);
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = EOFormulaUI;
}

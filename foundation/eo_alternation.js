/**
 * EO Alternation (ALT Operator)
 * State machine framework for handling mode switching and state transitions
 *
 * @eo_operator ALT
 * @eo_layer foundation
 *
 * The ALT operator handles alternation between states - view switching,
 * mode transitions, and state management. This module provides a
 * reusable state machine framework.
 */

(function(global) {
    'use strict';

    /**
     * State definition
     * @typedef {Object} EOStateDefinition
     * @property {string} name - State name
     * @property {Function} [onEnter] - Called when entering state
     * @property {Function} [onExit] - Called when exiting state
     * @property {Object} [data] - State-specific data
     */

    /**
     * Transition definition
     * @typedef {Object} EOTransitionDefinition
     * @property {string} from - Source state
     * @property {string} to - Target state
     * @property {string} event - Trigger event
     * @property {Function} [guard] - Condition for transition
     * @property {Function} [action] - Action to perform during transition
     */

    /**
     * EOStateMachine - Finite state machine implementation
     */
    class EOStateMachine {
        /**
         * Create a new state machine
         * @param {Object} config - Configuration
         * @param {string} config.initialState - Initial state name
         * @param {Object<string, EOStateDefinition>} config.states - State definitions
         * @param {EOTransitionDefinition[]} config.transitions - Transition definitions
         * @param {Object} [config.context] - Initial context data
         */
        constructor(config) {
            this.currentState = config.initialState;
            this.previousState = null;
            this.states = new Map();
            this.transitions = new Map();
            this.context = config.context || {};
            this.history = [];
            this.listeners = [];

            // Register states
            if (config.states) {
                Object.entries(config.states).forEach(([name, def]) => {
                    this.addState(name, def);
                });
            }

            // Register transitions
            if (config.transitions) {
                config.transitions.forEach(t => this.addTransition(t));
            }

            // Enter initial state
            this._enterState(this.currentState, null, {});
        }

        /**
         * Add a state definition
         * @param {string} name - State name
         * @param {EOStateDefinition} definition - State definition
         */
        addState(name, definition = {}) {
            this.states.set(name, {
                name,
                onEnter: definition.onEnter || (() => {}),
                onExit: definition.onExit || (() => {}),
                data: definition.data || {}
            });
        }

        /**
         * Add a transition definition
         * @param {EOTransitionDefinition} transition - Transition definition
         */
        addTransition(transition) {
            const key = `${transition.from}:${transition.event}`;
            if (!this.transitions.has(key)) {
                this.transitions.set(key, []);
            }
            this.transitions.get(key).push(transition);
        }

        /**
         * Get current state
         * @returns {string}
         */
        getState() {
            return this.currentState;
        }

        /**
         * Get current state definition
         * @returns {EOStateDefinition}
         */
        getStateDefinition() {
            return this.states.get(this.currentState);
        }

        /**
         * Check if in a specific state
         * @param {string|string[]} states - State(s) to check
         * @returns {boolean}
         */
        isIn(states) {
            const stateList = Array.isArray(states) ? states : [states];
            return stateList.includes(this.currentState);
        }

        /**
         * Check if a transition is possible
         * @param {string} event - Event to check
         * @param {Object} payload - Event payload
         * @returns {boolean}
         */
        can(event, payload = {}) {
            const transitions = this._getTransitions(event);
            return transitions.some(t => !t.guard || t.guard(this.context, payload));
        }

        /**
         * Get possible transitions for an event
         * @param {string} event - Event name
         * @returns {EOTransitionDefinition[]}
         */
        _getTransitions(event) {
            const key = `${this.currentState}:${event}`;
            return this.transitions.get(key) || [];
        }

        /**
         * Send an event to the machine
         * @param {string} event - Event name
         * @param {Object} payload - Event payload
         * @returns {boolean} Whether transition occurred
         */
        send(event, payload = {}) {
            const transitions = this._getTransitions(event);

            for (const transition of transitions) {
                // Check guard condition
                if (transition.guard && !transition.guard(this.context, payload)) {
                    continue;
                }

                // Execute transition
                return this._executeTransition(transition, event, payload);
            }

            // No valid transition found
            console.warn(`[EOStateMachine] No valid transition for event '${event}' from state '${this.currentState}'`);
            return false;
        }

        /**
         * Execute a transition
         * @param {EOTransitionDefinition} transition - Transition to execute
         * @param {string} event - Trigger event
         * @param {Object} payload - Event payload
         * @returns {boolean}
         */
        _executeTransition(transition, event, payload) {
            const fromState = this.currentState;
            const toState = transition.to;

            // Exit current state
            this._exitState(fromState, toState, payload);

            // Execute transition action
            if (transition.action) {
                transition.action(this.context, payload);
            }

            // Update state
            this.previousState = fromState;
            this.currentState = toState;

            // Enter new state
            this._enterState(toState, fromState, payload);

            // Record in history
            this.history.push({
                from: fromState,
                to: toState,
                event,
                timestamp: Date.now(),
                payload
            });

            // Notify listeners
            this._emit('transition', {
                from: fromState,
                to: toState,
                event,
                payload
            });

            return true;
        }

        /**
         * Exit a state
         * @param {string} state - State to exit
         * @param {string} nextState - Next state
         * @param {Object} payload - Event payload
         */
        _exitState(state, nextState, payload) {
            const stateDef = this.states.get(state);
            if (stateDef?.onExit) {
                stateDef.onExit({ context: this.context, nextState, payload });
            }
        }

        /**
         * Enter a state
         * @param {string} state - State to enter
         * @param {string} prevState - Previous state
         * @param {Object} payload - Event payload
         */
        _enterState(state, prevState, payload) {
            const stateDef = this.states.get(state);
            if (stateDef?.onEnter) {
                stateDef.onEnter({ context: this.context, prevState, payload });
            }
        }

        /**
         * Subscribe to state machine events
         * @param {string} event - Event type ('transition', 'enter', 'exit')
         * @param {Function} callback - Event handler
         * @returns {Function} Unsubscribe function
         */
        on(event, callback) {
            const listener = { event, callback };
            this.listeners.push(listener);
            return () => {
                const idx = this.listeners.indexOf(listener);
                if (idx >= 0) this.listeners.splice(idx, 1);
            };
        }

        /**
         * Emit an event
         * @param {string} event - Event type
         * @param {Object} data - Event data
         */
        _emit(event, data) {
            this.listeners
                .filter(l => l.event === event)
                .forEach(l => l.callback(data));
        }

        /**
         * Get transition history
         * @param {number} limit - Maximum entries
         * @returns {Array}
         */
        getHistory(limit = 10) {
            return this.history.slice(-limit);
        }

        /**
         * Reset to initial state
         * @param {string} initialState - State to reset to
         */
        reset(initialState = null) {
            const targetState = initialState || this.history[0]?.from || this.currentState;
            this._exitState(this.currentState, targetState, {});
            this.currentState = targetState;
            this.previousState = null;
            this.history = [];
            this._enterState(targetState, null, {});
        }

        /**
         * Get visual representation of state machine
         * @returns {Object}
         */
        toGraph() {
            const nodes = Array.from(this.states.keys()).map(name => ({
                id: name,
                current: name === this.currentState
            }));

            const edges = [];
            this.transitions.forEach((transitions, key) => {
                transitions.forEach(t => {
                    edges.push({
                        from: t.from,
                        to: t.to,
                        label: t.event
                    });
                });
            });

            return { nodes, edges };
        }
    }

    /**
     * EOAlternation - Higher-level alternation utilities
     */
    const EOAlternation = {
        /**
         * Create a state machine
         * @param {Object} config - Machine configuration
         * @returns {EOStateMachine}
         */
        createMachine(config) {
            return new EOStateMachine(config);
        },

        /**
         * Create a simple toggle (binary state)
         * @param {string} offState - Off state name
         * @param {string} onState - On state name
         * @param {boolean} initiallyOn - Initial state
         * @returns {EOStateMachine}
         */
        createToggle(offState = 'off', onState = 'on', initiallyOn = false) {
            return new EOStateMachine({
                initialState: initiallyOn ? onState : offState,
                states: {
                    [offState]: {},
                    [onState]: {}
                },
                transitions: [
                    { from: offState, to: onState, event: 'toggle' },
                    { from: offState, to: onState, event: 'on' },
                    { from: onState, to: offState, event: 'toggle' },
                    { from: onState, to: offState, event: 'off' }
                ]
            });
        },

        /**
         * Create a cycle (rotating through states)
         * @param {string[]} states - States in order
         * @param {string} event - Event to advance
         * @returns {EOStateMachine}
         */
        createCycle(states, event = 'next') {
            const stateDefinitions = {};
            const transitions = [];

            states.forEach((state, i) => {
                stateDefinitions[state] = {};
                const nextState = states[(i + 1) % states.length];
                transitions.push({ from: state, to: nextState, event });

                // Also allow previous
                const prevState = states[(i - 1 + states.length) % states.length];
                transitions.push({ from: state, to: prevState, event: 'prev' });
            });

            return new EOStateMachine({
                initialState: states[0],
                states: stateDefinitions,
                transitions
            });
        },

        /**
         * Create a view switcher for UI tabs/panels
         * @param {string[]} views - Available views
         * @param {string} initialView - Initial view
         * @returns {EOStateMachine}
         */
        createViewSwitcher(views, initialView = null) {
            const stateDefinitions = {};
            const transitions = [];

            views.forEach(view => {
                stateDefinitions[view] = {};

                // Can switch to any other view
                views.forEach(targetView => {
                    if (view !== targetView) {
                        transitions.push({
                            from: view,
                            to: targetView,
                            event: `show_${targetView}`
                        });
                        // Generic switch event
                        transitions.push({
                            from: view,
                            to: targetView,
                            event: 'switch',
                            guard: (ctx, payload) => payload.view === targetView
                        });
                    }
                });
            });

            return new EOStateMachine({
                initialState: initialView || views[0],
                states: stateDefinitions,
                transitions
            });
        },

        /**
         * Create a workflow state machine
         * @param {Array<{name: string, next?: string[], final?: boolean}>} steps - Workflow steps
         * @returns {EOStateMachine}
         */
        createWorkflow(steps) {
            const stateDefinitions = {};
            const transitions = [];

            steps.forEach((step, i) => {
                stateDefinitions[step.name] = {
                    data: { final: step.final || false, index: i }
                };

                if (step.next) {
                    step.next.forEach(nextStep => {
                        transitions.push({
                            from: step.name,
                            to: nextStep,
                            event: 'advance'
                        });
                        transitions.push({
                            from: step.name,
                            to: nextStep,
                            event: `goto_${nextStep}`
                        });
                    });
                } else if (!step.final && i < steps.length - 1) {
                    // Default to next step in sequence
                    transitions.push({
                        from: step.name,
                        to: steps[i + 1].name,
                        event: 'advance'
                    });
                }

                // Allow going back
                if (i > 0) {
                    transitions.push({
                        from: step.name,
                        to: steps[i - 1].name,
                        event: 'back'
                    });
                }
            });

            return new EOStateMachine({
                initialState: steps[0].name,
                states: stateDefinitions,
                transitions
            });
        },

        /**
         * Match value against cases (like switch/case)
         * @param {*} value - Value to match
         * @param {Object} cases - Case handlers
         * @param {*} defaultValue - Default if no match
         * @returns {*}
         */
        match(value, cases, defaultValue = undefined) {
            if (cases.hasOwnProperty(value)) {
                const handler = cases[value];
                return typeof handler === 'function' ? handler(value) : handler;
            }
            return typeof defaultValue === 'function' ? defaultValue(value) : defaultValue;
        },

        /**
         * Pattern matching with predicates
         * @param {*} value - Value to match
         * @param {Array<{when: Function, then: *}>} patterns - Pattern definitions
         * @param {*} defaultValue - Default if no match
         * @returns {*}
         */
        matchPattern(value, patterns, defaultValue = undefined) {
            for (const pattern of patterns) {
                if (pattern.when(value)) {
                    return typeof pattern.then === 'function'
                        ? pattern.then(value)
                        : pattern.then;
                }
            }
            return typeof defaultValue === 'function' ? defaultValue(value) : defaultValue;
        }
    };

    // Export to global scope
    global.EOStateMachine = EOStateMachine;
    global.EOAlternation = EOAlternation;

    // For CommonJS
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { EOStateMachine, EOAlternation };
    }

})(typeof window !== 'undefined' ? window : global);

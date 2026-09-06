/**
 * block-optimizer.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Backend service for multi-department block optimization.
 * Delegates directly to the Python BlockConstraintSolver (OR-Tools CP-SAT)
 * and BundlingEngine via AIServiceConnector.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const { aiServiceConnector } = require('./ai-service-connector');

class BlockOptimizerService {
  constructor(connector = aiServiceConnector) {
    this.connector = connector;
  }

  /**
   * Consolidates compatible maintenance tasks in the same section
   * into multi-department shadow blocks with quantified time savings.
   *
   * @param {Array<Object>} tasks List of maintenance tasks/work orders
   * @returns {Promise<Array<Object>>} Bundled task groups
   */
  async bundleTasks(tasks) {
    return this.connector.bundleTasks(tasks);
  }

  /**
   * Formulates and solves the optimal task-to-slot block schedule
   * using Google OR-Tools CP-SAT constraint programming.
   *
   * @param {Array<Object>} tasks
   * @param {Array<Object>} slots Candidate corridor slots
   * @param {Array<Object>} [teams] Optional available maintenance gangs
   * @param {boolean} [autoBundle=true]
   * @returns {Promise<Object>} Optimized schedule plan and metrics
   */
  async generateSchedule(tasks, slots, teams = null, autoBundle = true) {
    return this.connector.optimizeSchedule(tasks, slots, teams, autoBundle);
  }

  /**
   * Checks inter-department compatibility between two disciplines (Civil, Traction/OHE, S&T).
   *
   * @param {string} dept1
   * @param {string} dept2
   * @returns {Promise<Object>}
   */
  async checkDepartmentCompatibility(dept1, dept2) {
    return this.connector.checkDepartmentCompatibility(dept1, dept2);
  }

  /**
   * Retrieves active solver configuration, objective weights, and compatibility rules.
   *
   * @returns {Promise<Object>}
   */
  async getConstraints() {
    return this.connector.getOptimizationConstraints();
  }

  /**
   * Validates a proposed maintenance schedule against operational constraints
   * (duration capacities, crew double-booking, disruption thresholds).
   *
   * @param {Array<Object>} schedule
   * @returns {Promise<Object>}
   */
  async validateSchedule(schedule) {
    return this.connector.validateSchedule(schedule);
  }
}

const blockOptimizerService = new BlockOptimizerService();

module.exports = {
  BlockOptimizerService,
  blockOptimizerService,
};

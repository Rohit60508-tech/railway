/**
 * priority-engine.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Backend service for Defect Prioritization.
 * Directly delegates priority scoring, classification, and explainability to the
 * Python DefectPrioritizer class via AIServiceConnector.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const { aiServiceConnector } = require('./ai-service-connector');

class PriorityEngine {
  constructor(connector = aiServiceConnector) {
    this.connector = connector;
  }

  /**
   * Scores an individual defect using the 10 domain risk factors in Python AI engine.
   *
   * @param {Object} defectData
   * @returns {Promise<Object>} PriorityResult with score (0-100), category (P1-P4), and explanation
   */
  async scoreDefect(defectData) {
    return this.connector.prioritizeDefect(defectData);
  }

  /**
   * Evaluates and ranks a batch of defects in descending order of risk.
   *
   * @param {Array<Object>} defectsList
   * @param {boolean} sortByPriority
   * @returns {Promise<Object>} Ranked defects with category breakdown
   */
  async rankBatch(defectsList, sortByPriority = true) {
    return this.connector.prioritizeBatch(defectsList, sortByPriority);
  }

  /**
   * Fetches active machine learning model metadata, feature weights, and accuracy.
   *
   * @returns {Promise<Object>}
   */
  async getModelMetadata() {
    return this.connector.getModelInfo();
  }

  /**
   * Triggers asynchronous model retraining on updated database records.
   *
   * @param {number} samples Number of training records to sample
   * @param {string} modelType 'RandomForest' or 'GradientBoosting'
   * @returns {Promise<Object>}
   */
  async retrainModel(samples = 3000, modelType = 'RandomForest') {
    return this.connector.triggerRetraining(samples, modelType);
  }

  /**
   * Real-time urgency calculation for emergency alerts.
   * Returns true if priority score >= 85 or category is P1.
   */
  async isEmergencyCritical(defectData) {
    const result = await this.scoreDefect(defectData);
    return result.priorityCategory === 'P1' || result.priorityScore >= 85.0;
  }
}

const priorityEngine = new PriorityEngine();

module.exports = {
  PriorityEngine,
  priorityEngine,
};

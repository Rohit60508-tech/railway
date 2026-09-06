/**
 * traffic-analyzer.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Backend service for railway traffic density, corridor headway analysis,
 * and block window availability.
 * Delegates directly to the Python TrafficAnalyzer class via AIServiceConnector.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const { aiServiceConnector } = require('./ai-service-connector');

class TrafficAnalyzerService {
  constructor(connector = aiServiceConnector) {
    this.connector = connector;
  }

  /**
   * Calculates section occupancy percentage, volume, and occupying trains for a time window.
   *
   * @param {string} sectionId Railway section (e.g., 'NDLS-CNB-UP')
   * @param {string} [startTime] ISO timestamp
   * @param {string} [endTime] ISO timestamp
   * @returns {Promise<Object>}
   */
  async getSectionOccupancy(sectionId, startTime = null, endTime = null) {
    return this.connector.getSectionOccupancy(sectionId, startTime, endTime);
  }

  /**
   * Discovers unobstructed headway corridor maintenance slots.
   *
   * @param {string} sectionId
   * @param {number} durationMinutes Duration requested (e.g., 120m)
   * @param {string} [searchStart] ISO timestamp
   * @param {string} [searchEnd] ISO timestamp
   * @returns {Promise<Array<Object>>}
   */
  async findAvailableCorridorSlots(sectionId, durationMinutes = 120, searchStart = null, searchEnd = null) {
    return this.connector.findCorridorSlots(sectionId, durationMinutes, searchStart, searchEnd);
  }

  /**
   * Predicts and ranks the top recommended maintenance block slots
   * based on traffic disruption score, cascade delays, and diurnal preferences.
   *
   * @param {string} sectionId
   * @param {number} durationMinutes
   * @param {number} topK Number of slots to return (default 10)
   * @param {string} [searchStart]
   * @param {string} [searchEnd]
   * @returns {Promise<Array<Object>>}
   */
  async predictBestSlots(sectionId, durationMinutes = 120, topK = 10, searchStart = null, searchEnd = null) {
    return this.connector.getBestMaintenanceSlots(sectionId, durationMinutes, topK, searchStart, searchEnd);
  }

  /**
   * Generates projected hourly traffic density and freight demand for a section.
   *
   * @param {string} sectionId
   * @param {string} date YYYY-MM-DD
   * @param {number} horizonHours
   * @returns {Promise<Object>}
   */
  async getTrafficForecast(sectionId, date, horizonHours = 24) {
    return this.connector.getTrafficForecast(sectionId, date, horizonHours);
  }
}

const trafficAnalyzerService = new TrafficAnalyzerService();

module.exports = {
  TrafficAnalyzerService,
  trafficAnalyzerService,
};

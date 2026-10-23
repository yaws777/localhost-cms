// 30-day rolling medicine demand forecast (two-phase window-shift model).
// Pure functions, no external dependencies.

const WINDOW_SIZE = 30;
const FORECAST_DAYS = 30;
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Default day-of-week demand weights, keyed 0 = Sunday ... 6 = Saturday.
const DEFAULT_SEASONALITY = { 0: 0.20, 1: 1.30, 2: 1.10, 3: 1.10, 4: 1.00, 5: 0.90, 6: 0.30 };

/**
 * @typedef {Object} Phase1Prediction
 * @property {number} activeWindowSum   Sum of the 30 values currently in the active window.
 * @property {number} activeADD         Average daily demand = activeWindowSum / 30.
 * @property {number} seasonalityIndex  Day-of-week weight applied to the target day.
 * @property {number} rawDemand         activeADD x seasonalityIndex x trend, before rounding up.
 * @property {number} predictedDemand   Final prediction D_hat = ceiling of rawDemand at the unit's precision (never negative).
 *
 * @typedef {Object} Phase2WindowShift
 * @property {number} droppedOldestValue  Value removed from the back of the window.
 * @property {number} appendedPrediction  D_hat added to the front of the window.
 * @property {number} newWindowSum        Window sum committed for step k + 1.
 *
 * @typedef {Object} ForecastDay
 * @property {number} dayOffset           k (1..30).
 * @property {string} targetDate          YYYY-MM-DD of t + k.
 * @property {string} dayOfWeek           Sun, Mon, Tue, ...
 * @property {Phase1Prediction} phase1_prediction
 * @property {Phase2WindowShift} phase2_windowShift
 */

/**
 * Resolve startDate into a UTC-midnight Date for the same calendar day, so that
 * day-of-week and day arithmetic never depend on the host machine's timezone.
 * @param {string|Date|undefined} startDate  'YYYY-MM-DD', a Date, or omitted (= today).
 * @returns {Date}
 */
function resolveBaseDate(startDate) {
  let y, m, d;
  if (startDate === undefined || startDate === null) {
    const now = new Date();
    [y, m, d] = [now.getFullYear(), now.getMonth(), now.getDate()];
  } else if (typeof startDate === 'string' && /^\d{4}-\d{2}-\d{2}/.test(startDate)) {
    const [yy, mm, dd] = startDate.slice(0, 10).split('-').map(Number);
    [y, m, d] = [yy, mm - 1, dd];
  } else {
    const parsed = new Date(startDate);
    if (Number.isNaN(parsed.getTime())) throw new Error('startDate is not a valid date.');
    [y, m, d] = [parsed.getFullYear(), parsed.getMonth(), parsed.getDate()];
  }
  return new Date(Date.UTC(y, m, d));
}

/**
 * Forecast the next 30 days of demand from a trailing 30-day dispensing history.
 *
 * @param {number[]} history  Exactly 30 daily dispenses [D_0 ... D_29]; D_0 is the
 *                            most recent day (t), D_29 the oldest.
 * @param {Object} [options]
 * @param {Object<number, number>} [options.seasonality]  Custom day-of-week weights (0 = Sun ... 6 = Sat);
 *                                                        missing days fall back to the defaults.
 * @param {number} [options.trendFactor=0]                Daily compounding growth rate.
 * @param {string|Date} [options.startDate]               Base date t (default: today).
 * @param {number} [options.decimals=0]                   Decimal places kept in each predicted day (0 = whole units).
 * @returns {ForecastDay[]}
 * @throws {Error} If history is not an array of exactly 30 finite numbers.
 */
function forecastMedicineDemand(history, { seasonality, trendFactor = 0, startDate, decimals = 0 } = {}) {
  if (!Array.isArray(history) || history.length !== WINDOW_SIZE) {
    throw new Error(`history must be an array of exactly ${WINDOW_SIZE} numbers.`);
  }
  if (!history.every((v) => typeof v === 'number' && Number.isFinite(v))) {
    throw new Error('history must contain only finite numeric values.');
  }
  if (typeof trendFactor !== 'number' || !Number.isFinite(trendFactor)) {
    throw new Error('trendFactor must be a finite number.');
  }

  const weights = { ...DEFAULT_SEASONALITY, ...(seasonality || {}) };
  const baseDate = resolveBaseDate(startDate);

  // Active window: index 0 = newest day, last index = oldest day.
  const window = history.slice();
  let windowSum = window.reduce((acc, v) => acc + v, 0);

  const forecast = [];
  for (let k = 1; k <= FORECAST_DAYS; k++) {
    const target = new Date(baseDate.getTime());
    target.setUTCDate(target.getUTCDate() + k);
    const dow = target.getUTCDay();

    // PHASE 1: predict day t + k from the current window.
    const activeWindowSum = windowSum;
    const activeADD = activeWindowSum / WINDOW_SIZE;
    const seasonalityIndex = Number(weights[dow]);
    if (!Number.isFinite(seasonalityIndex)) {
      throw new Error(`seasonality weight for day ${dow} is not a finite number.`);
    }
    const trendMultiplier = Math.pow(1 + trendFactor, k);
    const precision = Math.pow(10, decimals);
    // Exact value first (e.g. 1.1), then rounded UP to the unit's precision (e.g. 2). The toFixed(6) pass strips
    // floating-point noise so 1.0000000002 does not ceil to 2.
    const rawDemand = Math.max(0, activeADD * seasonalityIndex * trendMultiplier);
    const predictedDemand = Math.ceil(parseFloat((rawDemand * precision).toFixed(6))) / precision;

    // PHASE 2: slide the window forward so step k + 1 sees the prediction as history.
    const droppedOldestValue = window.pop();
    window.unshift(predictedDemand);
    windowSum = windowSum - droppedOldestValue + predictedDemand;

    forecast.push({
      dayOffset: k,
      targetDate: target.toISOString().slice(0, 10),
      dayOfWeek: DAY_LABELS[dow],
      phase1_prediction: { activeWindowSum, activeADD, seasonalityIndex, rawDemand: parseFloat(rawDemand.toFixed(4)), predictedDemand },
      phase2_windowShift: { droppedOldestValue, appendedPrediction: predictedDemand, newWindowSum: windowSum }
    });
  }
  return forecast;
}

module.exports = { forecastMedicineDemand, DEFAULT_SEASONALITY, WINDOW_SIZE, FORECAST_DAYS };

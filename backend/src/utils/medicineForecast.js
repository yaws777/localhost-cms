// 30-day rolling medicine demand forecast (two-phase window-shift model).
// Pure functions, no external dependencies.

const WINDOW_SIZE = 30;
const FORECAST_DAYS = 30;
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Sunday (0) is a closed day: nothing is dispensed, so it is left out of the window average and forecasts 0.
const CLOSED_DOW = 0;

// Default day-of-week demand weights, keyed 0 = Sunday ... 6 = Saturday.
// Only the relative sizes matter: the open-day weights are rescaled to average 1 before use (see normalizeWeights),
// so a custom set does not have to average 1 itself.
const DEFAULT_SEASONALITY = { 0: 0, 1: 1.30, 2: 1.10, 3: 1.10, 4: 1.00, 5: 0.90, 6: 0.30 };

/**
 * @typedef {Object} Phase1Prediction
 * @property {number} activeWindowSum   Sum of the open-day (non-Sunday) values in the active window.
 * @property {number} activeDays        Number of open days (Sundays excluded) in the active window; the ADD divisor.
 * @property {number} activeADD         Average daily demand = activeWindowSum / activeDays.
 * @property {number} seasonalityIndex  Day-of-week weight applied to the target day (open-day weights average 1).
 * @property {number} rawDemand         activeADD x seasonalityIndex x trend. Kept fractional, never rounded per day.
 * @property {number} predictedDemand   Final prediction D_hat = rawDemand to 4 decimals (never negative). Round the
 *                                      30-day total up once with roundUpTotal, not each day.
 *
 * @typedef {Object} Phase2WindowShift
 * @property {number} droppedOldestValue  Value removed from the back of the window.
 * @property {number} appendedPrediction  Trend-free prediction added to the front of the window.
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
 * Rescale the open-day weights so they average exactly 1. Without this a set like 1.3/1.1/1.1/1.0/0.9/0.3 (mean 0.95)
 * silently shrinks every forecast by 5%. The closed day keeps weight 0 and is not part of the average.
 * @param {Object<number, number>} weights  0 = Sun ... 6 = Sat
 * @returns {Object<number, number>}
 */
function normalizeWeights(weights) {
  const openDays = [0, 1, 2, 3, 4, 5, 6].filter((d) => d !== CLOSED_DOW);
  openDays.forEach((d) => {
    if (!Number.isFinite(Number(weights[d])) || Number(weights[d]) < 0) {
      throw new Error(`seasonality weight for day ${d} is not a finite non-negative number.`);
    }
  });
  const mean = openDays.reduce((acc, d) => acc + Number(weights[d]), 0) / openDays.length;
  const out = { [CLOSED_DOW]: 0 };
  openDays.forEach((d) => { out[d] = mean > 0 ? Number(weights[d]) / mean : 1; });
  return out;
}

/**
 * Round a summed demand UP once, at the unit's precision (decimals = 0 for whole units). The toFixed(6) pass strips
 * floating-point noise so 120.0000000002 does not become 121.
 * @param {number} total
 * @param {number} [decimals=0]
 * @returns {number}
 */
function roundUpTotal(total, decimals = 0) {
  const precision = Math.pow(10, decimals);
  return Math.ceil(parseFloat((total * precision).toFixed(6))) / precision;
}

/**
 * Forecast the next 30 days of demand from a trailing 30-day dispensing history.
 *
 * Daily predictions stay fractional; callers sum them and round up once with roundUpTotal. Rounding every day up
 * inflated slow-moving medicines several times over (a medicine dispensed 4 times a month forecast 27 units).
 *
 * @param {number[]} history  Exactly 30 daily dispenses [D_0 ... D_29]; D_0 is the
 *                            most recent day (t), D_29 the oldest.
 * @param {Object} [options]
 * @param {Object<number, number>} [options.seasonality]  Custom day-of-week weights (0 = Sun ... 6 = Sat);
 *                                                        missing days fall back to the defaults.
 * @param {number} [options.trendFactor=0]                Daily compounding growth rate, applied once to the final
 *                                                        figure (it is not fed back into the window).
 * @param {string|Date} [options.startDate]               Base date t (default: today).
 * @returns {ForecastDay[]}
 * @throws {Error} If history is not an array of exactly 30 finite numbers.
 */
function forecastMedicineDemand(history, { seasonality, trendFactor = 0, startDate } = {}) {
  if (!Array.isArray(history) || history.length !== WINDOW_SIZE) {
    throw new Error(`history must be an array of exactly ${WINDOW_SIZE} numbers.`);
  }
  if (!history.every((v) => typeof v === 'number' && Number.isFinite(v))) {
    throw new Error('history must contain only finite numeric values.');
  }
  if (typeof trendFactor !== 'number' || !Number.isFinite(trendFactor)) {
    throw new Error('trendFactor must be a finite number.');
  }

  const weights = normalizeWeights({ ...DEFAULT_SEASONALITY, ...(seasonality || {}) });
  const baseDate = resolveBaseDate(startDate);

  // Day of week of the window slot that is i days before the base date t (i = 0 is t itself).
  const dowOfBaseMinus = (i) => (((baseDate.getUTCDay() - i) % 7) + 7) % 7;

  // Active window: index 0 = newest day, last index = oldest day. Closed days (Sundays) hold 0 and are not counted.
  const window = history.map((v, i) => (dowOfBaseMinus(i) === CLOSED_DOW ? 0 : v));
  let windowSum = window.reduce((acc, v) => acc + v, 0);

  const forecast = [];
  for (let k = 1; k <= FORECAST_DAYS; k++) {
    const target = new Date(baseDate.getTime());
    target.setUTCDate(target.getUTCDate() + k);
    const dow = target.getUTCDay();

    // PHASE 1: predict day t + k from the current window. The window covers t + k - 30 .. t + k - 1.
    let activeDays = 0;
    for (let i = 0; i < WINDOW_SIZE; i++) {
      if (dowOfBaseMinus(i - (k - 1)) !== CLOSED_DOW) activeDays++;
    }
    const activeWindowSum = windowSum;
    const activeADD = activeDays > 0 ? activeWindowSum / activeDays : 0;
    const seasonalityIndex = weights[dow];
    const baseDemand = Math.max(0, activeADD * seasonalityIndex);
    const rawDemand = baseDemand * Math.pow(1 + trendFactor, k);
    const predictedDemand = parseFloat(rawDemand.toFixed(4));

    // PHASE 2: slide the window forward so step k + 1 sees the prediction as history. The trend is left out here:
    // it is already applied once to the output, and feeding it back would compound it a second time.
    const appendedPrediction = parseFloat(baseDemand.toFixed(4));
    const droppedOldestValue = window.pop();
    window.unshift(appendedPrediction);
    windowSum = windowSum - droppedOldestValue + appendedPrediction;

    forecast.push({
      dayOffset: k,
      targetDate: target.toISOString().slice(0, 10),
      dayOfWeek: DAY_LABELS[dow],
      phase1_prediction: {
        activeWindowSum, activeDays, activeADD,
        seasonalityIndex: parseFloat(seasonalityIndex.toFixed(4)),
        rawDemand: parseFloat(rawDemand.toFixed(4)),
        predictedDemand
      },
      phase2_windowShift: { droppedOldestValue, appendedPrediction, newWindowSum: windowSum }
    });
  }
  return forecast;
}

module.exports = { forecastMedicineDemand, roundUpTotal, DEFAULT_SEASONALITY, WINDOW_SIZE, FORECAST_DAYS };

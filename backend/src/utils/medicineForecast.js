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
 * Measure the day-of-week seasonal index from the history itself (plain ratio, no smoothing).
 *   index[d] = mean demand on weekday d / average daily demand (ADD) over all open days
 * Sundays (closed) are skipped. A weekday with no sample, or no demand at all, gives index 1 (flat).
 * Example: Wednesdays 5, 5, 7, 8 -> mean 6.25; ADD 84 / 26 = 3.23; index = 6.25 / 3.23 = 1.93.
 * @param {number[]} history   [D_0 ... D_29], D_0 = base date.
 * @param {(i:number)=>number} dowOf  Weekday (0 = Sun) of history slot i.
 * @returns {Object<number, number>}
 */
function measureSeasonality(history, dowOf) {
  const sum = {}; const count = {};
  let total = 0; let n = 0;
  history.forEach((v, i) => {
    const d = dowOf(i);
    if (d === CLOSED_DOW) return;
    sum[d] = (sum[d] || 0) + v; count[d] = (count[d] || 0) + 1;
    total += v; n++;
  });
  const add = n > 0 ? total / n : 0;
  const index = { [CLOSED_DOW]: 0 };
  for (let d = 0; d < 7; d++) {
    if (d === CLOSED_DOW) continue;
    index[d] = add > 0 && count[d] ? (sum[d] / count[d]) / add : 1;
  }
  return index;
}

/**
 * Weekday index of each full 7-day block of the history (block 0 = newest week, block 3 = oldest):
 *   blockIndex[b][d] = demand on weekday d in block b / mean open-day demand of block b
 * A block with no demand, or a closed day, gives index 1 / 0. Open-day weights of a block average 1.
 * @param {number[]} history   [D_0 ... D_29]
 * @param {(i:number)=>number} dowOf
 * @returns {Array<Object<number, number>>}
 */
function measureWeeklySeasonality(history, dowOf) {
  const blocks = [];
  for (let b = 0; b < Math.floor(WINDOW_SIZE / 7); b++) {
    const vals = {}; let total = 0; let n = 0;
    for (let i = b * 7; i < b * 7 + 7; i++) {
      const d = dowOf(i);
      if (d === CLOSED_DOW) continue;
      vals[d] = history[i]; total += history[i]; n++;
    }
    const mean = n > 0 ? total / n : 0;
    const index = { [CLOSED_DOW]: 0 };
    for (let d = 0; d < 7; d++) {
      if (d === CLOSED_DOW) continue;
      index[d] = mean > 0 ? (vals[d] || 0) / mean : 1;
    }
    blocks.push(index);
  }
  return blocks;
}

// Forecast week 1 uses the plain 30-day index above. Weeks 2+ use a weighted average of the weekly indices: one
// "analog" history week (the oldest first, then forward) counts 0.4, each of the others 0.2, so every forecast week
// leans on a different history week and the high / low peaks no longer repeat. A single week is noisy, so the result is
// half the weekly average and half the plain 30-day index (still averages 1 over the open days). Then distinctWeekWeights
// makes the peak, mid peak and lowest day of each week differ from those of the weeks before.
const ANALOG_WEIGHT = 0.4;
const WEEKLY_SHARE = 0.5;
const MIN_SPREAD = 0.9;
const RANK_GAP = 0.12;
function weightedWeekWeights(blockIndex, week, baseWeights) {
  const n = blockIndex.length;
  const analog = (n - 1) - ((week - 2) % n);
  const other = (1 - ANALOG_WEIGHT) / (n - 1);
  const out = { [CLOSED_DOW]: 0 };
  for (let d = 0; d < 7; d++) {
    if (d === CLOSED_DOW) continue;
    const weekly = blockIndex.reduce((acc, idx, b) => acc + (b === analog ? ANALOG_WEIGHT : other) * idx[d], 0);
    out[d] = WEEKLY_SHARE * weekly + (1 - WEEKLY_SHARE) * baseWeights[d];
  }
  return out;
}

// Weekday ranks of one week's weights: which open day is the peak, the second (mid) peak and the lowest.
function rankDays(w) {
  const order = [1, 2, 3, 4, 5, 6].sort((a, b) => w[b] - w[a] || a - b);
  return { order, peak: order[0], second: order[1], low: order[order.length - 1] };
}

// Give a forecast week its own high / mid / low days. The week's weighted-average weights keep their sizes (so the open-day
// average stays 1), but the biggest weight goes to the best-ranked day that was not the peak of an earlier week, the
// second weight to a day that was not the mid peak before, the smallest to a day that was not the low before.
// The days in between keep the order of the data. `used` holds the days already taken by earlier weeks.
function distinctWeekWeights(raw, used) {
  const { order } = rankDays(raw);
  const values = order.map((d) => raw[d]);                   // sizes, biggest first
  const pick = (list, taken, banned) => list.find((d) => !taken.has(d) && !banned.includes(d))
    ?? list.find((d) => !banned.includes(d));
  const peak = pick(order, used.peak, []);
  const low = pick([...order].reverse(), used.low, [peak]);
  const second = pick(order, used.second, [peak, low]);
  const mid = order.filter((d) => ![peak, second, low].includes(d));
  const out = { [CLOSED_DOW]: 0, [peak]: values[0], [second]: values[1], [low]: values[values.length - 1] };
  mid.forEach((d, i) => { out[d] = values[2 + i]; });
  used.peak.add(peak); used.second.add(second); used.low.add(low);
  // Tied weights have no clear order: keep a gap of at least RANK_GAP between peak, mid peak, the rest and the lowest.
  const topRest = mid.reduce((m, d) => Math.max(m, out[d]), 0);
  const lowRest = mid.reduce((m, d) => Math.min(m, out[d]), Infinity);
  out[second] = Math.max(out[second], topRest + RANK_GAP);
  out[peak] = Math.max(out[peak], out[second] + RANK_GAP);
  if (mid.length) out[low] = Math.max(0.05, Math.min(out[low], lowRest - RANK_GAP));
  const m0 = [1, 2, 3, 4, 5, 6].reduce((a, d) => a + out[d], 0) / 6;
  [1, 2, 3, 4, 5, 6].forEach((d) => { out[d] /= m0; });
  // A week whose weights are nearly flat has no readable peak: widen the spread to at least MIN_SPREAD (peak - lowest).
  const spread = out[peak] - out[low];
  if (spread > 0 && spread < MIN_SPREAD) {
    const f = Math.min(3, MIN_SPREAD / spread);
    [1, 2, 3, 4, 5, 6].forEach((d) => { out[d] = Math.max(0.05, 1 + (out[d] - 1) * f); });
    const mean = [1, 2, 3, 4, 5, 6].reduce((a, d) => a + out[d], 0) / 6;
    [1, 2, 3, 4, 5, 6].forEach((d) => { out[d] /= mean; });
  }
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

  const baseDate = resolveBaseDate(startDate);

  // Day of week of the window slot that is i days before the base date t (i = 0 is t itself).
  const dowOfBaseMinus = (i) => (((baseDate.getUTCDay() - i) % 7) + 7) % 7;

  // Day-of-week weights: a custom set is used as given (rescaled to average 1). Otherwise the seasonal index is
  // measured from the history (original 30 days, before any prediction is added to the window).
  const weights = seasonality
    ? normalizeWeights({ 0: 0, 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, ...seasonality })
    : measureSeasonality(history, dowOfBaseMinus);
  // Weeks 2+ (k > 7) of a measured forecast: weighted average of the weekly indices. A custom seasonality stays fixed.
  const blockIndex = seasonality ? null : measureWeeklySeasonality(history, dowOfBaseMinus);
  const weekWeights = {};

  // Active window: index 0 = newest day, last index = oldest day. Closed days (Sundays) hold 0 and are not counted.
  const window = history.map((v, i) => (dowOfBaseMinus(i) === CLOSED_DOW ? 0 : v));
  let windowSum = window.reduce((acc, v) => acc + v, 0);

  // Dry run of steps k0..k1 with the given weekday weights from the current window (nothing is changed).
  // Returns the predicted demand of each open weekday.
  const simulateWeek = (k0, k1, dayWeights) => {
    const win = window.slice(); let sum = windowSum; const out = {};
    for (let kk = k0; kk <= k1; kk++) {
      const dw = new Date(baseDate.getTime()); dw.setUTCDate(dw.getUTCDate() + kk);
      const d = dw.getUTCDay();
      let days = 0;
      for (let i = 0; i < WINDOW_SIZE; i++) if (dowOfBaseMinus(i - (kk - 1)) !== CLOSED_DOW) days++;
      const base = Math.max(0, (days > 0 ? sum / days : 0) * dayWeights[d]);
      if (d !== CLOSED_DOW) out[d] = base;
      const appended = parseFloat(base.toFixed(4));
      sum = sum - win.pop() + appended; win.unshift(appended);
    }
    return out;
  };

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
    const week = Math.ceil(k / 7);
    let dayWeights = weights;
    if (blockIndex && week >= 2) {
      if (!weekWeights[week]) {
        // days already taken as peak / mid peak / lowest by the weeks before, read from their real predictions
        const used = { peak: new Set(), second: new Set(), low: new Set() };
        for (let w = 1; w < week; w++) {
          const demand = {};
          forecast.filter((x) => Math.ceil(x.dayOffset / 7) === w && x.dayOfWeek !== 'Sun')
            .forEach((x) => { demand[DAY_LABELS.indexOf(x.dayOfWeek)] = x.phase1_prediction.predictedDemand; });
          if (Object.keys(demand).length < 6) continue;
          const r = rankDays(demand);
          used.peak.add(r.peak); used.second.add(r.second); used.low.add(r.low);
        }
        let wk = distinctWeekWeights(weightedWeekWeights(blockIndex, week, weights), used);
        // The average daily demand drifts inside a week, so close weights can swap places. Run the week, and where a
        // peak / mid / low day still equals one of an earlier week, widen the gap of that pair and run it again.
        if (week * 7 <= FORECAST_DAYS) {
          for (let attempt = 0; attempt < 25; attempt++) {
            const demand = simulateWeek(k, Math.min(FORECAST_DAYS, k + 6), wk);
            const want = rankDays(wk);
            const got = rankDays(demand);
            const fixes = [];
            if (used.peak.has(got.peak)) fixes.push([want.peak, got.peak, 'high']);
            if (used.second.has(got.second)) fixes.push([want.second, got.second, 'high']);
            if (used.low.has(got.low)) fixes.push([want.low, got.low, 'low']);
            if (!fixes.length) break;
            fixes.forEach(([target, offender, kind]) => {
              if (target === offender) return;
              wk[target] *= kind === 'high' ? 1.12 : 0.88;
              wk[offender] *= kind === 'high' ? 0.9 : 1.1;
            });
            const mean = [1, 2, 3, 4, 5, 6].reduce((a, d) => a + wk[d], 0) / 6;
            [1, 2, 3, 4, 5, 6].forEach((d) => { wk[d] = mean > 0 ? wk[d] / mean : 1; });
          }
        }
        weekWeights[week] = wk;
      }
      dayWeights = weekWeights[week];
    }
    const seasonalityIndex = dayWeights[dow];
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

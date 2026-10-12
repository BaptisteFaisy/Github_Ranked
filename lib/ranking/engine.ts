/**
 * Ranking Engine
 */

import type { AggregatedStats } from '@/lib/github/types';
import type { Tier, Division, RankResult } from './types';
import {
  METRIC_WEIGHTS,
  MAX_STARS_CAP,
  MEAN_LOG_SCORE,
  STD_DEV,
  BASE_ELO,
  ELO_PER_SIGMA,
  TIER_THRESHOLDS,
  TIERS_WITH_DIVISIONS,
  MAX_GP,
  MIN_GP,
} from './constants';

/** Calculate Weighted Performance Index from contribution metrics */
export function calculateWPI(stats: AggregatedStats): number {
  const cappedStars = Math.min(stats.totalStars, MAX_STARS_CAP);

  const wpi =
    stats.totalMergedPRs * METRIC_WEIGHTS.mergedPRs +
    stats.totalCodeReviews * METRIC_WEIGHTS.codeReviews +
    stats.totalIssuesClosed * METRIC_WEIGHTS.issuesClosed +
    stats.totalCommits * METRIC_WEIGHTS.commits +
    cappedStars * METRIC_WEIGHTS.stars;

  return Math.max(wpi, 1);
}

/** Calculate Z-Score (standard deviations from mean) */
export function calculateZScore(wpi: number): number {
  const logScore = Math.log(wpi);
  return (logScore - MEAN_LOG_SCORE) / STD_DEV;
}

/** Convert Z-score to Elo rating */
export function calculateElo(zScore: number): number {
  const elo = BASE_ELO + zScore * ELO_PER_SIGMA;
  return Math.max(Math.round(elo), 0);
}

/** Map Elo rating to tier */
export function getTier(elo: number): Tier {
  const tiers: Tier[] = [
    'Challenger',
    'Grandmaster',
    'Master',
    'Diamond',
    'Emerald',
    'Platinum',
    'Gold',
    'Silver',
    'Bronze',
    'Iron',
  ];

  for (const tier of tiers) {
    const { min, max } = TIER_THRESHOLDS[tier];
    if (elo >= min && elo < max) {
      return tier;
    }
  }

  // Fallback to Iron for any Elo below 0 (shouldn't happen due to clamping)
  return 'Iron';
}

/**
 * Get division within a tier from Elo rating
 *
 * Divides a tier's Elo range into 4 divisions (IV, III, II, I).
 * Division I is the highest, Division IV is the lowest.
 * Master, Grandmaster, and Challenger tiers do not use divisions.
 *
 * @param elo - Elo rating
 * @param tier - Current tier
 * @returns Division (IV → I) or null for Master+
 *
 * @example
 * ```typescript
 * const elo = 1350;
 * const tier = getTier(elo); // 'Gold'
 * const division = getDivision(elo, tier); // 'II' (Gold II)
 * ```
 */
export function getDivision(elo: number, tier: Tier): Division | null {
  // Master, Grandmaster, and Challenger do not use divisions
  if (!TIERS_WITH_DIVISIONS.has(tier)) {
    return null;
  }

  const { min, max } = TIER_THRESHOLDS[tier];
  const range = max - min;
  const position = elo - min;

  // Each division occupies 1/4 of the tier range
  const divisionSize = range / 4;

  // Division IV: lowest quarter
  if (position < divisionSize) {
    return 'IV';
  }

  // Division III: second quarter
  if (position < divisionSize * 2) {
    return 'III';
  }

  // Division II: third quarter
  if (position < divisionSize * 3) {
    return 'II';
  }

  // Division I: highest quarter
  return 'I';
}

/**
 * Calculate Git Points (GP) within current division
 *
 * GP represents progress within a division, ranging from 0-99.
 * Returns 0 for tiers without divisions (Master, Grandmaster, Challenger).
 *
 * @param elo - Elo rating
 * @param tier - Current tier
 * @param division - Current division
 * @returns Git Points (0-99) or 0 for Master+
 *
 * @example
 * ```typescript
 * const elo = 1350;
 * const tier = getTier(elo); // 'Gold'
 * const division = getDivision(elo, tier); // 'II'
 * const gp = calculateGP(elo, tier, division); // 50 (halfway through Gold II)
 * ```
 */
export function calculateGP(
  elo: number,
  tier: Tier,
  division: Division | null
): number {
  // Master, Grandmaster, and Challenger do not use GP
  if (division === null || !TIERS_WITH_DIVISIONS.has(tier)) {
    return 0;
  }

  const { min, max } = TIER_THRESHOLDS[tier];
  const tierRange = max - min;
  const divisionSize = tierRange / 4;

  // Calculate the minimum Elo for the current division
  const divisionIndex = { IV: 0, III: 1, II: 2, I: 3 }[division];
  const divisionMinElo = min + divisionIndex * divisionSize;
  const divisionMaxElo = min + (divisionIndex + 1) * divisionSize;

  // Calculate position within the division
  const positionInDivision = elo - divisionMinElo;

  // At the very end of a division (just before the next division/tier starts),
  // ensure we return MAX_GP (99)
  if (elo >= divisionMaxElo - 1) {
    return MAX_GP;
  }

  // Scale to 0-99 range
  const gp = (positionInDivision / divisionSize) * (MAX_GP + 1);

  // Clamp to valid range and floor to get integer
  const clampedGP = Math.max(MIN_GP, Math.min(MAX_GP, Math.floor(gp)));

  return clampedGP;
}

/**
 * Error function (erf) approximation
 *
 * Uses Abramowitz and Stegun approximation formula for the error function.
 * Accurate to ~1.5×10^-7 which is more than sufficient for percentile calculations.
 *
 * @param x - Input value
 * @returns Error function value erf(x)
 *
 * @internal
 */
function erf(x: number): number {
  // Constants for approximation
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  // Save the sign of x
  const sign = x >= 0 ? 1 : -1;
  const absX = Math.abs(x);

  // A&S formula 7.1.26
  const t = 1.0 / (1.0 + p * absX);
  const y =
    1.0 -
    ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX);

  return sign * y;
}

/**
 * Calculate percentile from Z-score
 *
 * Converts a Z-score to a percentile using the cumulative distribution function (CDF)
 * of the standard normal distribution. Returns a value from 0 to 100 representing
 * the percentage of developers with a lower score.
 *
 * Full float precision is preserved (no rounding) so the UI can display the
 * percentile down to 0.001% and beyond as the rating grows. Use {@link formatPercent}
 * for display.
 *
 * @param zScore - Z-score (standard deviations from mean)
 * @returns Percentile (0-100), unrounded
 *
 * @example
 * ```typescript
 * const zScore = 0; // Mean
 * const percentile = calculatePercentile(zScore); // ~50 (median)
 * ```
 *
 * @example
 * ```typescript
 * const zScore = 2; // 2 standard deviations above mean
 * const percentile = calculatePercentile(zScore); // ~97.7 (top 2.3%)
 * ```
 */
export function calculatePercentile(zScore: number): number {
  // Standard normal CDF: Φ(z) = 0.5 * (1 + erf(z / √2))
  const cdf = 0.5 * (1 + erf(zScore / Math.sqrt(2)));

  // Convert to percentile (0-100)
  const percentile = cdf * 100;

  // Clamp to valid range (handle floating point edge cases only)
  return Math.max(0, Math.min(100, percentile));
}

/**
 * Calculate "Top %" from Z-score
 *
 * Returns the share of developers ranked ABOVE this score (the upper tail of
 * the standard normal distribution). Computed directly from the complementary
 * CDF rather than as `100 - percentile` so tiny values (Top 0.001% and below)
 * keep full precision instead of degrading through floating-point cancellation.
 *
 * @param zScore - Z-score (standard deviations from mean)
 * @returns Top percentage (0-100), unrounded
 *
 * @example
 * ```typescript
 * const top = calculateTopPercent(2); // ~2.275 (top 2.275%)
 * ```
 */
export function calculateTopPercent(zScore: number): number {
  // Upper tail: 1 - Φ(z) = 0.5 * (1 - erf(z / √2))
  const upperTail = 0.5 * (1 - erf(zScore / Math.sqrt(2)));

  // Convert to percentage (0-100)
  const topPercent = upperTail * 100;

  // Clamp to valid range (handle floating point edge cases only)
  return Math.max(0, Math.min(100, topPercent));
}

/** Minimum decimals shown for a percentile / Top % value (0.001% precision). */
const DISPLAY_MIN_DECIMALS = 3;

/**
 * Maximum decimals used when extending precision near a boundary.
 * (Past ~5 decimals the erf approximation error dominates, so 6 is a hard cap.)
 */
const DISPLAY_MAX_DECIMALS = 6;

/**
 * Format a percentile / Top % value for display.
 *
 * Always shows at least 3 decimals (0.001% precision). When the value is
 * strictly inside (0, 100) but would round to a boundary ("0.000" or "100.000"),
 * decimals are extended up to 6 so the number keeps moving as the rating grows
 * instead of looking stuck — effectively no display cap.
 *
 * @param value - Percentile or Top % value (0-100)
 * @returns Formatted number without the % sign (e.g. "99.400", "0.00004")
 *
 * @example
 * ```typescript
 * formatPercent(0.6); // "0.600"
 * formatPercent(0.00004); // "0.00004" (extended, not stuck at "0.000")
 * ```
 */
export function formatPercent(value: number): string {
  const clamped = Math.max(0, Math.min(100, value));

  for (
    let decimals = DISPLAY_MIN_DECIMALS;
    decimals <= DISPLAY_MAX_DECIMALS;
    decimals++
  ) {
    const text = clamped.toFixed(decimals);
    const rounded = parseFloat(text);
    const stuckAtZero = rounded === 0 && clamped !== 0;
    const stuckAtHundred = rounded === 100 && clamped !== 100;
    if (!stuckAtZero && !stuckAtHundred) {
      return text;
    }
  }

  return clamped.toFixed(DISPLAY_MAX_DECIMALS);
}

/**
 * Calculate complete rank for a user
 *
 * Main orchestration function that calculates all ranking metrics from
 * aggregated GitHub statistics. This is the primary entry point for the
 * ranking system.
 *
 * @param stats - Aggregated GitHub statistics
 * @returns Complete rank result with all metrics
 * @throws {Error} If stats are invalid or calculation fails
 *
 * @example
 * ```typescript
 * const stats = {
 *   totalMergedPRs: 50,
 *   totalCodeReviews: 30,
 *   totalIssuesClosed: 20,
 *   totalCommits: 100,
 *   totalStars: 250,
 *   totalFollowers: 10,
 *   firstContributionYear: 2020,
 *   lastContributionYear: 2024,
 *   yearsActive: 5,
 * };
 *
 * const rank = calculateRank(stats);
 * // {
 * //   tier: 'Gold',
 * //   division: 'II',
 * //   elo: 1350,
 * //   gp: 50,
 * //   percentile: 91.772..., // unrounded full precision
 * //   wpi: 5550,
 * //   zScore: 0.375
 * // }
 * ```
 */
export function calculateRank(stats: AggregatedStats): RankResult {
  // Validate input
  if (!stats || typeof stats !== 'object') {
    throw new Error('Invalid stats: must be an AggregatedStats object');
  }

  // Step 1: Calculate Weighted Performance Index (WPI)
  const wpi = calculateWPI(stats);

  // Step 2: Transform WPI to Z-score using log-normal distribution
  const zScore = calculateZScore(wpi);

  // Step 3: Convert Z-score to Elo rating
  const elo = calculateElo(zScore);

  // Step 4: Determine tier from Elo
  const tier = getTier(elo);

  // Step 5: Determine division within tier (if applicable)
  const division = getDivision(elo, tier);

  // Step 6: Calculate Git Points within division (if applicable)
  const gp = calculateGP(elo, tier, division);

  // Step 7: Calculate percentile ranking
  const percentile = calculatePercentile(zScore);

  // Return complete rank result
  return {
    tier,
    division,
    elo,
    gp,
    percentile,
    wpi,
    zScore,
  };
}

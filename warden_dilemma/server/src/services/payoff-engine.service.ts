/**
 * Payoff Engine Service
 *
 * Generates payoff matrices for each round based on experimenter configuration.
 * Supports preset generators and custom functions (future).
 *
 * For MVP, implements static preset generator.
 */

import {
  PayoffMatrix,
  PayoffGeneratorConfig,
  ExperimentConfig,
  RoundHistory,
} from '../types';
import { logger } from './logger.service';

/**
 * Payoff Engine
 *
 * Responsible for generating payoff matrices according to configured strategy.
 */
export class PayoffEngine {
  private config: ExperimentConfig;

  constructor(config: ExperimentConfig) {
    this.config = config;
  }

  /**
   * Generate payoff matrix for a given round
   *
   * @param roundNumber - Current round number (1-indexed)
   * @param history - Array of previous round histories
   * @returns Generated payoff matrix
   */
  async generateMatrix(
    roundNumber: number,
    history: RoundHistory[]
  ): Promise<PayoffMatrix> {
    const generatorConfig = this.config.payoffGenerator;

    logger.debug('Generating payoff matrix', {
      roundNumber,
      generatorType: generatorConfig.type,
      preset: generatorConfig.preset,
    });

    let matrix: PayoffMatrix;

    if (generatorConfig.type === 'preset') {
      matrix = this.generatePresetMatrix(
        generatorConfig.preset!,
        roundNumber,
        history
      );
    } else {
      // Custom function support (Phase 2)
      throw new Error('Custom payoff generators not yet implemented');
    }

    // Validate bounds
    this.validateBounds(matrix);

    logger.debug('Payoff matrix generated', {
      roundNumber,
      matrix,
    });

    return matrix;
  }

  /**
   * Generate matrix using preset strategy
   */
  private generatePresetMatrix(
    preset: string,
    roundNumber: number,
    history: RoundHistory[]
  ): PayoffMatrix {
    switch (preset) {
      case 'static':
        return this.staticPreset();

      case 'random_walk':
        return this.randomWalkPreset(roundNumber, history);

      case 'adaptive_anti_coop':
        return this.adaptiveAntiCoopPreset(roundNumber, history);

      case 'escalating_stakes':
        return this.escalatingStakesPreset(roundNumber);

      default:
        logger.warn(`Unknown preset: ${preset}, falling back to static`);
        return this.staticPreset();
    }
  }

  /**
   * Preset: Static payoff matrix (same every round)
   *
   * For 3 players:
   * - All cooperate (R₃): 5
   * - 2 cooperate, 1 defects: cooperators get 3 (S₂), defector gets 6 (T₂)
   * - 1 cooperates, 2 defect: cooperator gets 1 (S₁), defectors get 4 (T₁)
   * - All defect (P₀): 2
   *
   * Ordering: T₂ > R₃ > T₁ > S₂ > P₀ > S₁
   *           6  > 5  > 4  > 3  > 2  > 1
   */
  private staticPreset(): PayoffMatrix {
    const N = this.config.numPlayers;

    // Generate symmetric payoffs based on number of players
    // This is a simple scaling; can be made more sophisticated
    const cooperate: number[] = [];
    const defect: number[] = [];

    for (let k = 0; k < N; k++) {
      // k = number of OTHER players who cooperated
      // Your payoff for cooperating when k others cooperate
      cooperate.push(1 + 2 * k); // S₀=1, S₁=3, S₂=5, ...

      // Your payoff for defecting when k others cooperate
      defect.push(2 + 2 * k); // P₀=2, T₁=4, T₂=6, ...
    }

    return {
      cooperate,
      defect,
      optOut: 0,
      generatedBy: 'preset',
      generatorParams: { preset: 'static' },
    };
  }

  /**
   * Preset: Random walk around baseline values
   *
   * Adds noise (±20%) to static baseline
   */
  private randomWalkPreset(
    roundNumber: number,
    history: RoundHistory[]
  ): PayoffMatrix {
    const baseline = this.staticPreset();
    const noise = 0.2; // ±20%

    const applyNoise = (value: number): number => {
      const factor = 1 + (Math.random() * 2 - 1) * noise;
      return Math.round(value * factor);
    };

    return {
      cooperate: baseline.cooperate.map(applyNoise),
      defect: baseline.defect.map(applyNoise),
      optOut: 0,
      generatedBy: 'preset',
      generatorParams: { preset: 'random_walk', noise },
    };
  }

  /**
   * Preset: Adaptive anti-cooperation
   *
   * If cooperation was high last round, increase temptation to defect.
   * If cooperation was low, make cooperation more attractive.
   */
  private adaptiveAntiCoopPreset(
    roundNumber: number,
    history: RoundHistory[]
  ): PayoffMatrix {
    const baseline = this.staticPreset();

    if (history.length === 0) {
      return baseline;
    }

    // Calculate cooperation rate from last round
    const lastRound = history[history.length - 1];
    const actions = Object.values(lastRound.actions);
    const coopCount = actions.filter((a) => a === 'C').length;
    const coopRate = coopCount / actions.length;

    // If cooperation > 50%, increase defection temptation
    const boost = coopRate > 0.5 ? 1.5 : 1.0;

    return {
      cooperate: baseline.cooperate,
      defect: baseline.defect.map((v) => Math.round(v * boost)),
      optOut: 0,
      generatedBy: 'preset',
      generatorParams: {
        preset: 'adaptive_anti_coop',
        lastCoopRate: coopRate,
        boost,
      },
    };
  }

  /**
   * Preset: Escalating stakes
   *
   * Payoffs increase linearly with round number.
   */
  private escalatingStakesPreset(roundNumber: number): PayoffMatrix {
    const baseline = this.staticPreset();
    const multiplier = roundNumber;

    return {
      cooperate: baseline.cooperate.map((v) => v * multiplier),
      defect: baseline.defect.map((v) => v * multiplier),
      optOut: 0,
      generatedBy: 'preset',
      generatorParams: { preset: 'escalating_stakes', multiplier },
    };
  }

  /**
   * Validate payoff matrix against configured bounds
   */
  private validateBounds(matrix: PayoffMatrix): void {
    const { min, max } = this.config.payoffBounds;

    const allValues = [...matrix.cooperate, ...matrix.defect, matrix.optOut];

    allValues.forEach((value) => {
      if (value < min || value > max) {
        logger.warn('Payoff value outside bounds', {
          value,
          min,
          max,
        });
      }
    });
  }

  /**
   * Validate payoff ordering (optional, for Phase 2)
   *
   * Checks if generated matrix satisfies experimenter-specified constraints.
   */
  validateOrdering(matrix: PayoffMatrix): boolean {
    // TODO: Implement ordering validation based on config.payoffOrdering
    return true;
  }
}

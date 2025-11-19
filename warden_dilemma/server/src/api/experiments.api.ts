/**
 * Experiments API
 *
 * REST endpoints for experiment CRUD operations using Redis storage.
 *
 * Endpoints:
 * - POST /api/experiments - Create new experiment
 * - GET /api/experiments - List all experiments
 * - GET /api/experiments/:id - Get experiment details
 * - GET /api/experiments/:id/results - Get experiment results
 * - DELETE /api/experiments/:id - Delete experiment
 */

import { Router, Request, Response } from 'express';
import {
  saveExperiment,
  getExperiment,
  listExperiments,
  deleteExperiment,
  getGameResult
} from '../services/redis.service';
import { logger } from '../services/logger.service';
import {
  ExperimentConfig,
  Hypothesis,
  CreateExperimentRequest,
  CreateExperimentResponse,
} from '../types';
import { v4 as uuid } from 'uuid';

const router: Router = Router();

/**
 * Create new experiment
 *
 * POST /api/experiments
 */
router.post('/experiments', async (req: Request, res: Response) => {
  try {
    const { name, config, hypothesis }: CreateExperimentRequest = req.body;

    // Validate required fields
    if (!name || !config) {
      return res.status(400).json({
        error: 'Missing required fields: name, config',
      });
    }

    // Validate config
    const validationError = validateConfig(config);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    // Create experiment
    const experimentId = uuid();
    const experiment = {
      id: experimentId,
      name,
      config,
      hypothesis,
      status: 'SETUP',
      createdAt: new Date().toISOString(),
      currentRound: 0,
    };

    await saveExperiment(experimentId, experiment);

    logger.info('Experiment created', {
      experimentId,
      name,
      numPlayers: config.numPlayers,
      numRounds: config.numRounds,
    });

    // Generate simple lobby code (last 6 chars of UUID)
    const lobbyCode = experimentId.slice(-6).toUpperCase();

    const response: CreateExperimentResponse = {
      experimentId,
      lobbyCode,
    };

    res.status(201).json(response);
  } catch (error) {
    logger.error('Failed to create experiment', error as Error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * List all experiments
 *
 * GET /api/experiments?status=<status>
 */
router.get('/experiments', async (req: Request, res: Response) => {
  try {
    const { status } = req.query;

    let experiments = await listExperiments();

    // Filter by status if provided
    if (status) {
      experiments = experiments.filter((exp: any) => exp.status === status);
    }

    res.json({ experiments });
  } catch (error) {
    logger.error('Failed to list experiments', error as Error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Get experiment details
 *
 * GET /api/experiments/:id
 */
router.get('/experiments/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const experiment = await getExperiment(id);

    if (!experiment) {
      return res.status(404).json({ error: 'Experiment not found' });
    }

    res.json({ experiment });
  } catch (error) {
    logger.error('Failed to get experiment', error as Error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Get experiment results (with analytics)
 *
 * GET /api/experiments/:id/results
 */
router.get('/experiments/:id/results', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const experiment = await getExperiment(id);
    if (!experiment) {
      return res.status(404).json({ error: 'Experiment not found' });
    }

    // Get game result (stored when game ends)
    const result = await getGameResult(id);

    // Calculate basic metrics
    const metrics = result ? calculateMetrics(result) : null;

    res.json({
      experiment,
      result,
      metrics,
    });
  } catch (error) {
    logger.error('Failed to get experiment results', error as Error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Delete experiment
 *
 * DELETE /api/experiments/:id
 */
router.delete('/experiments/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await deleteExperiment(id);

    logger.info('Experiment deleted', { experimentId: id });

    res.json({ success: true });
  } catch (error) {
    logger.error('Failed to delete experiment', error as Error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Validate experiment configuration
 */
function validateConfig(config: ExperimentConfig): string | null {
  if (!config.numPlayers || config.numPlayers < 2 || config.numPlayers > 10) {
    return 'numPlayers must be between 2 and 10';
  }

  if (!config.numRounds || config.numRounds < 1) {
    return 'numRounds must be at least 1';
  }

  if (!config.players || config.players.length !== config.numPlayers) {
    return 'players array length must match numPlayers';
  }

  if (!config.payoffGenerator) {
    return 'payoffGenerator is required';
  }

  if (!config.payoffBounds) {
    return 'payoffBounds is required';
  }

  return null;
}

/**
 * Calculate basic metrics from game result
 */
function calculateMetrics(result: any) {
  const rounds = result.rounds || [];

  if (rounds.length === 0) {
    return {
      totalRounds: 0,
      overallCooperationRate: 0,
      cooperationByRound: [],
      averagePayoffPerRound: 0,
    };
  }

  // Overall cooperation rate
  let totalActions = 0;
  let totalCooperations = 0;
  const cooperationByRound: number[] = [];

  rounds.forEach((round: any) => {
    const actions = round.actions as Record<string, string>;
    const actionValues = Object.values(actions);

    const roundCoops = actionValues.filter((a) => a === 'C').length;
    const roundTotal = actionValues.filter((a) => a !== 'OPT_OUT').length;

    totalCooperations += roundCoops;
    totalActions += roundTotal;

    cooperationByRound.push(roundTotal > 0 ? roundCoops / roundTotal : 0);
  });

  const overallCooperationRate = totalActions > 0 ? totalCooperations / totalActions : 0;

  // Average payoff per round (social welfare)
  const averagePayoffPerRound =
    rounds.reduce((sum: number, round: any) => {
      const payoffs = round.payoffs as Record<string, number>;
      return sum + Object.values(payoffs).reduce((a, b) => a + b, 0);
    }, 0) / rounds.length;

  return {
    totalRounds: rounds.length,
    overallCooperationRate,
    cooperationByRound,
    averagePayoffPerRound,
  };
}

export default router;

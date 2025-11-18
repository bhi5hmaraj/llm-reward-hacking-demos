/**
 * API Service
 *
 * HTTP client for REST API endpoints.
 */

import { CreateExperimentRequest, CreateExperimentResponse, ExperimentConfig } from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

class APIService {
  /**
   * Create new experiment
   */
  async createExperiment(data: CreateExperimentRequest): Promise<CreateExperimentResponse> {
    const response = await fetch(`${API_URL}/experiments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create experiment');
    }

    return response.json();
  }

  /**
   * Get experiment by ID
   */
  async getExperiment(experimentId: string): Promise<any> {
    const response = await fetch(`${API_URL}/experiments/${experimentId}`);

    if (!response.ok) {
      throw new Error('Failed to fetch experiment');
    }

    return response.json();
  }

  /**
   * Get experiment results
   */
  async getExperimentResults(experimentId: string): Promise<any> {
    const response = await fetch(`${API_URL}/experiments/${experimentId}/results`);

    if (!response.ok) {
      throw new Error('Failed to fetch results');
    }

    return response.json();
  }

  /**
   * List all experiments
   */
  async listExperiments(status?: string): Promise<any> {
    const url = status
      ? `${API_URL}/experiments?status=${status}`
      : `${API_URL}/experiments`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error('Failed to list experiments');
    }

    return response.json();
  }

  /**
   * Delete experiment
   */
  async deleteExperiment(experimentId: string): Promise<void> {
    const response = await fetch(`${API_URL}/experiments/${experimentId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error('Failed to delete experiment');
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<any> {
    const response = await fetch(`${API_URL.replace('/api', '')}/health`);
    return response.json();
  }
}

export const apiService = new APIService();

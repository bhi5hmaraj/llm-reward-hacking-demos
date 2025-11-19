/**
 * API Service
 *
 * HTTP client for REST API endpoints.
 */

import { CreateExperimentRequest, CreateExperimentResponse } from '../types';

// Auto-detect API URL
// If VITE_API_URL is set, use it (separate dev server)
// Otherwise, use same-origin API (production/built) under /warden_dilemma
const getAPIURL = () => {
  const envURL = import.meta.env.VITE_API_URL;
  if (envURL) return envURL;

  // Same-origin API under /warden_dilemma subpath
  return `${window.location.origin}/warden_dilemma/api`;
};

const API_URL = getAPIURL();

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
    const response = await fetch(`${window.location.origin}/warden_dilemma/health`);
    return response.json();
  }
}

export const apiService = new APIService();

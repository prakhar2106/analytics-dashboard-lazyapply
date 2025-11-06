import axios from 'axios';

const API_BASE_URL = '';

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token interceptor
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 unauthorized responses
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear token and redirect to login
      localStorage.removeItem('authToken');
      window.location.href = '/';
    }
    return Promise.reject(error);
  }
);

// Analytics API endpoints
export const analyticsAPI = {
  // Get analytics overview
  getOverview: async (params?: {
    email?: string;
    startDate?: string;
    endDate?: string;
    platform?: string;
  }) => {
    const response = await api.get('/lazyapplyV2/form-analysis/analytics/overview', { params });
    return response.data;
  },

  // Get filtered applications
  getFilteredApplications: async (params?: {
    email?: string;
    startDate?: string;
    endDate?: string;
    platform?: string;
    minFields?: number;
    maxFields?: number;
    completionRate?: number;
    limit?: number;
    offset?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }) => {
    const response = await api.get('/lazyapplyV2/form-analysis/analytics/filtered', { params });
    return response.data;
  },

  // Get selected applications stats
  getSelectedStats: async (applicationIds: string[]) => {
    const response = await api.post('/lazyapplyV2/form-analysis/analytics/selected/stats', {
      applicationIds,
    });
    return response.data;
  },

  // Get AI analysis
  getAIAnalysis: async (applicationIds: string[], analysisType: string = 'general') => {
    const response = await api.post('/lazyapplyV2/form-analysis/analytics/ai-analysis', {
      applicationIds,
      analysisType,
    });
    return response.data;
  },

  // Get field type analytics
  getFieldTypeAnalytics: async (params?: {
    email?: string;
    startDate?: string;
    endDate?: string;
    platform?: string;
  }) => {
    const response = await api.get('/lazyapplyV2/form-analysis/analytics/field-types', { params });
    return response.data;
  },

  // Get individual application AI analysis
  getIndividualAIAnalysis: async (analysisId: string) => {
    const response = await api.get(`/lazyapplyV2/form-analysis/analytics/${analysisId}/ai-analysis`);
    return response.data;
  },

  // Get application by ID
  getApplicationById: async (analysisId: string) => {
    const response = await api.get(`/lazyapplyV2/form-analysis/${analysisId}`);
    return response.data;
  },

      // Get job links by platform
      getJobLinksByPlatform: async (params?: {
        platform?: string;
        email?: string;
        limit?: number;
        perEmailLimit?: number;
      }) => {
        const response = await api.get('/lazyapplyV2/form-analysis/analytics/job-links', { params });
        return response.data;
      },
    };

    // Job Search Analytics API endpoints
    export const jobSearchAnalyticsAPI = {
      // Get job search analytics overview
      getOverview: async (params?: {
        email?: string;
        startDate?: string;
        endDate?: string;
        interrupted?: string;
        interruptedReason?: string;
        minJobsFound?: number;
        maxJobsFound?: number;
      }) => {
        const response = await api.get('/lazyapplyV2/job-search/analytics/overview', { params });
        return response.data;
      },

      // Get filtered job searches
      getFilteredSearches: async (params?: {
        email?: string;
        startDate?: string;
        endDate?: string;
        minJobsFound?: number;
        maxJobsFound?: number;
        interrupted?: string;
        interruptedReason?: string;
        limit?: number;
        offset?: number;
        sortBy?: string;
        sortOrder?: 'asc' | 'desc';
      }) => {
        const response = await api.get('/lazyapplyV2/job-search/analytics/filtered', { params });
        return response.data;
      },

      // Get job search by ID
      getJobSearchById: async (searchId: string) => {
        const response = await api.get(`/lazyapplyV2/job-search/analytics/${searchId}`);
        return response.data;
      },

      // Get low return rate searches
      getLowReturnRateSearches: async (params?: {
        email?: string;
        startDate?: string;
        endDate?: string;
        percentage?: number;
        interrupted?: string;
        interruptedReason?: string;
        limit?: number;
        offset?: number;
        sortBy?: string;
        sortOrder?: 'asc' | 'desc';
      }) => {
        const response = await api.get('/lazyapplyV2/job-search/analytics/low-return-rate/searches', { params });
        return response.data;
      },

      // Get low return rate analytics
      getLowReturnRateAnalytics: async (params?: {
        email?: string;
        startDate?: string;
        endDate?: string;
        percentage?: number;
        interrupted?: string;
        interruptedReason?: string;
      }) => {
        const response = await api.get('/lazyapplyV2/job-search/analytics/low-return-rate/analytics', { params });
        return response.data;
      },
    }

    // Prompt Management API endpoints
    export const promptAPI = {
      // Get active prompt for a prompt type
      getActivePrompt: async (promptType: 'validateJobTitle' | 'validateLocation') => {
        const response = await api.get(`/lazyapplyV2/job-search/prompts/${promptType}`)
        return response.data
      },

      // Get all prompts for user
      getAllPrompts: async (promptType?: 'validateJobTitle' | 'validateLocation') => {
        const params = promptType ? { promptType } : {}
        const response = await api.get('/lazyapplyV2/job-search/prompts', { params })
        return response.data
      },

      // Save a new prompt version
      savePrompt: async (data: {
        promptType: 'validateJobTitle' | 'validateLocation'
        promptContent: string
        description?: string
      }) => {
        const response = await api.post('/lazyapplyV2/job-search/prompts', data)
        return response.data
      },

      // Deactivate a prompt
      deactivatePrompt: async (promptId: string) => {
        const response = await api.put(`/lazyapplyV2/job-search/prompts/${promptId}/deactivate`)
        return response.data
      },

      // Get prompts for a specific search
      getPromptForSearch: async (searchId: string) => {
        const response = await api.get(`/lazyapplyV2/job-search/analytics/${searchId}/prompts`)
        return response.data
      },

      // Test prompts with original titles and locations
      testPrompts: async (data: {
        originalTitles: string[]
        originalLocations: string[]
      }) => {
        const response = await api.post('/lazyapplyV2/job-search/prompts/test', data)
        return response.data
      },

      // Test job search with updated prompts (returns job count)
      testJobSearch: async (data: {
        titles: string[]
        locations?: string[]
        country?: string
        results?: number
        timeFilter?: string
        language?: string
        safeSearch?: string
        searchType?: string
        filtersForBackend?: any
      }) => {
        const response = await api.post('/lazyapplyV2/job-search-test', data)
        return response.data
      },
    }

    export default api;


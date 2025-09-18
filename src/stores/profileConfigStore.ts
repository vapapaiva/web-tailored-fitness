import { create } from 'zustand';
import { fetchAndActivate, getValue } from 'firebase/remote-config';
import { remoteConfig } from '@/lib/firebase';
import type { ProfileConfig } from '@/types/profile';

interface ProfileConfigState {
  config: ProfileConfig | null;
  loading: boolean;
  error: string | null;
  
  // Actions
  fetchConfig: () => Promise<void>;
  clearError: () => void;
}

export const useProfileConfigStore = create<ProfileConfigState>((set) => ({
  config: null,
  loading: false,
  error: null,

  fetchConfig: async () => {
    try {
      set({ loading: true, error: null });

      // Fetch and activate Remote Config
      await fetchAndActivate(remoteConfig);
      
      // Get the profile configuration
      const configValue = getValue(remoteConfig, 'profile_config');
      const configString = configValue.asString();
      
      console.log('Remote Config Profile source:', configValue.getSource());
      console.log('Profile config available:', !!configString);
      
      if (!configString) {
        throw new Error('Profile configuration not found in Firebase Remote Config. Please ensure the "profile_config" parameter is set up in your Firebase console.');
      }

      const config: ProfileConfig = JSON.parse(configString);
      
      // Validate the configuration structure
      if (!config.version || !config.sections || !Array.isArray(config.sections)) {
        throw new Error('Invalid profile configuration structure in Firebase Remote Config');
      }

      // Sort sections and fields by order
      config.sections.sort((a, b) => a.order - b.order);
      config.sections.forEach(section => {
        section.fields.sort((a, b) => a.order - b.order);
      });

      set({ config, loading: false });
    } catch (error) {
      console.error('Failed to fetch profile config from Firebase Remote Config:', error);
      
      set({ 
        config: null,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch configuration from Firebase Remote Config'
      });
    }
  },

  clearError: () => set({ error: null }),
}));

/**
 * Helper functions for working with profile configuration
 */
export const useProfileConfigHelpers = () => {
  const { config } = useProfileConfigStore();

  const getAllFields = () => {
    if (!config) return [];
    return config.sections.flatMap(section => section.fields);
  };

  const getFieldById = (fieldId: string) => {
    const allFields = getAllFields();
    return allFields.find(field => field.id === fieldId);
  };

  const getSectionByFieldId = (fieldId: string) => {
    if (!config) return null;
    return config.sections.find(section => 
      section.fields.some(field => field.id === fieldId)
    );
  };

  const getRequiredFields = () => {
    return getAllFields().filter(field => field.isRequired);
  };

  const validateProfile = (profile: Record<string, any>) => {
    const requiredFields = getRequiredFields();
    const missingFields: string[] = [];

    for (const field of requiredFields) {
      const value = profile[field.id];
      if (value === undefined || value === null || value === '') {
        missingFields.push(field.id);
      }
    }

    return {
      isValid: missingFields.length === 0,
      missingFields
    };
  };

  return {
    getAllFields,
    getFieldById,
    getSectionByFieldId,
    getRequiredFields,
    validateProfile
  };
};

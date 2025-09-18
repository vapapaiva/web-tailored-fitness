import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { useProfileConfigStore, useProfileConfigHelpers } from '@/stores/profileConfigStore';
import type { OnboardingState, ProfileFieldValue } from '@/types/profile';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { FormField } from '@/components/forms/FormField';

/**
 * Onboarding flow component - shows one question per screen
 */
export function OnboardingFlow() {
  const navigate = useNavigate();
  const { user, updateProfile, markOnboardingComplete } = useAuthStore();
  const { config, loading: configLoading, error: configError } = useProfileConfigStore();
  const { validateProfile } = useProfileConfigHelpers();
  
  const [onboardingState, setOnboardingState] = useState<OnboardingState>({
    currentSectionIndex: 0,
    currentFieldIndex: 0,
    answers: user?.profile || {},
    isComplete: false,
  });
  
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Get current field and section
  const currentSection = config?.sections[onboardingState.currentSectionIndex];
  const currentField = currentSection?.fields[onboardingState.currentFieldIndex];
  
  // Calculate progress
  const totalFields = config?.sections.reduce((acc, section) => acc + section.fields.length, 0) || 1;
  const completedFields = (config?.sections
    .slice(0, onboardingState.currentSectionIndex)
    .reduce((acc, section) => acc + section.fields.length, 0) || 0) + onboardingState.currentFieldIndex;
  const progress = (completedFields / totalFields) * 100;

  const validateCurrentField = (): boolean => {
    if (!currentField) return true;
    
    const value = onboardingState.answers[currentField.id];
    const newErrors = { ...errors };
    
    // Clear previous error
    delete newErrors[currentField.id];
    
    // Required field validation
    if (currentField.isRequired && (value === undefined || value === null || value === '')) {
      newErrors[currentField.id] = `${currentField.label} is required`;
      setErrors(newErrors);
      return false;
    }
    
    // Number validation
    if (currentField.type === 'number' && value !== undefined && value !== '') {
      const numValue = Number(value);
      if (currentField.validation?.min !== undefined && numValue < currentField.validation.min) {
        newErrors[currentField.id] = currentField.validation.errorMessage || 
          `${currentField.label} must be at least ${currentField.validation.min}`;
      }
      if (currentField.validation?.max !== undefined && numValue > currentField.validation.max) {
        newErrors[currentField.id] = currentField.validation.errorMessage || 
          `${currentField.label} must be at most ${currentField.validation.max}`;
      }
    }
    
    // Array validation for multiple choice
    if (currentField.type === 'multipleChoice' && currentField.isRequired) {
      const arrayValue = value as string[];
      if (!arrayValue || arrayValue.length === 0) {
        newErrors[currentField.id] = `Please select at least one option for ${currentField.label}`;
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (!validateCurrentField()) return;
    
    if (!config) return;
    
    const nextFieldIndex = onboardingState.currentFieldIndex + 1;
    const currentSectionFields = config.sections[onboardingState.currentSectionIndex].fields;
    
    if (nextFieldIndex < currentSectionFields.length) {
      // Move to next field in current section
      setOnboardingState(prev => ({
        ...prev,
        currentFieldIndex: nextFieldIndex
      }));
    } else {
      // Move to next section
      const nextSectionIndex = onboardingState.currentSectionIndex + 1;
      if (nextSectionIndex < config.sections.length) {
        setOnboardingState(prev => ({
          ...prev,
          currentSectionIndex: nextSectionIndex,
          currentFieldIndex: 0
        }));
      } else {
        // Onboarding complete
        handleComplete();
      }
    }
  };

  const handlePrevious = () => {
    if (onboardingState.currentFieldIndex > 0) {
      // Move to previous field in current section
      setOnboardingState(prev => ({
        ...prev,
        currentFieldIndex: prev.currentFieldIndex - 1
      }));
    } else if (onboardingState.currentSectionIndex > 0) {
      // Move to previous section
      const prevSectionIndex = onboardingState.currentSectionIndex - 1;
      const prevSectionFields = config?.sections[prevSectionIndex].fields.length || 0;
      setOnboardingState(prev => ({
        ...prev,
        currentSectionIndex: prevSectionIndex,
        currentFieldIndex: prevSectionFields - 1
      }));
    }
  };

  const handleComplete = async () => {
    if (!user) return;
    
    setIsSubmitting(true);
    try {
      // Validate complete profile
      const validation = validateProfile(onboardingState.answers);
      if (!validation.isValid) {
        console.error('Profile validation failed:', validation.missingFields);
        // Could show error or navigate to missing fields
        return;
      }
      
      // Save profile and mark onboarding as complete
      await updateProfile({
        profile: onboardingState.answers,
      });
      await markOnboardingComplete();
      
      // Navigate to main app
      navigate('/app');
    } catch (error) {
      console.error('Failed to complete onboarding:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFieldChange = (fieldId: string, value: ProfileFieldValue) => {
    setOnboardingState(prev => ({
      ...prev,
      answers: {
        ...prev.answers,
        [fieldId]: value
      }
    }));
    
    // Clear field error when user starts typing
    if (errors[fieldId]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[fieldId];
        return newErrors;
      });
    }
  };

  // Calculate navigation state
  const isFirstField = onboardingState.currentSectionIndex === 0 && onboardingState.currentFieldIndex === 0;
  const isLastField = config ? (onboardingState.currentSectionIndex === config.sections.length - 1 && 
    onboardingState.currentFieldIndex === config.sections[config.sections.length - 1].fields.length - 1) : false;

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't interfere if user is typing in an input field or clicking buttons
      if (event.target instanceof HTMLInputElement || 
          event.target instanceof HTMLTextAreaElement ||
          event.target instanceof HTMLButtonElement ||
          (event.target as HTMLElement)?.closest('button')) {
        if (event.key === 'Enter' && 
            (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement)) {
          // Enter in text/number fields should go to next question
          if (currentField?.type === 'text' || currentField?.type === 'number') {
            event.preventDefault();
            handleNext();
          }
        }
        return;
      }

      switch (event.key) {
        case 'ArrowLeft':
          event.preventDefault();
          if (!isFirstField) {
            handlePrevious();
          }
          break;
        case 'ArrowRight':
          event.preventDefault();
          if (!isSubmitting) {
            handleNext();
          }
          break;
        case 'Enter':
          // Only handle Enter for keyboard navigation if not focused on interactive elements
          event.preventDefault();
          if (!isSubmitting) {
            handleNext();
          }
          break;
        case '1':
        case '2':
        case '3':
        case '4':
        case '5':
        case '6':
        case '7':
        case '8':
        case '9':
          // Number keys for single/multiple choice selection
          if (currentField?.type === 'singleChoice' || currentField?.type === 'multipleChoice') {
            const optionIndex = parseInt(event.key) - 1;
            const option = currentField.options?.[optionIndex];
            if (option) {
              event.preventDefault();
              if (currentField.type === 'singleChoice') {
                handleFieldChange(currentField.id, option.id);
              } else {
                // For multiple choice, toggle the option
                const currentValues = (onboardingState.answers[currentField.id] as string[]) || [];
                let newValues = [...currentValues];
                if (newValues.includes(option.id)) {
                  newValues = newValues.filter(v => v !== option.id);
                } else {
                  if (option.isNoneOption) {
                    newValues = [option.id];
                  } else {
                    newValues = newValues.filter(v => {
                      const opt = currentField.options?.find(o => o.id === v);
                      return !opt?.isNoneOption;
                    });
                    newValues.push(option.id);
                  }
                }
                handleFieldChange(currentField.id, newValues);
              }
            }
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [currentField, isFirstField, isSubmitting, onboardingState.answers]);

  // Focus management for better keyboard navigation
  useEffect(() => {
    // Focus the first interactive element when the question changes
    const timer = setTimeout(() => {
      if (currentField?.type === 'text' || currentField?.type === 'number') {
        const input = document.querySelector('input[type="text"], input[type="number"]') as HTMLInputElement;
        input?.focus();
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [currentField?.id]);

  if (configLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground">Loading onboarding configuration...</p>
        </div>
      </div>
    );
  }

  if (configError || !config) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-destructive">Configuration Error</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {configError || 'Failed to load profile configuration from Firebase Remote Config.'}
            </p>
            <div className="flex space-x-2">
              <Button onClick={() => navigate('/app')} variant="outline" className="flex-1">
                Return to App
              </Button>
              <Button onClick={() => window.location.reload()} className="flex-1">
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!currentField) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <p className="text-muted-foreground">Onboarding configuration error</p>
            <Button onClick={() => navigate('/app')} className="mt-4">
              Continue to App
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold">Setup Your Profile</h1>
            <span className="text-sm text-muted-foreground">
              {completedFields + 1} of {totalFields}
            </span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Current Question */}
        <Card>
          <CardHeader>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground font-medium">
                {currentSection?.title}
              </p>
              <CardTitle className="text-xl">
                {currentField.questionTitle}
              </CardTitle>
              {currentField.questionMotivation && (
                <p className="text-muted-foreground">
                  {currentField.questionMotivation}
                </p>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <FormField
              field={currentField}
              value={onboardingState.answers[currentField.id]}
              onChange={(value) => handleFieldChange(currentField.id, value)}
              error={errors[currentField.id]}
            />
            
            {/* Keyboard shortcuts hint */}
            <div className="text-xs text-muted-foreground space-y-1">
              {(currentField.type === 'text' || currentField.type === 'number') && (
                <p>💡 Press <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">Enter</kbd> to continue</p>
              )}
              {(currentField.type === 'singleChoice' || currentField.type === 'multipleChoice') && currentField.options && (
                <p>💡 Use number keys <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">1-{Math.min(currentField.options.length, 9)}</kbd> to select options</p>
              )}
              <p>Use <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">←</kbd> <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">→</kbd> arrow keys to navigate</p>
            </div>
            
            {/* Navigation */}
            <div className="flex justify-between pt-4">
              <Button
                variant="outline"
                onClick={handlePrevious}
                disabled={isFirstField}
              >
                Previous
              </Button>
              
              <Button
                onClick={handleNext}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Completing...
                  </div>
                ) : isLastField ? (
                  'Complete Setup'
                ) : (
                  'Next'
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

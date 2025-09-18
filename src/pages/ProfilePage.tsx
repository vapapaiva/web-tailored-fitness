import { useState, useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useProfileConfigStore } from '@/stores/profileConfigStore';
import type { UserProfile, ProfileFieldValue } from '@/types/profile';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FormField } from '@/components/forms/FormField';
import { CollapsibleChoiceField } from '@/components/forms/CollapsibleChoiceField';
import { Save, User } from 'lucide-react';

/**
 * Profile page showing all fields on one screen for editing
 */
export function ProfilePage() {
  const { user, updateProfile } = useAuthStore();
  const { config, loading: configLoading, error: configError } = useProfileConfigStore();
  
  const [profileData, setProfileData] = useState<UserProfile>(user?.profile || {});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Update local state when user profile changes
  useEffect(() => {
    if (user?.profile) {
      setProfileData(user.profile);
      setHasChanges(false);
    }
  }, [user?.profile]);

  const handleFieldChange = (fieldId: string, value: ProfileFieldValue) => {
    setProfileData(prev => ({
      ...prev,
      [fieldId]: value
    }));
    setHasChanges(true);
    
    // Clear field error when user starts editing
    if (errors[fieldId]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[fieldId];
        return newErrors;
      });
    }
  };

  const validateAllFields = (): boolean => {
    if (!config) return true;
    
    const newErrors: Record<string, string> = {};
    
    // Validate each field
    config.sections.forEach(section => {
      section.fields.forEach(field => {
        const value = profileData[field.id];
        
        // Required field validation
        if (field.isRequired && (value === undefined || value === null || value === '')) {
          newErrors[field.id] = `${field.label} is required`;
          return;
        }
        
        // Number validation
        if (field.type === 'number' && value !== undefined && value !== '') {
          const numValue = Number(value);
          if (field.validation?.min !== undefined && numValue < field.validation.min) {
            newErrors[field.id] = field.validation.errorMessage || 
              `${field.label} must be at least ${field.validation.min}`;
          }
          if (field.validation?.max !== undefined && numValue > field.validation.max) {
            newErrors[field.id] = field.validation.errorMessage || 
              `${field.label} must be at most ${field.validation.max}`;
          }
        }
        
        // Array validation for multiple choice
        if (field.type === 'multipleChoice' && field.isRequired) {
          const arrayValue = value as string[];
          if (!arrayValue || arrayValue.length === 0) {
            newErrors[field.id] = `Please select at least one option for ${field.label}`;
          }
        }
      });
    });
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateAllFields()) return;
    
    setIsSubmitting(true);
    try {
      await updateProfile({ profile: profileData });
      setHasChanges(false);
    } catch (error) {
      console.error('Failed to save profile:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setProfileData(user?.profile || {});
    setErrors({});
    setHasChanges(false);
  };

  if (configLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center space-y-4">
          <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground">Loading profile configuration...</p>
        </div>
      </div>
    );
  }

  if (configError || !config) {
    return (
      <div className="container mx-auto p-6">
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle className="text-destructive">Configuration Error</CardTitle>
            <CardDescription>
              Unable to load profile configuration from Firebase Remote Config
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {configError || 'Failed to load profile configuration. Please contact support.'}
            </p>
            <div className="flex space-x-2">
              <Button onClick={() => window.location.reload()} variant="outline" className="flex-1">
                Retry
              </Button>
              <Button onClick={() => window.location.href = '/app'} className="flex-1">
                Return to App
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <User className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Profile</h1>
              <p className="text-muted-foreground">
                Manage your fitness preferences and personal information
              </p>
            </div>
          </div>
          
          {hasChanges && (
            <div className="flex space-x-2">
              <Button variant="outline" onClick={handleReset}>
                Reset
              </Button>
              <Button onClick={handleSave} disabled={isSubmitting}>
                {isSubmitting ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Saving...
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Save className="h-4 w-4" />
                    Save Changes
                  </div>
                )}
              </Button>
            </div>
          )}
        </div>

        {/* Profile Form */}
        <div className="space-y-8">
          {config.sections.map((section) => (
            <Card key={section.id}>
              <CardHeader>
                <CardTitle>{section.title}</CardTitle>
                <CardDescription>
                  Complete the fields in this section
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-6 md:grid-cols-2">
                  {section.fields.map((field) => {
                    // Only these field types should be full width by default
                    const shouldSpanFullWidth = 
                      field.type === 'multipleChoice' || 
                      field.id === 'workoutDays'; // Days per week slider needs full width
                    
                    return (
                      <div
                        key={field.id}
                        className={shouldSpanFullWidth ? 'md:col-span-2' : ''}
                      >
                      {(field.type === 'singleChoice' || field.type === 'multipleChoice') ? (
                        <CollapsibleChoiceField
                          field={field}
                          value={profileData[field.id]}
                          onChange={(value) => handleFieldChange(field.id, value)}
                          error={errors[field.id]}
                        />
                      ) : (
                        <FormField
                          field={field}
                          value={profileData[field.id]}
                          onChange={(value) => handleFieldChange(field.id, value)}
                          error={errors[field.id]}
                        />
                      )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Save Button (Fixed at bottom on mobile) */}
        {hasChanges && (
          <div className="sticky bottom-4 md:hidden">
            <div className="flex space-x-2 bg-background/80 backdrop-blur-sm border rounded-lg p-3">
              <Button variant="outline" onClick={handleReset} className="flex-1">
                Reset
              </Button>
              <Button onClick={handleSave} disabled={isSubmitting} className="flex-1">
                {isSubmitting ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Saving...
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Save className="h-4 w-4" />
                    Save
                  </div>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

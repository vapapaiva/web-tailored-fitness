/**
 * Profile configuration types based on the Firebase Remote Config structure
 */

export interface ProfileFieldOption {
  id: string;
  label: string;
  subLabel?: string;
  isNoneOption: boolean;
}

export interface ProfileFieldValidation {
  min?: number;
  max?: number;
  errorMessage?: string;
}

export interface ProfileField {
  id: string;
  type: 'number' | 'singleChoice' | 'multipleChoice' | 'text' | 'stepper';
  label: string;
  questionTitle: string;
  questionSubtitle?: string;
  questionMotivation?: string;
  section: string;
  isRequired: boolean;
  order: number;
  unit?: string;
  icon?: string;
  validation?: ProfileFieldValidation;
  options?: ProfileFieldOption[];
  allowsCustomInput: boolean;
  allowsNoneOption: boolean;
}

export interface ProfileSection {
  id: string;
  title: string;
  order: number;
  fields: ProfileField[];
}

export interface ProfileConfig {
  version: string;
  sections: ProfileSection[];
}

/**
 * User profile data types
 */
export type ProfileFieldValue = string | number | string[] | boolean;

export interface UserProfile {
  [fieldId: string]: ProfileFieldValue;
}

export interface UserData {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  profile?: UserProfile;
  onboardingCompleted: boolean;
  theme: 'light' | 'dark' | 'system';
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Auth state types
 */
export interface AuthState {
  user: UserData | null;
  loading: boolean;
  error: string | null;
}

/**
 * Profile form types
 */
export interface FormFieldProps {
  field: ProfileField;
  value: ProfileFieldValue | undefined;
  onChange: (value: ProfileFieldValue) => void;
  error?: string;
}

export interface OnboardingState {
  currentSectionIndex: number;
  currentFieldIndex: number;
  answers: UserProfile;
  isComplete: boolean;
}

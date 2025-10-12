import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { useProfileConfigStore } from '@/stores/profileConfigStore';
import { useThemeStore } from '@/stores/themeStore';

// Components
import { SignInPage } from '@/components/auth/SignInPage';
import { OnboardingFlow } from '@/components/onboarding/OnboardingFlow';
import { AppLayout } from '@/components/layout/AppLayout';

// Pages
import { WorkoutsPage } from '@/pages/WorkoutsPage';
import { FitnessPlanPage } from '@/pages/FitnessPlanPage';
import { ProgressPage } from '@/pages/ProgressPage';
import { ProfilePage } from '@/pages/ProfilePage';
import { TestingPage } from '@/pages/TestingPage';
import { GapRecoveryPage } from '@/pages/GapRecoveryPage';

/**
 * Main App component with routing and authentication logic
 */
function App() {
  const { user, loading: authLoading, initialize: initializeAuth } = useAuthStore();
  const { fetchConfig } = useProfileConfigStore();
  const { initialize: initializeTheme } = useThemeStore();

  // Initialize stores on app start
  useEffect(() => {
    const cleanupAuth = initializeAuth();
    initializeTheme();
    
    // Fetch profile configuration
    fetchConfig();

    return cleanupAuth;
  }, [initializeAuth, initializeTheme, fetchConfig]);

  // Show loading screen while initializing
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route 
          path="/" 
          element={
            user ? (
              user.onboardingCompleted ? (
                <Navigate to="/app" replace />
              ) : (
                <Navigate to="/onboarding" replace />
              )
            ) : (
              <SignInPage />
            )
          } 
        />
        
        {/* Onboarding route */}
        <Route 
          path="/onboarding" 
          element={
            user ? (
              user.onboardingCompleted ? (
                <Navigate to="/app" replace />
              ) : (
                <OnboardingFlow />
              )
            ) : (
              <Navigate to="/" replace />
            )
          } 
        />
        
        {/* Protected app routes */}
        <Route 
          path="/app" 
          element={
            user ? (
              user.onboardingCompleted ? (
                <AppLayout />
              ) : (
                <Navigate to="/onboarding" replace />
              )
            ) : (
              <Navigate to="/" replace />
            )
          }
        >
          <Route index element={<FitnessPlanPage />} />
          <Route path="workouts" element={<WorkoutsPage />} />
          <Route path="progress" element={<ProgressPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="testing" element={<TestingPage />} />
          <Route path="gap-recovery" element={<GapRecoveryPage />} />
        </Route>
        
        {/* Catch all route */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

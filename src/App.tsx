import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { useEffect } from "react";
import Index from "./pages/Index";
import IngredientsPage from "./pages/IngredientsPage";
import RecipePage from "./pages/RecipePage";
import AdminPage from "./pages/AdminPage";
import NotFound from "./pages/NotFound";
import UpgradePage from '@/pages/UpgradePage';
import EmailLinkAuthPage from '@/pages/EmailLinkAuthPage';
import UserPortalPage from '@/pages/UserPortalPage';
import PaymentSuccessPage from '@/pages/PaymentSuccessPage';
import PaymentCanceledPage from '@/pages/PaymentCanceledPage';
import { initializeUsageService } from '@/services/usageService';
import { initializeRetryProcessor, attemptPaymentRecovery } from '@/services/stripeService';
import { useAuthStore } from '@/services/firebaseService';
import { Analytics } from '@vercel/analytics/react';
import { ThemeProvider } from '@/components/theme-provider';
import { RouterProvider } from 'react-router-dom';

const queryClient = new QueryClient();

const App = () => {
  const { user, loading } = useAuthStore();

  // Initialize services
  useEffect(() => {
    // Initialize usage service (premium status checks)
    initializeUsageService();
    
    // Initialize premium status retry processor
    const cleanupRetryProcessor = initializeRetryProcessor();
    
    // Cleanup function
    return () => {
      if (cleanupRetryProcessor) cleanupRetryProcessor();
    };
  }, []);

  // Attempt payment recovery when user is authenticated
  useEffect(() => {
    // Only try to recover payments when:
    // 1. Auth loading is complete
    // 2. User is authenticated
    if (!loading && user) {
      // Attempt payment recovery
      attemptPaymentRecovery()
        .then(success => {
          if (success) {
            console.log('Successfully recovered payment status');
          }
        })
        .catch(error => {
          console.error('Error during payment recovery:', error);
        });
    }
  }, [user, loading]);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
        <Toaster />
        <Sonner />
        <Router>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/ingredients" element={<IngredientsPage />} />
            <Route path="/recipe" element={<RecipePage />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/upgrade" element={<UpgradePage />} />
            <Route path="/auth/email-link" element={<EmailLinkAuthPage />} />
            <Route path="/portal" element={<UserPortalPage />} />
            <Route path="/payment-success" element={<PaymentSuccessPage />} />
            <Route path="/payment-canceled" element={<PaymentCanceledPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Router>
        <Analytics />
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;

import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
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

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
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
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

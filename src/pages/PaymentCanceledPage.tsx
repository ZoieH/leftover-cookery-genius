import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Layout from '@/components/Layout';

const PaymentCanceledPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  useEffect(() => {
    // Log the cancellation
    console.log('Payment was canceled by the user');
    
    // Clean up any payment-related localStorage items
    localStorage.removeItem('payment_initiated');
    localStorage.removeItem('payment_started_at');
    localStorage.removeItem('payment_success_pending');
    localStorage.removeItem('pending_premium_user_id');
    
    // Keep return URL in case user wants to try again
  }, []);
  
  const getReturnUrl = () => {
    // First check URL parameters
    const params = new URLSearchParams(location.search);
    const returnUrl = params.get('returnUrl');
    
    if (returnUrl) {
      return decodeURIComponent(returnUrl);
    }
    
    // Then check localStorage
    const storedReturnUrl = localStorage.getItem('payment_return_url');
    if (storedReturnUrl) {
      return storedReturnUrl;
    }
    
    // Default to home
    return '/';
  };

  const handleTryAgain = () => {
    navigate('/upgrade');
  };

  const handleReturn = () => {
    const returnUrl = getReturnUrl();
    navigate(returnUrl);
  };

  return (
    <Layout>
      <div className="container max-w-md mx-auto py-12 px-4">
        <div className="bg-card border rounded-lg shadow-sm p-6 text-center">
          <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Payment Canceled</h1>
          <p className="text-muted-foreground mb-6">
            Your payment process was canceled. No charges have been made.
          </p>
          <div className="flex flex-col gap-2">
            <Button onClick={handleTryAgain} className="w-full">
              Try Again
            </Button>
            <Button variant="outline" onClick={handleReturn} className="w-full">
              Return to Previous Page
            </Button>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default PaymentCanceledPage; 
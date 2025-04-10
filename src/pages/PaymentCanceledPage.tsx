import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Layout from '@/components/Layout';

const PaymentCanceledPage = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const getReturnUrl = () => {
    const params = new URLSearchParams(location.search);
    const returnUrl = params.get('returnUrl');
    return returnUrl ? decodeURIComponent(returnUrl) : '/';
  };

  return (
    <Layout>
      <div className="container max-w-md mx-auto py-12 px-4">
        <div className="bg-card border rounded-lg shadow-sm p-6 text-center">
          <XCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Payment Canceled</h1>
          <p className="text-muted-foreground mb-6">
            Your payment was canceled. No charges were made to your account.
          </p>
          <div className="flex flex-col gap-2">
            <Button 
              onClick={() => navigate('/upgrade')} 
              className="w-full"
            >
              Try Again
            </Button>
            <Button 
              variant="outline" 
              onClick={() => navigate(getReturnUrl())} 
              className="w-full"
            >
              Return to Previous Page
            </Button>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default PaymentCanceledPage; 
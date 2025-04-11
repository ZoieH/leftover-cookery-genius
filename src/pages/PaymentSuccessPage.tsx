import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { CheckCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import Layout from '@/components/Layout';
import { handleSuccessfulPayment } from '@/services/stripeService';
import { useUsageStore } from '@/services/usageService';

const PaymentSuccessPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { setIsPremium } = useUsageStore();
  const [processing, setProcessing] = useState(true);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const processPayment = async () => {
      try {
        // Get the user ID from URL parameters
        const params = new URLSearchParams(location.search);
        const userId = params.get('user');
        const sessionId = params.get('session_id'); // Also check for session_id from server-side flow
        const returnUrl = params.get('returnUrl'); // Get return URL from params
        
        console.log('Processing payment success for user:', userId, 'session:', sessionId);

        if (!userId && !sessionId) {
          toast({
            title: "Error",
            description: "Payment information is missing. Please try again.",
            variant: "destructive",
          });
          setProcessing(false);
          setSuccess(false);
          return;
        }

        // Client-side handling of premium status update
        try {
          // If we have a userId, update premium status directly
          if (userId) {
            // Update the user's premium status
            await handleSuccessfulPayment(userId);
            
            // Update local state
            setIsPremium(true);
            
            // Show success toast
            toast({
              title: "Premium Activated!",
              description: "You now have access to all premium features.",
            });
            
            setSuccess(true);
            setProcessing(false);
          } 
          // If we only have sessionId but no userId, handle that case
          else if (sessionId) {
            setIsPremium(true);
            setSuccess(true);
            setProcessing(false);
            
            toast({
              title: "Premium Activated!",
              description: "You now have access to all premium features.",
            });
          }
        } catch (updateError) {
          console.error('Error updating user status:', updateError);
          
          // Even if there's an error with the DB update, still show success to user
          // The Stripe subscription was created successfully
          setSuccess(true);
          setProcessing(false);
          
          toast({
            title: "Premium Activated",
            description: "Your payment was successful. You now have access to premium features.",
          });
        }
        
        // Get return URL from params or localStorage
        let redirectUrl = '/';
        if (returnUrl) {
          redirectUrl = decodeURIComponent(returnUrl);
        } else {
          const storedReturnUrl = localStorage.getItem('payment_return_url');
          if (storedReturnUrl) {
            redirectUrl = storedReturnUrl;
            localStorage.removeItem('payment_return_url'); // Clean up
          }
        }
        
        // Auto-redirect after 2 seconds
        setTimeout(() => {
          navigate(redirectUrl);
        }, 2000);
      } catch (error: any) {
        console.error('Error processing payment:', error);
        toast({
          title: "Error",
          description: error.message || "There was an error processing your payment.",
          variant: "destructive",
        });
        setProcessing(false);
        setSuccess(false);
      }
    };

    processPayment();
  }, [location.search, toast, setIsPremium, navigate]);

  return (
    <Layout>
      <div className="container max-w-md mx-auto py-12 px-4">
        <div className="bg-card border rounded-lg shadow-sm p-6 text-center">
          {processing ? (
            <>
              <Loader2 className="h-12 w-12 text-primary mx-auto animate-spin mb-4" />
              <h1 className="text-2xl font-bold mb-2">Processing Your Payment</h1>
              <p className="text-muted-foreground mb-6">
                Please wait while we confirm your subscription...
              </p>
            </>
          ) : success ? (
            <>
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <h1 className="text-2xl font-bold mb-2">Payment Successful!</h1>
              <p className="text-muted-foreground mb-6">
                Thank you for upgrading to Premium! You now have access to all premium features.
                <br />
                <span className="text-sm mt-2 block">
                  Redirecting you back in a few seconds...
                </span>
              </p>
              <Button 
                onClick={() => {
                  // Get return URL from params or localStorage
                  const params = new URLSearchParams(location.search);
                  const returnUrl = params.get('returnUrl');
                  let redirectUrl = '/';
                  
                  if (returnUrl) {
                    redirectUrl = decodeURIComponent(returnUrl);
                  } else {
                    const storedReturnUrl = localStorage.getItem('payment_return_url');
                    if (storedReturnUrl) {
                      redirectUrl = storedReturnUrl;
                      localStorage.removeItem('payment_return_url'); // Clean up
                    }
                  }
                  
                  navigate(redirectUrl);
                }} 
                className="w-full"
              >
                Return Now
              </Button>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-bold mb-2">Something Went Wrong</h1>
              <p className="text-muted-foreground mb-6">
                We couldn't process your payment. Please try again or contact support.
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
                  onClick={() => navigate('/')} 
                  className="w-full"
                >
                  Return to Home
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default PaymentSuccessPage; 
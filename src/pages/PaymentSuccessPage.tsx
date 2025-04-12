import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { CheckCircle, Loader2, AlertTriangle, Bug, ClipboardCopy, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import Layout from '@/components/Layout';
import { handleSuccessfulPayment, storePaymentTransactionDetails } from '@/services/stripeService';
import { useUsageStore } from '@/services/usageService';
import { useAuthStore } from '@/services/firebaseService';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { getFirestore, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

const PaymentSuccessPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { setIsPremium, syncPremiumStatus } = useUsageStore();
  const { user } = useAuthStore();
  const [processing, setProcessing] = useState(true);
  const [success, setSuccess] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<Record<string, any>>({});
  const [isDebugExpanded, setIsDebugExpanded] = useState(false);
  const [isForcing, setIsForcing] = useState(false);
  const db = getFirestore();

  useEffect(() => {
    const processPayment = async () => {
      try {
        // Get data primarily from localStorage (for payment links)
        // Fallback to URL parameters (for server-based payments)
        const params = new URLSearchParams(location.search);
        
        // Check if we have a redirect_status from Stripe, which indicates a successful payment
        const redirectStatus = params.get('redirect_status');
        const isRedirectSuccess = redirectStatus === 'succeeded';
        
        // First try localStorage (our main storage mechanism)
        const storedUserId = localStorage.getItem('payment_user_id');
        const storedNonce = localStorage.getItem('payment_nonce');
        const storedReturnUrl = localStorage.getItem('payment_return_url');
        
        // Then try URL params as fallback
        const urlUserId = params.get('user');
        const urlNonce = params.get('nonce');
        const urlReturnUrl = params.get('returnUrl');
        
        // Use stored values with fallbacks to URL parameters
        const userId = storedUserId || urlUserId || user?.uid;
        const nonce = storedNonce || urlNonce;
        const returnUrl = urlReturnUrl || storedReturnUrl;
        const sessionId = params.get('session_id');
        
        console.log('Processing payment success - localStorage values:', { 
          storedUserId, 
          storedNonce, 
          storedReturnUrl,
          isRedirectSuccess,
          redirectStatus
        });
        console.log('URL parameters:', Object.fromEntries([...params.entries()]));
        
        // Collect debug info
        const paymentInfo = { 
          userId, 
          sessionId, 
          nonce, 
          returnUrl,
          redirectStatus,
          localStorage: {
            payment_user_id: storedUserId,
            payment_nonce: storedNonce,
            payment_return_url: storedReturnUrl
          }
        };
        
        console.log('Processing payment success:', paymentInfo);
        setDebugInfo(current => ({ ...current, paymentParams: paymentInfo }));

        // Validate required parameters
        if (!userId) {
          toast({
            title: "Error",
            description: "Payment information is missing. Please try again.",
            variant: "destructive"
          });
          setProcessing(false);
          setSuccess(false);
          console.error('No user ID found for payment processing');
          return;
        }

        // Set a flag in localStorage to indicate payment processing in progress
        // This will be used for recovery if the page is closed before completion
        localStorage.setItem('payment_success_pending', 'true');
        localStorage.setItem('payment_user_id', userId);
        if (nonce) {
          localStorage.setItem('payment_nonce', nonce);
        }

        // Immediately update local state for responsive UX
        setIsPremium(true);
        
        // Get initial state for debugging
        const initialState = {
          localStorage: collectLocalStorageItems(),
          userObj: user ? { uid: user.uid, email: user.email } : null,
          isPremium: useUsageStore.getState().isPremium
        };
        
        setDebugInfo(current => ({ ...current, initialState }));
        
        try {
          // Record the payment success page visit
          storePaymentTransactionDetails({
            userId,
            success: false, // Will be updated after DB update
            source: 'payment-success-page',
            timestamp: new Date().toISOString(),
            status: 'processing',
            nonce: nonce || undefined,
            returnUrl: returnUrl || undefined
          });

          // If we have a userId, update premium status in the database
          if (userId) {
            // First try to sync premium status if user is logged in to ensure we get the latest state
            if (user && user.uid === userId) {
              await syncPremiumStatus();
              
              // Log status after sync
              const afterSyncState = {
                isPremium: useUsageStore.getState().isPremium,
                timestamp: new Date().toISOString()
              };
              
              setDebugInfo(current => ({ 
                ...current, 
                afterSync: afterSyncState 
              }));
            }
            
            // Process the payment through our main handler
            console.log(`Processing payment for user ${userId} with nonce ${nonce || 'none'}`);
            const dbUpdateSuccess = await handleSuccessfulPayment(userId, nonce);
            console.log(`Payment processing result: ${dbUpdateSuccess ? 'success' : 'failed'}`);
            
            // Log status after payment processing
            const afterPaymentState = {
              dbUpdateSuccess,
              isPremium: useUsageStore.getState().isPremium,
              localStorage: collectLocalStorageItems(),
              timestamp: new Date().toISOString()
            };
            
            setDebugInfo(current => ({ 
              ...current, 
              afterPayment: afterPaymentState 
            }));
            
            if (!dbUpdateSuccess) {
              setWarning('Your premium status was activated, but we encountered an issue syncing with our server. Your access is still enabled, and we\'ll automatically retry the sync.');
            } else {
              // Clear payment processing flags on successful DB update
              localStorage.removeItem('payment_success_pending');
              
              // Don't remove user_id and nonce yet - needed for checking premium status
              // They will be removed on successful redirect or payment verification
              console.log('Payment processing completed successfully - keeping user_id and nonce for verification');
            }
            
            // Re-sync to ensure everything is updated correctly
            if (user && user.uid === userId) {
              setTimeout(async () => {
                await syncPremiumStatus();
                
                // Log final state
                const finalState = {
                  isPremium: useUsageStore.getState().isPremium,
                  localStorage: collectLocalStorageItems(),
                  timestamp: new Date().toISOString()
                };
                
                setDebugInfo(current => ({ 
                  ...current, 
                  finalState 
                }));
              }, 1000); // Slight delay to allow database updates to propagate
            }
          } 
          else if (sessionId) {
            // For server-initiated flow (likely not used in client-only mode)
            localStorage.setItem('isPremium', 'true');
            localStorage.setItem('premiumSince', new Date().toISOString());
            setWarning('Your payment was successful, but we couldn\'t identify your account. Please contact support if you experience any issues with premium access.');
          }
          
          // Show success toast
          toast({
            title: "Premium Activated!",
            description: "You now have access to all premium features.",
          });
        } catch (updateError) {
          console.error('Error updating user status:', updateError);
          setWarning('We had trouble updating your account status on our servers, but your premium access has been activated locally. We\'ll automatically try again later.');
          
          // Store information for later retry
          localStorage.setItem('payment_recovery_needed', 'true');
          if (userId) {
            localStorage.setItem('recovery_user_id', userId);
          }
          
          // Log error
          setDebugInfo(current => ({ 
            ...current, 
            error: {
              message: updateError instanceof Error ? updateError.message : String(updateError),
              stack: updateError instanceof Error ? updateError.stack : null,
              timestamp: new Date().toISOString()
            }
          }));
          
          // Record the error for later analysis
          storePaymentTransactionDetails({
            userId,
            success: false,
            source: 'payment-success-page',
            timestamp: new Date().toISOString(),
            status: 'error',
            error: updateError instanceof Error ? updateError.message : String(updateError),
            nonce: nonce || undefined
          });
        }
        
        // Always mark as success for user experience
        setSuccess(true);
        setProcessing(false);
        
        // Get return URL from params or localStorage
        let redirectUrl = '/';
        if (returnUrl) {
          redirectUrl = decodeURIComponent(returnUrl);
          console.log('Using returnUrl:', redirectUrl);
        } else {
          console.log('No return URL found, using default: /');
        }
        
        // Delay redirect to show success message and potential warnings
        setTimeout(() => {
          console.log('Redirecting to:', redirectUrl);
          
          // Clean up all payment-related localStorage items when redirecting
          // ONLY after successful processing
          localStorage.removeItem('payment_return_url'); 
          localStorage.removeItem('payment_nonce');
          localStorage.removeItem('payment_user_id');
          localStorage.removeItem('payment_success_pending');
          localStorage.removeItem('payment_initiated');
          
          navigate(redirectUrl);
        }, warning ? 5000 : 2000); // Longer delay if there's a warning
      } catch (error: any) {
        console.error('Error processing payment:', error);
        toast({
          title: "Error",
          description: error.message || "There was an error processing your payment.",
          variant: "destructive",
        });
        setProcessing(false);
        setSuccess(false);
        
        // Log error
        setDebugInfo(current => ({ 
          ...current, 
          error: {
            message: error.message || String(error),
            stack: error.stack,
            timestamp: new Date().toISOString()
          }
        }));
        
        // Record the critical error
        if (user) {
          storePaymentTransactionDetails({
            userId: user.uid,
            success: false,
            source: 'payment-success-page',
            timestamp: new Date().toISOString(),
            status: 'critical-error',
            error: error.message || String(error)
          });
        }
      }
    };

    processPayment();
    
    // This cleanup function will run if the component unmounts before processing is complete
    return () => {
      // If we're still processing, make sure we don't lose the payment info
      if (processing) {
        console.log('Payment success page unmounted while processing - preserving payment info for recovery');
        // Don't remove any payment flags if we're still processing
      }
    };
  }, [location.search, toast, setIsPremium, syncPremiumStatus, navigate, user]);

  // Helper function to collect relevant localStorage items
  const collectLocalStorageItems = () => {
    const items: Record<string, string> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.includes('premium') || key.includes('payment'))) {
        items[key] = localStorage.getItem(key) || '';
      }
    }
    return items;
  };

  // Helper to copy debug info to clipboard
  const copyDebugInfo = () => {
    navigator.clipboard.writeText(JSON.stringify(debugInfo, null, 2));
    toast({
      title: "Copied",
      description: "Debug information copied to clipboard",
    });
  };

  // Force premium status update directly in Firebase
  const forceUpdatePremiumStatus = async () => {
    const params = new URLSearchParams(location.search);
    const userId = params.get('user') || user?.uid;
    
    if (!userId) {
      toast({
        title: "Error",
        description: "No user ID found to update premium status",
        variant: "destructive"
      });
      return;
    }
    
    setIsForcing(true);
    try {
      // Update user document in Firestore
      const userDocRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userDocRef);
      
      const timestamp = new Date().toISOString();
      const updateData = {
        isPremium: true,
        premiumSince: timestamp,
        updatedAt: timestamp,
        subscriptionStatus: 'active',
        paymentSource: 'stripe',
        forcedUpdate: true,
        forcedUpdateTimestamp: timestamp
      };
      
      if (userDoc.exists()) {
        // Update existing document
        await updateDoc(userDocRef, updateData);
      } else {
        // Create new document
        await setDoc(userDocRef, {
          uid: userId,
          email: user?.email || '',
          ...updateData,
          createdAt: timestamp
        });
      }
      
      // Update local storage
      localStorage.setItem('isPremium', 'true');
      localStorage.setItem('premiumSince', timestamp);
      localStorage.setItem('premiumUserId', userId);
      localStorage.setItem('premiumUpdatedAt', timestamp);
      
      // Update client state
      setIsPremium(true);
      
      // Sync premium status if this is the current user
      if (user && user.uid === userId) {
        await syncPremiumStatus();
      }
      
      // Update debug info
      setDebugInfo(current => ({
        ...current,
        forcedUpdate: {
          success: true,
          timestamp,
          userId
        }
      }));
      
      toast({
        title: "Premium Status Forced",
        description: "The premium status has been manually updated in the database.",
      });
    } catch (error) {
      console.error('Error forcing premium status:', error);
      
      setDebugInfo(current => ({
        ...current,
        forcedUpdateError: {
          message: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString()
        }
      }));
      
      toast({
        title: "Update Error",
        description: "Failed to force premium status update.",
        variant: "destructive",
      });
    } finally {
      setIsForcing(false);
    }
  };

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
              
              {warning && (
                <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-md p-3 mb-4 flex items-start">
                  <AlertTriangle className="h-5 w-5 flex-shrink-0 mr-2 mt-0.5 text-amber-500" />
                  <p className="text-sm text-left">{warning}</p>
                </div>
              )}
              
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
              
              {/* Debug Info */}
              <Collapsible 
                open={isDebugExpanded} 
                onOpenChange={setIsDebugExpanded}
                className="mt-4 border-t pt-4"
              >
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-1">
                    <Bug className="h-3 w-3" />
                    <span>Debug Info</span>
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="text-left mt-2">
                    <div className="flex justify-between mb-2">
                      <span className="text-sm font-medium">Payment Status Details</span>
                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={forceUpdatePremiumStatus} 
                          disabled={isForcing}
                          className="h-6 gap-1 bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
                        >
                          <Shield className="h-3 w-3" />
                          <span className="text-xs">Force Premium</span>
                        </Button>
                        <Button variant="ghost" size="sm" onClick={copyDebugInfo} className="h-6 gap-1">
                          <ClipboardCopy className="h-3 w-3" />
                          <span className="text-xs">Copy</span>
                        </Button>
                      </div>
                    </div>
                    <div className="bg-muted p-2 rounded text-xs font-mono max-h-60 overflow-auto">
                      <pre>{JSON.stringify(debugInfo, null, 2)}</pre>
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </>
          ) : (
            <>
              <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
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
                  Return Home
                </Button>
              </div>
              
              {/* Debug Info for Errors */}
              <Collapsible 
                open={isDebugExpanded} 
                onOpenChange={setIsDebugExpanded}
                className="mt-4 border-t pt-4"
              >
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-1">
                    <Bug className="h-3 w-3" />
                    <span>Debug Info</span>
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="text-left mt-2">
                    <div className="flex justify-between mb-2">
                      <span className="text-sm font-medium">Error Details</span>
                      <Button variant="ghost" size="sm" onClick={copyDebugInfo} className="h-6 gap-1">
                        <ClipboardCopy className="h-3 w-3" />
                        <span className="text-xs">Copy</span>
                      </Button>
                    </div>
                    <div className="bg-muted p-2 rounded text-xs font-mono max-h-60 overflow-auto">
                      <pre>{JSON.stringify(debugInfo, null, 2)}</pre>
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default PaymentSuccessPage; 
import React, { useState, useEffect } from 'react';
import { useAuthStore } from '@/services/firebaseService';
import { doc, getDoc, collection, query, where, orderBy, getDocs, limit, getFirestore, updateDoc, setDoc } from 'firebase/firestore';
import { isUserPremium } from '@/services/firebaseService';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useUsageStore } from '@/services/usageService';
import { AlertCircle, ArrowDown, Bug, ClipboardCopy, RefreshCw, ShieldAlert } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

interface PaymentLog {
  id: string;
  userId: string;
  action: string;
  timestamp: string | Date;
  success: boolean;
  clientInfo?: {
    userAgent?: string;
    timestamp?: number;
  };
}

export default function PaymentDebugInfo() {
  const { user } = useAuthStore();
  const { isPremium, syncPremiumStatus } = useUsageStore();
  const [userDocument, setUserDocument] = useState<any>(null);
  const [paymentLogs, setPaymentLogs] = useState<PaymentLog[]>([]);
  const [localStorageData, setLocalStorageData] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const { toast } = useToast();
  const db = getFirestore();
  const [isUpdating, setIsUpdating] = useState(false);

  // Load user document and payment logs
  const loadData = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      // Get user document from Firestore
      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);
      
      if (userDoc.exists()) {
        setUserDocument(userDoc.data());
      }
      
      // Get payment logs
      const logsQuery = query(
        collection(db, 'payment_logs'),
        where('userId', '==', user.uid),
        orderBy('timestamp', 'desc'),
        limit(10)
      );
      
      const logsSnapshot = await getDocs(logsQuery);
      const logs: PaymentLog[] = [];
      
      logsSnapshot.forEach(doc => {
        logs.push({
          id: doc.id,
          ...doc.data()
        } as PaymentLog);
      });
      
      setPaymentLogs(logs);
      
      // Get localStorage data
      const items: Record<string, string> = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.includes('premium') || key.includes('payment'))) {
          items[key] = localStorage.getItem(key) || '';
        }
      }
      setLocalStorageData(items);
      
    } catch (error) {
      console.error('Error loading payment data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isExpanded) {
      loadData();
    }
  }, [user, isExpanded]);

  const handleSyncPremiumStatus = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      // Check server status
      const serverStatus = await isUserPremium(user);
      
      // Update the client state
      await syncPremiumStatus();
      
      toast({
        title: "Status Synced",
        description: `Server premium status: ${serverStatus}, Client status updated.`,
      });
      
      // Reload the data
      await loadData();
      
    } catch (error) {
      console.error('Error syncing premium status:', error);
      toast({
        title: "Sync Error",
        description: "There was an error syncing your premium status.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = () => {
    const data = {
      userDocument,
      paymentLogs,
      localStorageData,
      clientStatus: {
        isPremium,
        userId: user?.uid,
        email: user?.email
      }
    };
    
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    toast({
      title: "Copied",
      description: "Debug information copied to clipboard",
    });
  };

  // Manual override to set premium status in Firebase
  const handleManualOverride = async (setPremium: boolean) => {
    if (!user) return;
    
    setIsUpdating(true);
    try {
      // Update user document in Firestore
      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);
      
      const updateData = {
        isPremium: setPremium,
        updatedAt: new Date().toISOString(),
        manuallyUpdated: true,
        manualUpdateTimestamp: new Date().toISOString()
      };
      
      if (userDoc.exists()) {
        // Update existing document
        await updateDoc(userDocRef, updateData);
      } else {
        // Create new document
        await setDoc(userDocRef, {
          uid: user.uid,
          email: user.email,
          ...updateData,
          createdAt: new Date().toISOString()
        });
      }
      
      // Sync client state
      await syncPremiumStatus();
      
      // Reload data
      await loadData();
      
      toast({
        title: `Premium status ${setPremium ? 'enabled' : 'disabled'}`,
        description: `User's premium status was manually set to ${setPremium ? 'premium' : 'non-premium'}.`,
      });
    } catch (error) {
      console.error('Error updating premium status:', error);
      toast({
        title: "Update Error",
        description: "Failed to update premium status in the database.",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  if (!user) return null;

  const formatTimestamp = (timestamp: any) => {
    if (!timestamp) return 'N/A';
    
    try {
      // Handle Firestore timestamps and string dates
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.toLocaleString();
    } catch (error) {
      return String(timestamp);
    }
  };

  return (
    <Collapsible 
      open={isExpanded} 
      onOpenChange={setIsExpanded}
      className="mt-4 rounded-md border"
    >
      <CollapsibleTrigger asChild>
        <Button variant="ghost" className="w-full justify-between p-4 rounded-none hover:bg-muted border-b">
          <div className="flex items-center gap-2">
            <Bug className="h-4 w-4" />
            <span>Payment Status Diagnostics</span>
            {paymentLogs.length > 0 && (
              <Badge variant="outline" className="ml-2">
                {paymentLogs.length} log{paymentLogs.length !== 1 ? 's' : ''}
              </Badge>
            )}
          </div>
          <ArrowDown className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="p-4 space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-sm font-semibold">Premium Status</h3>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant={isPremium ? "default" : "outline"} className="rounded-sm">
                Client: {isPremium ? "Premium" : "Not Premium"}
              </Badge>
              <Badge variant={userDocument?.isPremium ? "default" : "outline"} className="rounded-sm">
                Server: {userDocument?.isPremium ? "Premium" : "Not Premium"}
              </Badge>
            </div>
          </div>
          <div className="flex gap-2">
            <Button 
              size="sm" 
              variant={userDocument?.isPremium ? "outline" : "default"}
              onClick={() => handleManualOverride(true)}
              disabled={isUpdating || (userDocument?.isPremium === true)}
              className="bg-green-50 text-green-700 border-green-200 hover:bg-green-100 hover:text-green-800"
            >
              Set Premium: ON
            </Button>
            <Button 
              size="sm" 
              variant={userDocument?.isPremium ? "default" : "outline"}
              onClick={() => handleManualOverride(false)}
              disabled={isUpdating || (userDocument?.isPremium === false)}
              className="bg-red-50 text-red-700 border-red-200 hover:bg-red-100 hover:text-red-800"
            >
              Set Premium: OFF
            </Button>
            <Button 
              size="sm" 
              variant="outline" 
              onClick={handleSyncPremiumStatus}
              disabled={isLoading || isUpdating}
            >
              <RefreshCw className={`h-3 w-3 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
              Sync Status
            </Button>
            <Button 
              size="sm" 
              variant="outline" 
              onClick={loadData}
              disabled={isLoading || isUpdating}
            >
              <RefreshCw className={`h-3 w-3 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button 
              size="sm" 
              variant="outline" 
              onClick={copyToClipboard}
            >
              <ClipboardCopy className="h-3 w-3 mr-1" />
              Copy Data
            </Button>
          </div>
        </div>

        {/* User Document */}
        <div className="p-3 bg-muted rounded-md">
          <h3 className="text-sm font-semibold mb-2">User Document</h3>
          {userDocument ? (
            <div className="text-xs font-mono bg-background p-2 rounded-md max-h-40 overflow-auto">
              <pre>{JSON.stringify(userDocument, null, 2)}</pre>
            </div>
          ) : (
            <div className="text-xs text-muted-foreground flex items-center gap-2">
              <AlertCircle className="h-3 w-3" />
              No user document found
            </div>
          )}
        </div>

        {/* Payment Logs */}
        <div>
          <h3 className="text-sm font-semibold mb-2">Payment Logs</h3>
          {paymentLogs.length === 0 ? (
            <div className="text-xs text-muted-foreground flex items-center gap-2 p-3 bg-muted rounded-md">
              <AlertCircle className="h-3 w-3" />
              No payment logs found
            </div>
          ) : (
            <div className="text-xs overflow-auto max-h-40 border rounded-md">
              <table className="w-full">
                <thead className="bg-muted">
                  <tr>
                    <th className="p-2 text-left">Date</th>
                    <th className="p-2 text-left">Action</th>
                    <th className="p-2 text-left">Success</th>
                  </tr>
                </thead>
                <tbody>
                  {paymentLogs.map((log) => (
                    <tr key={log.id} className="border-t">
                      <td className="p-2">{formatTimestamp(log.timestamp)}</td>
                      <td className="p-2">{log.action}</td>
                      <td className="p-2">
                        <Badge variant={log.success ? "default" : "destructive"} className="rounded-sm">
                          {log.success ? "Success" : "Failed"}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* LocalStorage */}
        <div>
          <h3 className="text-sm font-semibold mb-2">LocalStorage Info</h3>
          <div className="text-xs font-mono bg-muted p-2 rounded-md max-h-40 overflow-auto">
            <pre>{JSON.stringify(localStorageData, null, 2)}</pre>
          </div>
        </div>

        {/* Status Mismatch Warning */}
        {isPremium !== !!userDocument?.isPremium && (
          <div className="flex items-start gap-2 p-3 bg-amber-50 text-amber-800 border border-amber-200 rounded-md">
            <ShieldAlert className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium">Status Mismatch Detected</p>
              <p className="text-xs">
                Your premium status is not consistent between the client and server. 
                Try clicking "Sync Status" to resolve this issue.
              </p>
            </div>
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
} 
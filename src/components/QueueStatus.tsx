import { useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { QueueStatus as QueueStatusType } from '@/types/queue';
import { Clock, Users, CheckCircle } from 'lucide-react';

interface QueueStatusProps {
  queueStatus: QueueStatusType;
  onEnterVoting: () => void;
  onReturnHome: () => void;
}

export function QueueStatus({ queueStatus, onEnterVoting, onReturnHome }: QueueStatusProps) {
  useEffect(() => {
    // Auto-redirect when promoted to active
    if (queueStatus.status === 'active') {
      const timer = setTimeout(() => {
        onEnterVoting();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [queueStatus.status, onEnterVoting]);

  if (queueStatus.status === 'active') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-background to-green-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <CardTitle className="text-2xl text-green-700">You're In!</CardTitle>
            <CardDescription>You can now proceed to vote</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-6">
              Redirecting you to the voting panel...
            </p>
            <Button onClick={onEnterVoting} className="w-full" size="lg">
              Enter Voting Panel
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (queueStatus.status === 'queued') {
    const estimatedWaitMinutes = Math.max(1, Math.floor((queueStatus.position || 0) / 2)); // Rough estimate
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-background to-blue-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
              <Clock className="w-8 h-8 text-blue-600" />
            </div>
            <CardTitle className="text-2xl">You're in the Queue</CardTitle>
            <CardDescription>Please wait for your turn to vote</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-center">
              <div className="text-4xl font-bold text-blue-600 mb-2">
                #{queueStatus.position}
              </div>
              <p className="text-sm text-muted-foreground">Your position in queue</p>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Progress</span>
                <span>{Math.max(0, 100 - (queueStatus.position || 0))}% ahead of you</span>
              </div>
              <Progress 
                value={Math.max(0, 100 - (queueStatus.position || 0))} 
                className="h-2"
              />
            </div>

            <div className="bg-blue-50 p-4 rounded-lg space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <Users className="w-4 h-4 text-blue-600" />
                <span>Estimated wait: ~{estimatedWaitMinutes} minutes</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Clock className="w-4 h-4 text-blue-600" />
                <span>Keep this tab open to maintain your position</span>
              </div>
            </div>

            <div className="text-xs text-muted-foreground text-center space-y-2">
              <p>• You'll be automatically promoted when it's your turn</p>
              <p>• Don't refresh the page or you'll lose your position</p>
              <p>• Session expires after 5 minutes of inactivity</p>
            </div>

            <Button 
              variant="outline" 
              onClick={onReturnHome}
              className="w-full"
            >
              Leave Queue
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state
  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-background to-red-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl text-red-700">Something went wrong</CardTitle>
          <CardDescription>{queueStatus.error || 'Unknown error occurred'}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={onReturnHome} className="w-full">
            Return to Home
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
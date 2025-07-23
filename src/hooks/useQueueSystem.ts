import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { QueueStatus, VotingSession, QueueEntry } from '@/types/queue';

export function useQueueSystem() {
  const [queueStatus, setQueueStatus] = useState<QueueStatus | null>(null);
  const [loading, setLoading] = useState(false);

  // Join queue or get active session
  const joinQueue = useCallback(async (registrationNumber: string, votingKey: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('join-queue', {
        body: { registrationNumber, votingKey }
      });

      if (error) throw error;

      setQueueStatus(data);
      
      // Start heartbeat if we have a session token
      if (data.sessionToken) {
        startHeartbeat(data.sessionToken);
      }

      return data;
    } catch (error) {
      console.error('Failed to join queue:', error);
      setQueueStatus({ status: 'error', error: 'Failed to join queue' });
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  // Heartbeat to keep session alive
  const startHeartbeat = useCallback((sessionToken: string) => {
    const interval = setInterval(async () => {
      try {
        const { data, error } = await supabase.functions.invoke('queue-heartbeat', {
          body: { sessionToken }
        });

        if (error || !data.sessionValid) {
          clearInterval(interval);
          setQueueStatus({ status: 'error', error: 'Session expired' });
          return;
        }

        // Update status if position changed
        setQueueStatus(prev => prev ? { ...prev, ...data } : data);
      } catch (error) {
        console.error('Heartbeat failed:', error);
        clearInterval(interval);
        setQueueStatus({ status: 'error', error: 'Connection lost' });
      }
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, []);

  // Set up realtime subscriptions
  useEffect(() => {
    // Subscribe to voting sessions changes
    const sessionsChannel = supabase
      .channel('voting-sessions-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'voting_sessions'
        },
        (payload) => {
          console.log('Session change:', payload);
          // Handle session promotions or changes
        }
      )
      .subscribe();

    // Subscribe to queue changes
    const queueChannel = supabase
      .channel('queue-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'voting_queue'
        },
        (payload) => {
          console.log('Queue change:', payload);
          // Update queue position when others leave
          if (payload.eventType === 'DELETE') {
            // Refresh queue status
            refreshQueueStatus();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(sessionsChannel);
      supabase.removeChannel(queueChannel);
    };
  }, []);

  const refreshQueueStatus = useCallback(async () => {
    if (!queueStatus?.sessionToken) return;

    try {
      const { data } = await supabase.functions.invoke('queue-heartbeat', {
        body: { sessionToken: queueStatus.sessionToken }
      });
      
      if (data) {
        setQueueStatus(prev => ({ ...prev, ...data }));
      }
    } catch (error) {
      console.error('Failed to refresh queue status:', error);
    }
  }, [queueStatus?.sessionToken]);

  return {
    queueStatus,
    loading,
    joinQueue,
    refreshQueueStatus
  };
}

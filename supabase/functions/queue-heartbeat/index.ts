import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      "https://tzmesmecgaijwqqhrxlb.supabase.co",
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR6bWVzbWVjZ2FpandxcWhyeGxiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyMDI1MzUsImV4cCI6MjA2ODc3ODUzNX0.jSuw-a76PgIrl_ZlVifYWm7eFYlCw9y3nfA3whtHJIY"
    );

    const { sessionToken } = await req.json();

    if (!sessionToken) {
      return new Response(
        JSON.stringify({ error: 'Session token required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update heartbeat for active session
    const { data: sessionUpdate, error: sessionError } = await supabase
      .from('voting_sessions')
      .update({ 
        last_heartbeat: new Date().toISOString(),
        expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString() // 5 minutes from now
      })
      .eq('session_token', sessionToken)
      .select()
      .single();

    if (!sessionError && sessionUpdate) {
      return new Response(
        JSON.stringify({ 
          status: 'active',
          sessionValid: true 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update heartbeat for queue entry
    const { data: queueUpdate, error: queueError } = await supabase
      .from('voting_queue')
      .update({ 
        last_heartbeat: new Date().toISOString(),
        expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString() // 5 minutes from now
      })
      .eq('session_token', sessionToken)
      .select()
      .single();

    if (!queueError && queueUpdate) {
      return new Response(
        JSON.stringify({ 
          status: 'queued',
          position: queueUpdate.queue_position,
          sessionValid: true 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Session not found
    return new Response(
      JSON.stringify({ 
        error: 'Session not found or expired',
        sessionValid: false 
      }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Heartbeat error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
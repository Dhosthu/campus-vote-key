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

    const { registrationNumber, votingKey } = await req.json();

    // Validate student credentials first
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('*')
      .eq('registration_number', registrationNumber)
      .eq('voting_key', votingKey)
      .single();

    if (studentError || !student) {
      return new Response(
        JSON.stringify({ error: 'Invalid registration number or voting key' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (student.has_voted) {
      return new Response(
        JSON.stringify({ error: 'You have already voted' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is already in an active session
    const { data: existingSession } = await supabase
      .from('voting_sessions')
      .select('*')
      .eq('student_registration_number', registrationNumber)
      .eq('status', 'active')
      .gt('expires_at', new Date().toISOString())
      .single();

    if (existingSession) {
      return new Response(
        JSON.stringify({ 
          status: 'active',
          sessionToken: existingSession.session_token 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is already in queue
    const { data: existingQueue } = await supabase
      .from('voting_queue')
      .select('*')
      .eq('student_registration_number', registrationNumber)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (existingQueue) {
      return new Response(
        JSON.stringify({ 
          status: 'queued',
          position: existingQueue.queue_position,
          sessionToken: existingQueue.session_token
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check current active sessions count
    const { count: activeCount } = await supabase
      .from('voting_sessions')
      .select('*', { count: 'exact', head: true })
      .in('status', ['active', 'voting'])
      .gt('expires_at', new Date().toISOString());

    // If under limit, create active session directly
    if ((activeCount || 0) < 100) {
      const { data: newSession, error: sessionError } = await supabase
        .from('voting_sessions')
        .insert({
          student_registration_number: registrationNumber,
          status: 'active'
        })
        .select()
        .single();

      if (sessionError) {
        console.error('Session creation error:', sessionError);
        return new Response(
          JSON.stringify({ error: 'Failed to create session' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ 
          status: 'active',
          sessionToken: newSession.session_token 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Add to queue using atomic function
    const { data: queueData, error: queueError } = await supabase
      .rpc('assign_queue_position', { reg_number: registrationNumber });

    if (queueError) {
      console.error('Queue assignment error:', queueError);
      return new Response(
        JSON.stringify({ error: 'Failed to join queue' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get the created queue entry
    const { data: queueEntry } = await supabase
      .from('voting_queue')
      .select('*')
      .eq('student_registration_number', registrationNumber)
      .single();

    return new Response(
      JSON.stringify({ 
        status: 'queued',
        position: queueData,
        sessionToken: queueEntry?.session_token
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Join queue error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
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

    // This function runs periodically to:
    // 1. Clean up expired sessions
    // 2. Promote users from queue to active sessions

    console.log('Starting queue management cycle...');

    // Clean up expired sessions and queue entries
    const { error: cleanupError } = await supabase
      .rpc('cleanup_expired_sessions');

    if (cleanupError) {
      console.error('Cleanup error:', cleanupError);
    } else {
      console.log('Cleanup completed successfully');
    }

    // Promote users from queue to active sessions
    let promotionCount = 0;
    let continuePomoting = true;

    while (continuePomoting) {
      const { data: promotedUsers, error: promoteError } = await supabase
        .rpc('promote_from_queue');

      if (promoteError) {
        console.error('Promotion error:', promoteError);
        break;
      }

      if (!promotedUsers || promotedUsers.length === 0) {
        continuePomoting = false;
      } else {
        promotionCount += promotedUsers.length;
        console.log(`Promoted ${promotedUsers.length} users to active sessions`);
        
        // Limit promotions per cycle to prevent infinite loops
        if (promotionCount >= 10) {
          break;
        }
      }
    }

    console.log(`Queue management cycle completed. Promoted ${promotionCount} users total.`);

    return new Response(
      JSON.stringify({ 
        success: true,
        promoted: promotionCount,
        timestamp: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Queue manager error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
-- Create voting sessions table to track active voters
CREATE TABLE public.voting_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_registration_number TEXT NOT NULL UNIQUE,
  session_token UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('active', 'voting', 'completed')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_heartbeat TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + INTERVAL '5 minutes')
);

-- Create voting queue table for queued users
CREATE TABLE public.voting_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_registration_number TEXT NOT NULL UNIQUE,
  queue_position INTEGER NOT NULL,
  session_token UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_heartbeat TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + INTERVAL '5 minutes')
);

-- Create unique index on queue position to prevent duplicates
CREATE UNIQUE INDEX idx_voting_queue_position ON public.voting_queue(queue_position);

-- Enable RLS
ALTER TABLE public.voting_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voting_queue ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (we'll secure through session tokens)
CREATE POLICY "Allow public read access to voting_sessions" 
ON public.voting_sessions FOR SELECT USING (true);

CREATE POLICY "Allow public insert access to voting_sessions" 
ON public.voting_sessions FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update access to voting_sessions" 
ON public.voting_sessions FOR UPDATE USING (true);

CREATE POLICY "Allow public delete access to voting_sessions" 
ON public.voting_sessions FOR DELETE USING (true);

CREATE POLICY "Allow public read access to voting_queue" 
ON public.voting_queue FOR SELECT USING (true);

CREATE POLICY "Allow public insert access to voting_queue" 
ON public.voting_queue FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update access to voting_queue" 
ON public.voting_queue FOR UPDATE USING (true);

CREATE POLICY "Allow public delete access to voting_queue" 
ON public.voting_queue FOR DELETE USING (true);

-- Function to atomically assign queue position
CREATE OR REPLACE FUNCTION public.assign_queue_position(reg_number TEXT)
RETURNS INTEGER AS $$
DECLARE
  new_position INTEGER;
BEGIN
  -- Get the next available position atomically
  SELECT COALESCE(MAX(queue_position), 0) + 1 
  INTO new_position 
  FROM public.voting_queue;
  
  -- Insert with the new position
  INSERT INTO public.voting_queue (student_registration_number, queue_position)
  VALUES (reg_number, new_position);
  
  RETURN new_position;
EXCEPTION
  WHEN unique_violation THEN
    -- If position was taken, retry with next position
    SELECT COALESCE(MAX(queue_position), 0) + 1 
    INTO new_position 
    FROM public.voting_queue;
    
    UPDATE public.voting_queue 
    SET queue_position = new_position 
    WHERE student_registration_number = reg_number;
    
    RETURN new_position;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to cleanup expired sessions and recompact queue
CREATE OR REPLACE FUNCTION public.cleanup_expired_sessions()
RETURNS VOID AS $$
BEGIN
  -- Remove expired voting sessions
  DELETE FROM public.voting_sessions 
  WHERE expires_at < now();
  
  -- Remove expired queue entries
  DELETE FROM public.voting_queue 
  WHERE expires_at < now();
  
  -- Recompact queue positions to remove gaps
  WITH reordered AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY queue_position) as new_position
    FROM public.voting_queue
    ORDER BY queue_position
  )
  UPDATE public.voting_queue 
  SET queue_position = reordered.new_position
  FROM reordered
  WHERE public.voting_queue.id = reordered.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to promote users from queue to active session
CREATE OR REPLACE FUNCTION public.promote_from_queue()
RETURNS TABLE(promoted_registration_number TEXT, session_token UUID) AS $$
DECLARE
  active_count INTEGER;
  next_user RECORD;
BEGIN
  -- Count current active sessions
  SELECT COUNT(*) INTO active_count 
  FROM public.voting_sessions 
  WHERE status IN ('active', 'voting') AND expires_at > now();
  
  -- If we have capacity, promote the next user
  IF active_count < 100 THEN
    -- Get the next user in queue
    SELECT * INTO next_user
    FROM public.voting_queue 
    WHERE expires_at > now()
    ORDER BY queue_position 
    LIMIT 1;
    
    IF FOUND THEN
      -- Move user from queue to active session
      INSERT INTO public.voting_sessions (
        student_registration_number, 
        session_token, 
        status
      ) VALUES (
        next_user.student_registration_number,
        gen_random_uuid(),
        'active'
      );
      
      -- Remove from queue
      DELETE FROM public.voting_queue 
      WHERE id = next_user.id;
      
      -- Return the promoted user info
      SELECT 
        next_user.student_registration_number,
        vs.session_token
      INTO promoted_registration_number, session_token
      FROM public.voting_sessions vs
      WHERE vs.student_registration_number = next_user.student_registration_number
      AND vs.status = 'active';
      
      RETURN NEXT;
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable realtime for both tables
ALTER TABLE public.voting_sessions REPLICA IDENTITY FULL;
ALTER TABLE public.voting_queue REPLICA IDENTITY FULL;

-- Add tables to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.voting_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.voting_queue;
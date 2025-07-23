-- Fix security warnings by setting search_path for functions
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Fix security warnings by setting search_path for functions
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Fix security warnings by setting search_path for functions
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
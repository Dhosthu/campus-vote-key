import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { Student, Candidate, VoteSubmission } from '@/types/voting';

interface VotingPanelProps {
  student: Student;
  onVoteSuccess: (votes: VoteSubmission) => void;
}

export function VotingPanel({ student, onVoteSuccess }: VotingPanelProps) {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [votes, setVotes] = useState<VoteSubmission>({
    president_candidate_id: '',
    vice_president_candidate_id: '',
    secretary_candidate_id: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchCandidates();
  }, []);

  const fetchCandidates = async () => {
    try {
      const { data, error } = await supabase
        .from('candidates')
        .select('*')
        .order('position', { ascending: true });

      if (error) throw error;
      setCandidates((data || []) as Candidate[]);
    } catch (err) {
      setError('Failed to load candidates. Please refresh the page.');
    }
  };

  const handleVoteChange = (position: keyof VoteSubmission, candidateId: string) => {
    setVotes(prev => ({
      ...prev,
      [position]: candidateId
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!votes.president_candidate_id || !votes.vice_president_candidate_id || !votes.secretary_candidate_id) {
      setError('Please select a candidate for each position.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Submit vote
      const { error: voteError } = await supabase
        .from('votes')
        .insert({
          student_registration_number: student.registration_number,
          president_candidate_id: votes.president_candidate_id,
          vice_president_candidate_id: votes.vice_president_candidate_id,
          secretary_candidate_id: votes.secretary_candidate_id
        });

      if (voteError) throw voteError;

      // Update student's voting status
      const { error: updateError } = await supabase
        .from('students')
        .update({ has_voted: true })
        .eq('registration_number', student.registration_number);

      if (updateError) throw updateError;

      onVoteSuccess(votes);
    } catch (err) {
      setError('Failed to submit vote. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const groupedCandidates = {
    president: candidates.filter(c => c.position === 'president'),
    vice_president: candidates.filter(c => c.position === 'vice_president'),
    secretary: candidates.filter(c => c.position === 'secretary')
  };

  const positionTitles = {
    president: '🧑‍💼 President',
    vice_president: '🧑‍💼 Vice President',
    secretary: '🧑‍💼 Secretary'
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/10 p-4">
      <div className="max-w-4xl mx-auto">
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-center text-2xl">College Election 2025 - Voting Panel</CardTitle>
            <CardDescription className="text-center">
              Welcome, {student.registration_number}. Please select one candidate for each position.
            </CardDescription>
          </CardHeader>
        </Card>

        <form onSubmit={handleSubmit} className="space-y-6">
          {(['president', 'vice_president', 'secretary'] as const).map((position) => (
            <Card key={position}>
              <CardHeader>
                <CardTitle>{positionTitles[position]}</CardTitle>
                <CardDescription>Select one candidate for this position</CardDescription>
              </CardHeader>
              <CardContent>
                <RadioGroup
                  value={votes[`${position}_candidate_id`]}
                  onValueChange={(value) => handleVoteChange(`${position}_candidate_id`, value)}
                >
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {groupedCandidates[position].map((candidate) => (
                      <div key={candidate.id} className="flex items-center space-x-3 p-4 border rounded-lg hover:bg-accent/50 transition-colors">
                        <RadioGroupItem value={candidate.id} id={candidate.id} />
                        <Label htmlFor={candidate.id} className="flex items-center space-x-3 cursor-pointer flex-1">
                          <img
                            src={candidate.image_url}
                            alt={candidate.name}
                            className="w-12 h-12 rounded-full object-cover"
                          />
                          <span className="font-medium">{candidate.name}</span>
                        </Label>
                      </div>
                    ))}
                  </div>
                </RadioGroup>
              </CardContent>
            </Card>
          ))}

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Card>
            <CardContent className="pt-6">
              <Button 
                type="submit" 
                className="w-full" 
                size="lg"
                disabled={loading || !votes.president_candidate_id || !votes.vice_president_candidate_id || !votes.secretary_candidate_id}
              >
                {loading ? 'Submitting Vote...' : 'Submit Vote'}
              </Button>
            </CardContent>
          </Card>
        </form>
      </div>
    </div>
  );
}
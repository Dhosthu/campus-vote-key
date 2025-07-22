import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Candidate, VoteSubmission } from '@/types/voting';

interface SuccessPageProps {
  votes: VoteSubmission;
  onReturnHome: () => void;
}

export function SuccessPage({ votes, onReturnHome }: SuccessPageProps) {
  const [selectedCandidates, setSelectedCandidates] = useState<Candidate[]>([]);

  useEffect(() => {
    fetchSelectedCandidates();
  }, [votes]);

  const fetchSelectedCandidates = async () => {
    try {
      const candidateIds = [
        votes.president_candidate_id,
        votes.vice_president_candidate_id,
        votes.secretary_candidate_id
      ];

      const { data, error } = await supabase
        .from('candidates')
        .select('*')
        .in('id', candidateIds);

      if (error) throw error;
      setSelectedCandidates((data || []) as Candidate[]);
    } catch (err) {
      console.error('Failed to fetch selected candidates:', err);
    }
  };

  const positionTitles = {
    president: 'President',
    vice_president: 'Vice President',
    secretary: 'Secretary'
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-background to-primary/10 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8 text-green-600" />
          </div>
          <CardTitle className="text-2xl font-bold text-green-700">
            🎉 Your vote was submitted successfully!
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-center text-muted-foreground">
            Thank you for participating in the College Election 2025. Your vote has been recorded.
          </div>
          
          {selectedCandidates.length > 0 && (
            <div>
              <h3 className="font-semibold mb-4 text-center">Your Selected Candidates:</h3>
              <div className="space-y-3">
                {selectedCandidates.map((candidate) => (
                  <div key={candidate.id} className="flex items-center space-x-3 p-3 bg-accent/50 rounded-lg">
                    <img
                      src={candidate.image_url}
                      alt={candidate.name}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                    <div>
                      <div className="font-medium">{candidate.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {positionTitles[candidate.position]}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <Button onClick={onReturnHome} className="flex-1">
              Return to Homepage
            </Button>
            <Button 
              variant="outline" 
              onClick={() => window.location.reload()} 
              className="flex-1"
            >
              Logout
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
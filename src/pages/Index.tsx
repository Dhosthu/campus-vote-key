import { useState } from 'react';
import { AuthForm } from '@/components/AuthForm';
import { VotingPanel } from '@/components/VotingPanel';
import { SuccessPage } from '@/components/SuccessPage';
import { QueueStatus } from '@/components/QueueStatus';
import { Student, VoteSubmission } from '@/types/voting';
import { QueueStatus as QueueStatusType } from '@/types/queue';

type AppState = 'auth' | 'queue' | 'voting' | 'success';

const Index = () => {
  const [appState, setAppState] = useState<AppState>('auth');
  const [currentStudent, setCurrentStudent] = useState<Student | null>(null);
  const [submittedVotes, setSubmittedVotes] = useState<VoteSubmission | null>(null);
  const [queueStatus, setQueueStatus] = useState<QueueStatusType | null>(null);

  const handleAuthSuccess = (student: Student) => {
    setCurrentStudent(student);
    setAppState('voting');
  };

  const handleQueueJoin = (status: QueueStatusType) => {
    setQueueStatus(status);
    setAppState('queue');
  };

  const handleEnterVoting = () => {
    setAppState('voting');
  };

  const handleVoteSuccess = (votes: VoteSubmission) => {
    setSubmittedVotes(votes);
    setAppState('success');
  };

  const handleReturnHome = () => {
    setAppState('auth');
    setCurrentStudent(null);
    setSubmittedVotes(null);
    setQueueStatus(null);
  };

  if (appState === 'auth') {
    return <AuthForm onAuthSuccess={handleAuthSuccess} onQueueJoin={handleQueueJoin} />;
  }

  if (appState === 'queue' && queueStatus) {
    return (
      <QueueStatus 
        queueStatus={queueStatus} 
        onEnterVoting={handleEnterVoting}
        onReturnHome={handleReturnHome}
      />
    );
  }

  if (appState === 'voting' && currentStudent) {
    return <VotingPanel student={currentStudent} onVoteSuccess={handleVoteSuccess} />;
  }

  if (appState === 'success' && submittedVotes) {
    return <SuccessPage votes={submittedVotes} onReturnHome={handleReturnHome} />;
  }

  return null;
};

export default Index;

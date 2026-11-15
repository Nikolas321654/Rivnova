import { faRotateRight, faSeedling } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useState } from 'react';
import { FcGoogle } from 'react-icons/fc';
import { useLocation } from 'react-router-dom';
import { useCurrentUser } from '@/entities/user';
import { currentReturnPath, useDemoSignIn, useGoogleSignIn } from '@/features/sign-in';
import { EditProfileDialog } from '@/features/update-profile';
import { Button } from '@/shared/ui';
import { AccountMenu } from './AccountMenu';

export function AccountFooter() {
  const session = useCurrentUser();
  const location = useLocation();
  const demoSignIn = useDemoSignIn();
  const googleSignIn = useGoogleSignIn();
  const redirecting = googleSignIn.isPending || googleSignIn.isSuccess;
  const [editingProfile, setEditingProfile] = useState(false);

  if (session.isPending) {
    return (
      <Button variant="secondary" loading className="w-full justify-start px-3">
        Checking account…
      </Button>
    );
  }

  if (session.isError) {
    return (
      <div role="alert" className="grid gap-2">
        <p className="type-label">Unable to check your session.</p>
        <Button
          variant="secondary"
          onClick={() => void session.refetch()}
          loading={session.isFetching}
          className="w-full justify-start px-3"
        >
          {!session.isFetching && <FontAwesomeIcon icon={faRotateRight} aria-hidden="true" />}
          Retry account
        </Button>
      </div>
    );
  }

  if (!session.data.authenticated) {
    return (
      <div className="grid gap-2">
        <Button
          onClick={() => demoSignIn.mutate()}
          loading={demoSignIn.isPending}
          disabled={redirecting}
          className="w-full"
        >
          {!demoSignIn.isPending && <FontAwesomeIcon icon={faSeedling} aria-hidden="true" />}
          {demoSignIn.isPending ? 'Starting demo…' : 'Try as Demo Farmer'}
        </Button>
        <Button
          variant="secondary"
          onClick={() => googleSignIn.mutate(currentReturnPath(location))}
          loading={redirecting}
          disabled={demoSignIn.isPending}
          className="w-full gap-3 rounded-full px-6 font-medium! enabled:hover:border-primary! enabled:hover:bg-selection!"
        >
          {!redirecting && <FcGoogle aria-hidden="true" className="size-5 shrink-0" />}
          {redirecting ? 'Opening Google…' : 'Continue with Google'}
        </Button>
        {(demoSignIn.isError || googleSignIn.isError) && (
          <p role="alert" className="text-center text-ui-xs text-status-danger">
            {demoSignIn.isError
              ? 'Demo sign-in is unavailable right now.'
              : 'Google sign-in is unavailable right now.'}
          </p>
        )}
      </div>
    );
  }

  return (
    <>
      <AccountMenu user={session.data.user} onEditProfile={() => setEditingProfile(true)} />
      {editingProfile && (
        <EditProfileDialog user={session.data.user} onClose={() => setEditingProfile(false)} />
      )}
    </>
  );
}

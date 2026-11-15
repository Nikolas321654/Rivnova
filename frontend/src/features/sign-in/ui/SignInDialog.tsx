import { faSeedling } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { FcGoogle } from 'react-icons/fc';
import { ApiError } from '@/shared/api';
import { Button, Dialog, ParcelMotif } from '@/shared/ui';
import { useDemoSignIn } from '../model/useDemoSignIn';
import { useGoogleSignIn } from '../model/useGoogleSignIn';

type SignInDialogProps = {
  returnTo: string;
  title?: string;
  reason?: string;
  onClose: () => void;
};

function signInErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.kind === 'network') {
    return 'Unable to reach Rivnova right now. Check your connection and try again.';
  }
  if (error instanceof ApiError && error.status === 503) {
    return 'Google sign-in is not configured on the server yet. You can keep exploring the demo fields.';
  }
  return 'Google sign-in is unavailable right now. Please try again later.';
}

function demoErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.kind === 'network') {
    return 'Unable to reach Rivnova right now. Check your connection and try again.';
  }
  if (error instanceof ApiError && error.status === 404) {
    return 'Demo Farmer sign-in is not enabled on this server.';
  }
  return 'Demo Farmer sign-in is unavailable right now. Please try again later.';
}

export function SignInDialog({ returnTo, title, reason, onClose }: SignInDialogProps) {
  const signIn = useGoogleSignIn();
  const demoSignIn = useDemoSignIn();
  const redirecting = signIn.isPending || signIn.isSuccess;
  const busy = redirecting || demoSignIn.isPending;

  return (
    <Dialog
      open
      onClose={onClose}
      dismissible={!busy}
      size="sm"
      title={title ?? 'Get started with Rivnova'}
      description={reason ?? 'Explore every feature with a free demo account.'}
      headerDivider={false}
      titleClassName="type-page-title"
      decoration={<ParcelMotif className="absolute right-0 top-0 h-28 w-40 text-primary/10" />}
    >
      <Button
        onClick={() => demoSignIn.mutate(undefined, { onSuccess: onClose })}
        loading={demoSignIn.isPending}
        disabled={redirecting}
        className="min-h-12 w-full gap-2.5 text-ui-base"
      >
        {!demoSignIn.isPending && <FontAwesomeIcon icon={faSeedling} aria-hidden="true" />}
        {demoSignIn.isPending ? 'Starting demo…' : 'Try as Demo Farmer'}
      </Button>
      {demoSignIn.isError && (
        <p role="alert" className="mt-2 text-center text-ui-sm text-status-danger">
          {demoErrorMessage(demoSignIn.error)}
        </p>
      )}

      <div
        className="my-4 flex items-center gap-3 text-ui-xs text-text-secondary"
        aria-hidden="true"
      >
        <span className="h-px flex-1 bg-border" />
        or
        <span className="h-px flex-1 bg-border" />
      </div>

      <Button
        variant="secondary"
        onClick={() => signIn.mutate(returnTo)}
        loading={redirecting}
        disabled={demoSignIn.isPending}
        className="w-full gap-3 rounded-full px-6 font-medium! enabled:hover:border-primary! enabled:hover:bg-selection!"
      >
        {!redirecting && <FcGoogle aria-hidden="true" className="size-5 shrink-0" />}
        {redirecting ? 'Opening Google…' : 'Continue with Google'}
      </Button>
      {signIn.isError && (
        <p role="alert" className="mt-2 text-center text-ui-sm text-status-danger">
          {signInErrorMessage(signIn.error)}
        </p>
      )}
    </Dialog>
  );
}

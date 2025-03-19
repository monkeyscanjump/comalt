import React from 'react';

interface ErrorMessageProps {
  error: string;
}

export function ErrorMessage({ error }: ErrorMessageProps) {
  return (
    <div className="error-message">
      <p className="error-text"><strong>Error:</strong> {error}</p>
      <p className="error-hint">
        If your wallet extension doesn't appear, please check that it's unlocked and try again.
      </p>
    </div>
  );
}

"use client";

import React from 'react';
import { PageWrapper } from '@/components/layout/PageWrapper';
import { FaDownload } from 'react-icons/fa';

export default function DownloadsPage() {
  return (
    <PageWrapper title="Downloads">
      <div>
        <h1>Downloads</h1>
        <p>Your download history will be displayed here.</p>

        <div style={{ marginTop: '2rem', textAlign: 'center' }}>
          <div style={{ fontSize: '4rem', color: 'var(--color-primary)', marginBottom: '1rem' }}>
            <FaDownload />
          </div>
          <p>No downloads available yet.</p>
        </div>
      </div>
    </PageWrapper>
  );
}

"use client";

import React from 'react';
import { PageWrapper } from '@/components/layout/PageWrapper';
import { FaHome } from 'react-icons/fa';

export default function HomePage() {
  return (
    <PageWrapper
      title="Dashboard"
      icon={FaHome}
      order={1}
    >
      <div>
        <h1>Welcome to comalt</h1>
        <p>Manage and track your downloads in one place.</p>

        <div style={{ marginTop: '2rem', textAlign: 'center' }}>
          <div style={{ fontSize: '4rem', color: 'var(--color-primary)', marginBottom: '1rem' }}>
            <FaHome />
          </div>
          <p>Select an option from the navigation menu to get started.</p>
        </div>
      </div>
    </PageWrapper>
  );
}

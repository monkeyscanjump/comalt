import { useState, useEffect, useCallback } from 'react';

// Key for storing collapse state in localStorage
const COLLAPSE_STATE_KEY = 'dashboard_collapse_state';

// Section IDs for collapse state
export type SectionId = 'memory' | 'os' | 'processes' | 'cpu' | 'gpu' | 'storage' | 'network' | 'docker';

type CollapsedSections = Record<SectionId, boolean>;

interface UseCollapsibleSectionsOptions {
  defaultState?: Partial<CollapsedSections>;
}

export function useCollapsibleSections(options: UseCollapsibleSectionsOptions = {}) {
  // Default all sections to expanded (false = not collapsed)
  const defaultCollapsedSections: CollapsedSections = {
    memory: false,
    os: false,
    processes: false,
    cpu: false,
    gpu: false,
    storage: false,
    network: false,
    docker: false,
    ...options.defaultState
  };

  // Collapsed sections state
  const [collapsedSections, setCollapsedSections] = useState<CollapsedSections>(defaultCollapsedSections);

  // Track if the collapse state has been initialized from localStorage
  const [initialized, setInitialized] = useState(false);

  // Toggle section collapse state
  const toggleSectionCollapse = useCallback((sectionId: SectionId) => {
    setCollapsedSections(prev => {
      const newState = { ...prev, [sectionId]: !prev[sectionId] };
      // Save to localStorage
      localStorage.setItem(COLLAPSE_STATE_KEY, JSON.stringify(newState));
      return newState;
    });
  }, []);

  // Expand a section if it's collapsed
  const expandSection = useCallback((sectionId: SectionId) => {
    setCollapsedSections(prev => {
      if (!prev[sectionId]) return prev; // Already expanded

      const newState = { ...prev, [sectionId]: false };
      // Save to localStorage
      localStorage.setItem(COLLAPSE_STATE_KEY, JSON.stringify(newState));
      return newState;
    });
  }, []);

  // Collapse a section if it's expanded
  const collapseSection = useCallback((sectionId: SectionId) => {
    setCollapsedSections(prev => {
      if (prev[sectionId]) return prev; // Already collapsed

      const newState = { ...prev, [sectionId]: true };
      // Save to localStorage
      localStorage.setItem(COLLAPSE_STATE_KEY, JSON.stringify(newState));
      return newState;
    });
  }, []);

  // Expand all sections
  const expandAllSections = useCallback(() => {
    const expandedState = Object.keys(collapsedSections).reduce((acc, key) => {
      acc[key as SectionId] = false;
      return acc;
    }, {} as CollapsedSections);

    setCollapsedSections(expandedState);
    localStorage.setItem(COLLAPSE_STATE_KEY, JSON.stringify(expandedState));
  }, [collapsedSections]);

  // Collapse all sections
  const collapseAllSections = useCallback(() => {
    const collapsedState = Object.keys(collapsedSections).reduce((acc, key) => {
      acc[key as SectionId] = true;
      return acc;
    }, {} as CollapsedSections);

    setCollapsedSections(collapsedState);
    localStorage.setItem(COLLAPSE_STATE_KEY, JSON.stringify(collapsedState));
  }, [collapsedSections]);

  // Load collapse state from localStorage
  useEffect(() => {
    try {
      const savedCollapseState = localStorage.getItem(COLLAPSE_STATE_KEY);
      if (savedCollapseState) {
        const parsedState = JSON.parse(savedCollapseState);
        setCollapsedSections(prevState => ({
          ...prevState,
          ...parsedState
        }));
      }
      setInitialized(true);
    } catch (err) {
      console.error('Failed to load section collapse state:', err);
      setInitialized(true);
    }
  }, []);

  return {
    collapsedSections,
    toggleSectionCollapse,
    expandSection,
    collapseSection,
    expandAllSections,
    collapseAllSections,
    initialized
  };
}

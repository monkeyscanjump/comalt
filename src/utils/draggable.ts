import { useState, useEffect, useRef, useCallback } from 'react';

export interface DraggablePosition {
  x: number;
  y: number;
}

export type EdgeType = 'left' | 'right' | 'top' | 'bottom';

export interface DraggableOptions {
  // Initial position
  initialPosition?: DraggablePosition;
  // Should position persist through refreshes
  persistPosition?: boolean;
  // Storage key for persistence
  storageKey?: string;
  // Whether to calculate closest edge on drag end
  detectEdges?: boolean;
  // Prevent specific elements from triggering drag
  ignoreDragSelectors?: string[];
  // Target FPS for drag animation (default: 30)
  targetFps?: number;
  // Resize debounce time in ms (default: 200)
  resizeDebounceMs?: number;
  // Safety margin from viewport edges in pixels (default: 20)
  safetyMargin?: number;
  // Callbacks
  onDragStart?: (position: DraggablePosition) => void;
  onDragMove?: (position: DraggablePosition) => void;
  onDragEnd?: (position: DraggablePosition, edge?: EdgeType) => void;
  onPositionAdjusted?: (position: DraggablePosition) => void;
}

export interface DraggableControls {
  // Current state
  position: DraggablePosition;
  isDragging: boolean;
  snappedEdge?: EdgeType;

  // Methods
  startDrag: (e: React.MouseEvent | React.TouchEvent) => void;
  setPosition: (position: DraggablePosition) => void;
  getClosestEdge: (element: HTMLElement) => EdgeType;
}

// Create a style element once for the no-select class
const createGlobalDragStyle = () => {
  if (typeof window === 'undefined') return;

  // Check if our style already exists
  const styleId = 'draggable-no-select-style';
  if (document.getElementById(styleId)) return;

  // Create style element
  const style = document.createElement('style');
  style.id = styleId;
  style.innerHTML = `
    .draggable-no-select {
      user-select: none !important;
      -webkit-user-select: none !important;
      -moz-user-select: none !important;
      -ms-user-select: none !important;
      cursor: grabbing !important;
    }
  `;

  // Add to document head
  document.head.appendChild(style);
};

// Helper functions to manage selection state
const enableGlobalNoSelect = () => {
  if (typeof window === 'undefined') return;
  document.body.classList.add('draggable-no-select');
};

const disableGlobalNoSelect = () => {
  if (typeof window === 'undefined') return;
  document.body.classList.remove('draggable-no-select');
};

export const useDraggable = (
  elementRef: React.RefObject<HTMLElement>,
  options: DraggableOptions = {}
): DraggableControls => {
  // Options with defaults
  const {
    initialPosition = { x: 100, y: 100 },
    persistPosition = false,
    storageKey = 'draggable-position',
    detectEdges = false,
    ignoreDragSelectors = ['button', 'a', 'input'],
    targetFps = 30, // Default to 30 FPS
    resizeDebounceMs = 200, // Default debounce time for resize events
    safetyMargin = 20, // Default safety margin from viewport edges
    onDragStart,
    onDragMove,
    onDragEnd,
    onPositionAdjusted
  } = options;

  // Calculate frame interval in milliseconds based on target FPS
  const frameInterval = 1000 / targetFps;

  // State
  const [position, setPosition] = useState<DraggablePosition>(initialPosition);
  const [isDragging, setIsDragging] = useState(false);
  const [snappedEdge, setSnappedEdge] = useState<EdgeType>('right');

  // Refs to track drag state
  const dragStartRef = useRef({ x: 0, y: 0, posX: 0, posY: 0 });
  const lastUpdateTimeRef = useRef(0);
  const animationFrameRef = useRef(0);
  const pendingPositionRef = useRef<DraggablePosition | null>(null);
  const resizeTimerRef = useRef<number | null>(null);

  // Create global style for no-select on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      createGlobalDragStyle();
    }
  }, []);

  // Clean up animation frame on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (resizeTimerRef.current !== null) {
        window.clearTimeout(resizeTimerRef.current);
      }
    };
  }, []);

  // Function to constrain position within viewport with safety margin
  const constrainToViewport = useCallback((newPosition: DraggablePosition): DraggablePosition => {
    if (!elementRef.current || typeof window === 'undefined') {
      return newPosition;
    }

    const rect = elementRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Get current element dimensions without modifying them
    const width = rect.width;
    const height = rect.height;

    // Calculate maximum allowed positions with safety margin
    // Make sure we don't have negative margins if the element is larger than viewport minus margins
    const maxX = Math.max(safetyMargin, viewportWidth - width - safetyMargin);
    const maxY = Math.max(safetyMargin, viewportHeight - height - safetyMargin);

    // Ensure position stays within viewport including safety margin
    return {
      x: Math.max(safetyMargin, Math.min(newPosition.x, maxX)),
      y: Math.max(safetyMargin, Math.min(newPosition.y, maxY))
    };
  }, [elementRef, safetyMargin]);

  // Handle window resize with debounce
  const handleWindowResize = useCallback(() => {
    // Clear any existing timer
    if (resizeTimerRef.current !== null) {
      window.clearTimeout(resizeTimerRef.current);
    }

    // Set new debounced timer
    resizeTimerRef.current = window.setTimeout(() => {
      if (elementRef.current && !isDragging) {
        // First check if the current position is still valid
        const constrainedPosition = constrainToViewport(position);

        // Only update if position actually changed
        if (constrainedPosition.x !== position.x || constrainedPosition.y !== position.y) {
          setPosition(constrainedPosition);
          onPositionAdjusted?.(constrainedPosition);

          // If position is persisted, update storage
          if (persistPosition && typeof window !== 'undefined') {
            localStorage.setItem(`${storageKey}-position`, JSON.stringify(constrainedPosition));
          }
        }
      }

      // Clear the timer reference
      resizeTimerRef.current = null;
    }, resizeDebounceMs);
  }, [position, elementRef, isDragging, constrainToViewport, onPositionAdjusted, persistPosition, storageKey, resizeDebounceMs]);

  // Add resize event listener
  useEffect(() => {
    window.addEventListener('resize', handleWindowResize);
    return () => {
      window.removeEventListener('resize', handleWindowResize);
    };
  }, [handleWindowResize]);

  // Load persisted position on mount
  useEffect(() => {
    if (persistPosition && typeof window !== 'undefined') {
      try {
        const savedPosition = localStorage.getItem(`${storageKey}-position`);
        if (savedPosition) {
          const loadedPosition = JSON.parse(savedPosition);
          // Apply viewport constraints to loaded position
          setPosition(constrainToViewport(loadedPosition));
        }

        const savedEdge = localStorage.getItem(`${storageKey}-edge`);
        if (savedEdge) {
          setSnappedEdge(JSON.parse(savedEdge));
        }
      } catch (e) {
        console.error('Failed to load draggable position:', e);
      }
    }
  }, [persistPosition, storageKey, constrainToViewport]);

  // Save position when it changes
  useEffect(() => {
    if (persistPosition && typeof window !== 'undefined' && !isDragging) {
      localStorage.setItem(`${storageKey}-position`, JSON.stringify(position));
    }
  }, [position, persistPosition, storageKey, isDragging]);

  // Save edge when it changes
  useEffect(() => {
    if (persistPosition && typeof window !== 'undefined') {
      localStorage.setItem(`${storageKey}-edge`, JSON.stringify(snappedEdge));
    }
  }, [snappedEdge, persistPosition, storageKey]);

  // Toggle body no-select class based on isDragging
  useEffect(() => {
    if (isDragging) {
      enableGlobalNoSelect();
    } else {
      disableGlobalNoSelect();
    }

    return () => {
      if (isDragging) {
        disableGlobalNoSelect();
      }
    };
  }, [isDragging]);

  // Calculate closest edge (modified to consider safety margin)
  const getClosestEdge = useCallback((element: HTMLElement): EdgeType => {
    const rect = element.getBoundingClientRect();
    const distanceToLeft = rect.left - safetyMargin;
    const distanceToTop = rect.top - safetyMargin;
    const distanceToRight = window.innerWidth - rect.right - safetyMargin;
    const distanceToBottom = window.innerHeight - rect.bottom - safetyMargin;

    const distances = [
      { edge: 'left' as EdgeType, distance: distanceToLeft },
      { edge: 'top' as EdgeType, distance: distanceToTop },
      { edge: 'right' as EdgeType, distance: distanceToRight },
      { edge: 'bottom' as EdgeType, distance: distanceToBottom }
    ];

    return distances.sort((a, b) => a.distance - b.distance)[0].edge;
  }, [safetyMargin]);

  // Throttled position update function
  const updatePositionThrottled = useCallback((newPosition: DraggablePosition) => {
    // Apply viewport constraints immediately
    const constrainedPosition = constrainToViewport(newPosition);

    // Store the most recent position data
    pendingPositionRef.current = constrainedPosition;

    // If we already have an animation frame queued, don't request another
    if (animationFrameRef.current) {
      return;
    }

    // Schedule a single animation frame for the update
    animationFrameRef.current = requestAnimationFrame(() => {
      const now = performance.now();

      // Only update if enough time has passed (for our target FPS)
      if (now - lastUpdateTimeRef.current >= frameInterval) {
        if (pendingPositionRef.current) {
          setPosition(pendingPositionRef.current);
          onDragMove?.(pendingPositionRef.current);
          lastUpdateTimeRef.current = now;
        }
      }

      // Clear the animation frame
      animationFrameRef.current = 0;

      // If we're still dragging, schedule the next update
      if (isDragging && pendingPositionRef.current) {
        setTimeout(() => {
          if (isDragging && pendingPositionRef.current) {
            updatePositionThrottled(pendingPositionRef.current);
          }
        }, Math.max(0, frameInterval - (performance.now() - now)));
      }
    });
  }, [frameInterval, onDragMove, isDragging, constrainToViewport]);

  // Handle drag move
  const handleDragMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (!isDragging) return;

    e.preventDefault();

    let clientX: number, clientY: number;

    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const deltaX = clientX - dragStartRef.current.x;
    const deltaY = clientY - dragStartRef.current.y;

    const newPosition = {
      x: dragStartRef.current.posX + deltaX,
      y: dragStartRef.current.posY + deltaY
    };

    // Use throttled update function
    updatePositionThrottled(newPosition);
  }, [isDragging, updatePositionThrottled]);

  // Handle drag end
  const handleDragEnd = useCallback(() => {
    if (!isDragging) return;

    setIsDragging(false);

    // Cancel any pending animation frame
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = 0;
    }

    // If there's a pending position update, apply it immediately
    if (pendingPositionRef.current) {
      setPosition(constrainToViewport(pendingPositionRef.current));
      pendingPositionRef.current = null;
    }

    // Calculate closest edge if needed
    if (detectEdges && elementRef.current) {
      const edge = getClosestEdge(elementRef.current);
      setSnappedEdge(edge);
      onDragEnd?.(position, edge);
    } else {
      onDragEnd?.(position);
    }
  }, [isDragging, position, detectEdges, elementRef, getClosestEdge, onDragEnd, constrainToViewport]);

  // Set up global event listeners
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleDragMove);
      window.addEventListener('mouseup', handleDragEnd);
      window.addEventListener('touchmove', handleDragMove, { passive: false });
      window.addEventListener('touchend', handleDragEnd);
    }

    return () => {
      window.removeEventListener('mousemove', handleDragMove);
      window.removeEventListener('mouseup', handleDragEnd);
      window.removeEventListener('touchmove', handleDragMove);
      window.removeEventListener('touchend', handleDragEnd);
    };
  }, [isDragging, handleDragMove, handleDragEnd]);

  // Start dragging
  const startDrag = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    // Don't start drag on ignored elements
    if (ignoreDragSelectors.some(selector =>
      e.target instanceof Element && e.target.matches(selector)
    )) {
      return;
    }

    // Reset timing references
    lastUpdateTimeRef.current = performance.now();
    pendingPositionRef.current = null;

    setIsDragging(true);

    let clientX: number, clientY: number;

    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    dragStartRef.current = {
      x: clientX,
      y: clientY,
      posX: position.x,
      posY: position.y
    };

    onDragStart?.(position);
  }, [ignoreDragSelectors, position, onDragStart]);

  // Update position manually - with viewport constraints
  const updatePosition = useCallback((newPosition: DraggablePosition) => {
    setPosition(constrainToViewport(newPosition));
  }, [constrainToViewport]);

  return {
    position,
    isDragging,
    snappedEdge,
    startDrag,
    setPosition: updatePosition,
    getClosestEdge
  };
};

import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { BranchInfo } from '../../utils/treeUtils';

export interface BranchStepperProps {
  branchInfo: BranchInfo;
  onPrev: () => void;
  onNext: () => void;
  className?: string;
}

export const BranchStepper: React.FC<BranchStepperProps> = ({
  branchInfo,
  onPrev,
  onNext,
  className = '',
}) => {
  const { currentIndex, totalVersions, hasPrev, hasNext } = branchInfo;

  if (totalVersions <= 1) return null;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft' && hasPrev) {
      e.preventDefault();
      onPrev();
    } else if (e.key === 'ArrowRight' && hasNext) {
      e.preventDefault();
      onNext();
    }
  };

  return (
    <div
      data-testid="version-stepper"
      tabIndex={0}
      role="group"
      aria-label={`Version ${currentIndex} of ${totalVersions}`}
      onKeyDown={handleKeyDown}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-container-highest/80 text-[11px] font-mono text-on-surface-variant border border-outline-variant/30 select-none focus:outline-none focus:ring-1 focus:ring-primary ${className}`}
    >
      <button
        type="button"
        data-testid="stepper-prev-btn"
        aria-label="Previous version"
        disabled={!hasPrev}
        onClick={(e) => {
          e.stopPropagation();
          onPrev();
        }}
        className={`p-0.5 rounded-full hover:bg-surface-container transition-colors disabled:opacity-30 disabled:cursor-not-allowed`}
      >
        <ChevronLeft className="w-3.5 h-3.5" />
      </button>

      <span className="px-1 text-xs font-semibold tabular-nums">
        {currentIndex} / {totalVersions}
      </span>

      <button
        type="button"
        data-testid="stepper-next-btn"
        aria-label="Next version"
        disabled={!hasNext}
        onClick={(e) => {
          e.stopPropagation();
          onNext();
        }}
        className={`p-0.5 rounded-full hover:bg-surface-container transition-colors disabled:opacity-30 disabled:cursor-not-allowed`}
      >
        <ChevronRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};

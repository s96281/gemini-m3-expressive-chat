import React from 'react';
import { Sparkles, Code2, Lightbulb, PenLine, Compass, ArrowUpRight } from 'lucide-react';

export interface StarterPromptCard {
  id: string;
  category: 'code' | 'brainstorm' | 'write' | 'analyze';
  title: string;
  description: string;
  prompt: string;
  icon: React.ReactNode;
  accentClass: string;
  testId: string;
}

export function getTimeOfDayGreeting(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'Good morning';
  if (hour >= 12 && hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export interface ZeroStateProps {
  onSelectPrompt: (prompt: string) => void;
  userName?: string;
}

export const ZeroState: React.FC<ZeroStateProps> = ({
  onSelectPrompt,
  userName = 'Explorer',
}) => {
  const greeting = getTimeOfDayGreeting();

  const starterCards: StarterPromptCard[] = [
    {
      id: 'code',
      testId: 'starter-card-code',
      category: 'code',
      title: 'Write a React Hook',
      description: 'Create a custom React hook for debouncing input with TypeScript and clean cleanup.',
      prompt: 'Create a custom React hook for debouncing input with TypeScript and clean cleanup.',
      icon: <Code2 className="w-5 h-5 text-primary" />,
      accentClass: 'bg-primary-container/40',
    },
    {
      id: 'brainstorm',
      testId: 'starter-card-brainstorm',
      category: 'brainstorm',
      title: 'Brainstorm AI Features',
      description: 'Brainstorm 5 innovative features for a modern AI chat application using Material 3 Expressive.',
      prompt: 'Brainstorm 5 innovative features for a modern AI chat application using Material 3 Expressive.',
      icon: <Lightbulb className="w-5 h-5 text-tertiary" />,
      accentClass: 'bg-tertiary-container/40',
    },
    {
      id: 'write',
      testId: 'starter-card-write',
      category: 'write',
      title: 'Draft an Article',
      description: 'Draft an engaging blog post explaining the principles of Material 3 Expressive design.',
      prompt: 'Draft an engaging blog post explaining the principles of Material 3 Expressive design.',
      icon: <PenLine className="w-5 h-5 text-secondary" />,
      accentClass: 'bg-secondary-container/40',
    },
    {
      id: 'analyze',
      testId: 'starter-card-analyze',
      category: 'analyze',
      title: 'Compare Architectures',
      description: 'Analyze architectural trade-offs between client-side simulated AI streaming versus server-side SSE.',
      prompt: 'Analyze architectural trade-offs between client-side simulated AI streaming versus server-side SSE.',
      icon: <Compass className="w-5 h-5 text-emerald-500" />,
      accentClass: 'bg-emerald-500/10',
    },
  ];

  return (
    <div
      data-testid="zero-state-container"
      className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 md:p-8 max-w-4xl mx-auto w-full my-auto transition-opacity duration-300"
    >
      {/* Hero Greeting Zone */}
      <div className="flex flex-col items-center text-center mb-8 sm:mb-12">
        <div className="w-12 h-12 rounded-2xl bg-primary-container/60 text-primary flex items-center justify-center mb-4 shadow-sm">
          <Sparkles className="w-6 h-6 animate-pulse" />
        </div>

        <h1
          data-testid="zero-state-greeting"
          className="text-3xl sm:text-4xl md:text-5xl font-medium tracking-tight bg-gradient-to-r from-primary via-tertiary to-secondary bg-clip-text text-transparent leading-tight"
        >
          {greeting}, {userName}
        </h1>

        <p className="mt-3 text-sm sm:text-base text-on-surface-variant max-w-md">
          Where would you like to start today? Choose a starter prompt below or enter your own.
        </p>
      </div>

      {/* 4 M3 Elevated Starter Prompt Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 max-w-2xl w-full">
        {starterCards.map((card) => (
          <button
            key={card.id}
            data-testid={card.testId}
            onClick={() => onSelectPrompt(card.prompt)}
            className="group relative flex flex-col justify-between p-4 sm:p-5 rounded-[20px] bg-surface-container-low hover:bg-surface-container border border-outline-variant/30 hover:border-outline/50 shadow-elevation-1 hover:shadow-elevation-2 transition-all duration-200 ease-[cubic-bezier(0.2,0,0,1)] hover:-translate-y-0.5 active:scale-[0.98] cursor-pointer text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <div
                  className={`w-10 h-10 rounded-2xl flex items-center justify-center ${card.accentClass} group-hover:scale-105 transition-transform duration-200`}
                >
                  {card.icon}
                </div>
                <ArrowUpRight className="w-4 h-4 text-outline group-hover:text-primary group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
              </div>

              <h2 className="text-sm font-semibold text-on-surface group-hover:text-primary transition-colors">
                {card.title}
              </h2>

              <p className="mt-1.5 text-xs text-on-surface-variant line-clamp-2 leading-relaxed">
                {card.description}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};


import React from 'react';
import { Tab } from '../types';
import { SparkleIcon, ChatIcon, MicIcon, UsersIcon, DiscIcon } from './icons';

interface TabsProps {
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
}

const Tabs: React.FC<TabsProps> = ({ activeTab, setActiveTab }) => {
  const tabs: { id: Tab; name: string; icon: React.ElementType }[] = [
    { id: 'analyze', name: 'Song Analysis', icon: SparkleIcon },
    { id: 'album', name: 'Album Session', icon: DiscIcon },
    { id: 'critique', name: 'Critique Simulator', icon: UsersIcon },
    { id: 'chat', name: 'AI Chat', icon: ChatIcon },
    { id: 'transcribe', name: 'Transcribe', icon: MicIcon },
  ];

  return (
    <div className="border-b border-gray-700">
      <nav className="-mb-px flex space-x-4 sm:space-x-8 px-6" aria-label="Tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`${
              activeTab === tab.id
                ? 'border-purple-400 text-purple-400'
                : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-500'
            } group inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200 focus:outline-none`}
            aria-current={activeTab === tab.id ? 'page' : undefined}
          >
            <tab.icon
              className={`${
                activeTab === tab.id ? 'text-purple-400' : 'text-gray-500 group-hover:text-gray-300'
              } -ml-0.5 mr-2 h-5 w-5 transition-colors duration-200`}
              aria-hidden="true"
            />
            <span>{tab.name}</span>
          </button>
        ))}
      </nav>
    </div>
  );
};

export default Tabs;
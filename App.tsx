
import React, { useState, ReactNode } from 'react';
import { Tab } from './types';
import Header from './components/Header';
import Tabs from './components/Tabs';
import SongAnalysis from './components/SongAnalysis';
import Chatbot from './components/Chatbot';
import Transcriber from './components/Transcriber';
import CritiqueSimulator from './components/CritiqueSimulator';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('analyze');

  const renderContent = (): ReactNode => {
    switch (activeTab) {
      case 'analyze':
        return <SongAnalysis />;
      case 'chat':
        return <Chatbot />;
      case 'transcribe':
        return <Transcriber />;
      case 'critique':
        return <CritiqueSimulator />;
      default:
        return null;
    }
  };

  return (
    <div className="bg-gray-900 text-gray-100 min-h-screen font-sans">
      <Header />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-gray-800/50 rounded-lg shadow-2xl backdrop-blur-md border border-gray-700">
          <Tabs activeTab={activeTab} setActiveTab={setActiveTab} />
          <div className="p-6 md:p-8 min-h-[60vh]">
            {renderContent()}
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
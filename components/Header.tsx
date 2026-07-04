
import React from 'react';
import { SparkleIcon } from './icons';

const Header: React.FC = () => {
  return (
    <header className="py-6 px-4 sm:px-6 lg:px-8 text-center">
      <div className="flex items-center justify-center gap-3">
        <SparkleIcon className="w-8 h-8 text-purple-400" />
        <h1 className="text-4xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400">
          Quantum Cadence
        </h1>
      </div>
      <p className="mt-2 text-lg text-gray-400">
        Your AI-Powered Song Analysis & Creation Partner
      </p>
    </header>
  );
};

export default Header;

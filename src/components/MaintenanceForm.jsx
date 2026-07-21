import React, { useState } from 'react';
// Import your components...

const ExpensesDashboard = () => {
  const [activeTab, setActiveTab] = useState('general'); // 'general' or 'maintenance'

  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">Expenses</h1>
      </div>

      {/* Tab Switcher Navigation */}
      <div className="flex border-b border-gray-200">
        <button
          className={`py-2 px-4 font-medium text-sm border-b-2 transition-colors ${
            activeTab === 'general'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
          onClick={() => setActiveTab('general')}
        >
          General Operating Expenses
        </button>
        <button
          className={`py-2 px-4 font-medium text-sm border-b-2 transition-colors ${
            activeTab === 'maintenance'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
          onClick={() => setActiveTab('maintenance')}
        >
          Vehicle Maintenance Logs
        </button>
      </div>

      {/* Dynamic Tab Content */}
      <div className="mt-4">
        {activeTab === 'general' ? (
          <div>
            {/* Move your existing Expense Form & Expense Table here */}
            {/* This is what you already built! */}
          </div>
        ) : (
          <div>
            {/* This is where our new Maintenance Layout drops in */}
            <MaintenanceSection />
          </div>
        )}
      </div>
    </div>
  );
};

export default ExpensesDashboard;
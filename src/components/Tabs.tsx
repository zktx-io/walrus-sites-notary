import { useEffect, useState } from 'react';

type Tab = {
  label: React.ReactNode;
  value: string;
  content: React.ReactNode;
};

type TabsProps = {
  tabs: Tab[];
  initial?: string;
};

export const Tabs = ({ tabs, initial }: TabsProps) => {
  const [activeTab, setActiveTab] = useState(initial || tabs[0].value);

  useEffect(() => {
    if (tabs.length === 0) return;
    setActiveTab((prev) =>
      tabs.some((tab) => tab.value === prev) ? prev : tabs[0].value,
    );
  }, [tabs]);

  const currentTab = tabs.find((tab) => tab.value === activeTab);

  return (
    <div>
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            className={`group flex items-center gap-1 px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.value
                ? 'border-b-2 border-black dark:border-white text-black dark:text-white'
                : 'text-gray-500 hover:text-black dark:text-gray-400 dark:hover:text-white'
            }`}
            onClick={() => setActiveTab(tab.value)}
          >
            <span className="flex items-center gap-1">{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="mt-4 text-gray-800 dark:text-gray-100">
        {currentTab?.content}
      </div>
    </div>
  );
};

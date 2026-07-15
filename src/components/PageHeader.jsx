'use client';

import { useRouter } from 'next/navigation';

export default function PageHeader({ title, breadcrumb }) {
  const router = useRouter();

  const handleSignOut = async () => {
    console.log("Sign out clicked!");
  };

  return (
    <header className="page-header flex justify-between items-start">
      {/* Left side: Title and Breadcrumb */}
      <div className="flex flex-col gap-1">
        <h1>{title}</h1>
        {breadcrumb && (
          <span className="page-header-subtitle">{breadcrumb}</span>
        )}
      </div>
      
      {/* Right side: Sign Out Button */}
      <button 
        onClick={handleSignOut}
        className="flex items-center gap-2 text-white hover:text-white/80 transition-colors text-sm font-medium"
      >
        <svg 
          width="16" 
          height="16" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2" 
          strokeLinecap="round" 
          strokeLinejoin="round"
        >
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
          <polyline points="16 17 21 12 16 7"></polyline>
          <line x1="21" y1="12" x2="9" y2="12"></line>
        </svg>
        Sign out
      </button>
    </header>
  );
}
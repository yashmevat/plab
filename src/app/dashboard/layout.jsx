// app/dashboard/layout.jsx (or wherever you use Sidebar)

import Sidebar from "@/components/SideBar";

export default function DashboardLayout({ children }) {
  return (
    <div className="flex h-screen overflow-hidden bg-gray-100">
      {/* Sidebar - Fixed position */}
      <Sidebar />
      
      {/* Main Content - Scrollable */}
      <main className="flex-1 overflow-y-auto">
        {/* Add padding on mobile to account for hamburger button */}
        <div className="p-4 lg:p-8 pt-16 lg:pt-8">
          {children}
        </div>
      </main>
    </div>
  );
}

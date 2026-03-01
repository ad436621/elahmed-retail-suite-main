import { Outlet, useLocation } from 'react-router-dom';
import AppSidebar from '@/components/AppSidebar';
import MobileNavBar from '@/components/MobileNavBar';
import TopHeader from '@/components/TopHeader';

const MainLayout = () => {
  const location = useLocation();

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopHeader />
        {/* pb-16 to clear the bottom nav on mobile */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-20 md:pb-6 relative z-0">
          <div key={location.pathname} className="animate-fade-in h-full">
            <Outlet />
          </div>
        </main>
      </div>
      <MobileNavBar />
    </div>
  );
};

export default MainLayout;

import { Outlet, useLocation } from 'react-router-dom';
import AppSidebar from '@/components/AppSidebar';
import TopHeader from '@/components/TopHeader';
import MobileNavBar from '@/components/MobileNavBar';
import { cn } from '@/lib/utils';

const MainLayout = () => {
  const location = useLocation();

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {location.pathname !== '/pos' && <TopHeader />}
        {/* pb-16 to clear the bottom nav on mobile */}
        <main className={cn(
          "flex-1 overflow-y-auto relative w-full",
          location.pathname === '/pos' ? "p-0" : "p-4 md:p-8 pb-20 md:pb-8"
        )}>
          <div key={location.pathname} className={cn(
            "animate-fade-in h-full mx-auto",
            location.pathname === '/pos' ? "w-full max-w-none" : "max-w-screen-2xl"
          )}>
            <Outlet />
          </div>
        </main>
      </div>
      <MobileNavBar />
    </div>
  );
};

export default MainLayout;

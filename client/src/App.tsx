import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, Redirect } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Login from "./pages/Login";
import AdminLayout from "./components/AdminLayout";
import AdminDashboard from "./pages/admin/Dashboard";
import Deliveries from "./pages/admin/Deliveries";
import DeliveryPersonDetails from "./pages/admin/DeliveryPersonDetails";
import Orders from "./pages/admin/Orders";
import Regions from "./pages/admin/Regions";
import Provinces from "./pages/admin/Provinces";
import Statistics from "./pages/admin/Statistics";
import AdvancedStatistics from "./pages/admin/AdvancedStatistics";
import AdvancedOrders from "./pages/admin/AdvancedOrders";
import DeletedOrders from "./pages/admin/DeletedOrders";
import Settings from "./pages/admin/Settings";
import SystemSettings from "./pages/admin/SystemSettings";
import Messages from "./pages/admin/Messages";
import DeliveryMap from "./pages/admin/DeliveryMap";
import DeliveryTracking from "./pages/admin/DeliveryTracking";
import LiveTracking from "./pages/admin/LiveTracking";
import UserManagement from "./pages/admin/UserManagement";
import DeliveryHistory from "./pages/admin/DeliveryHistory";
import DeliveryDashboardPage from "./pages/admin/DeliveryDashboard";
import DeliveryPersonDetailsPage from "./pages/DeliveryPersonDetails";
import Customers from "./pages/admin/Customers";
import CustomerDetails from "./pages/admin/CustomerDetails";
import IncompleteOrders from "./pages/admin/IncompleteOrders";
import MonthlyPerformance from "./pages/admin/MonthlyPerformance";
import CreateOrder from "./pages/admin/CreateOrder";
import DeliveryDashboard from "./pages/delivery/Dashboard";
import DeliveryNotifications from "./pages/delivery/Notifications";
import NotificationSettings from "./pages/delivery/NotificationSettings";
import DeliveryProfile from "./pages/delivery/DeliveryProfile";
import DeliveryNavigation from "./pages/delivery/DeliveryNavigation";
import TraccarSettings from "./pages/admin/TraccarSettings";
import TraccarStats from "./pages/admin/TraccarStats";
import MonthlyDistanceReport from "@/pages/admin/MonthlyDistanceReport";
import TraccarDashboard from "@/pages/admin/TraccarDashboard";
import AdvancedTracking from "@/pages/admin/AdvancedTracking";
import DeliverySpeedAnalytics from "@/pages/admin/DeliverySpeedAnalytics";

import ActivityLogs from "@/pages/admin/ActivityLogs";
import EmployeeStats from "@/pages/admin/EmployeeStats";
import SuperAdminDashboard from "@/pages/admin/SuperAdminDashboard";
import SubscriptionCodes from "@/pages/superadmin/SubscriptionCodes";
import SuperAdminStore from "@/pages/SuperAdminStore";
import Store from "@/pages/Store";

import About from "@/pages/admin/About";
import Updates from "@/pages/admin/Updates";
import UpdatesManagement from "@/pages/superadmin/UpdatesManagement";
import AnnouncementsManagement from "@/pages/superadmin/AnnouncementsManagement";
import SiteSettings from "@/pages/superadmin/SiteSettings";
import DeletedBranches from "@/pages/superadmin/DeletedBranches";
import NotificationSettingsPage from '@/pages/superadmin/NotificationSettings';
import TestNotifications from '@/pages/admin/TestNotifications';
import RegisteredUsers from '@/pages/admin/RegisteredUsers';
import NotificationStats from '@/pages/admin/NotificationStats';

import Home from "./pages/Home";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import RegisterPharmacy from "./pages/RegisterPharmacy";
import Maintenance from "./pages/Maintenance";
import { useCustomAuth } from "./hooks/useCustomAuth";
import { InstallPWA } from "./components/InstallPWA";
import { trpc } from "@/lib/trpc";

function Router() {
  const { user, loading, isAuthenticated, isAdmin, isDelivery, isSuperAdmin } = useCustomAuth();
  const { data: maintenanceStatus, isLoading: maintenanceLoading } = trpc.maintenance.getStatus.useQuery();

  if (loading || maintenanceLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }
  
  // فحص وضع الصيانة - السماح فقط لـ Super Admin بالدخول
  if (maintenanceStatus?.isEnabled === 1 && !isSuperAdmin) {
    return <Maintenance message={maintenanceStatus.message || undefined} estimatedEndTime={maintenanceStatus.estimatedEndTime} />;
  }

  // Show home or login page if not authenticated
  if (!user || !isAuthenticated) {
    return (
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/login" component={Login} />
        <Route path="/register-pharmacy" component={RegisterPharmacy} />
        <Route path="/privacy-policy" component={PrivacyPolicy} />
        <Route path="/:rest*">
          {() => <Redirect to="/" />}
        </Route>
      </Switch>
    );
  }

  // Redirect based on role
  return (
    <Switch>
      {/* Allow access to login page even when authenticated (for custom login) */}
      <Route path="/login" component={Login} />
      <Route path="/admin">
        {() => {
          // Super Admin without a branch context → super admin dashboard
          // Super Admin who entered a branch (has branchId set) → show branch admin panel
          if (isSuperAdmin && !user?.branchId) return <Redirect to="/admin/super-admin" />;
          if (!isAdmin) return <Redirect to="/delivery" />;
          return (
            <AdminLayout>
              <AdminDashboard />
            </AdminLayout>
          );
        }}
      </Route>
      <Route path="/admin/super-admin">
        {() => {
          if (!isSuperAdmin) return <Redirect to="/admin" />;
          return (
            <AdminLayout>
              <SuperAdminDashboard />
            </AdminLayout>
          );
        }}
      </Route>
      <Route path="/admin/subscription-codes">
        {() => {
          if (!isSuperAdmin) return <Redirect to="/admin" />;
          return (
            <AdminLayout>
              <SubscriptionCodes />
            </AdminLayout>
          );
        }}
      </Route>
      <Route path="/admin/store">
        {() => {
          if (!isSuperAdmin) return <Redirect to="/admin" />;
          return (
            <AdminLayout>
              <SuperAdminStore />
            </AdminLayout>
          );
        }}
      </Route>
      <Route path="/store">
        {() => {
          if (!isAdmin) return <Redirect to="/login" />;
          return (
            <AdminLayout>
              <Store />
            </AdminLayout>
          );
        }}
      </Route>
      <Route path="/admin/deliveries">
        {() => {
          if (!isAdmin) return <Redirect to="/delivery" />;
          return (
            <AdminLayout>
              <Deliveries />
            </AdminLayout>
          );
        }}
      </Route>
      <Route path="/admin/deliveries/:id">
        {() => {
          if (!isAdmin) return <Redirect to="/delivery" />;
          return (
            <AdminLayout>
              <DeliveryPersonDetails />
            </AdminLayout>
          );
        }}
      </Route>
      <Route path="/admin/orders">
        {() => {
          if (!isAdmin) return <Redirect to="/delivery" />;
          return (
            <AdminLayout>
              <Orders />
            </AdminLayout>
          );
        }}
      </Route>
      <Route path="/admin/orders/create">
        {() => {
          if (!isAdmin) return <Redirect to="/delivery" />;
          return (
            <AdminLayout>
              <CreateOrder />
            </AdminLayout>
          );
        }}
      </Route>
      <Route path="/admin/regions">
        {() => {
          if (!isAdmin) return <Redirect to="/delivery" />;
          return (
            <AdminLayout>
              <Regions />
            </AdminLayout>
          );
        }}
      </Route>
      <Route path="/admin/provinces">
        {() => {
          if (!isAdmin) return <Redirect to="/delivery" />;
          return (
            <AdminLayout>
              <Provinces />
            </AdminLayout>
          );
        }}
      </Route>
      <Route path="/admin/statistics">
        {() => {
          if (!isAdmin) return <Redirect to="/delivery" />;
          return (
            <AdminLayout>
              <AdvancedStatistics />
            </AdminLayout>
          );
        }}
      </Route>
      <Route path="/admin/advanced-orders">
        {() => {
          if (!isAdmin) return <Redirect to="/delivery" />;
          return (
            <AdminLayout>
              <AdvancedOrders />
            </AdminLayout>
          );
        }}
      </Route>
      <Route path="/admin/deleted-orders">
        {() => {
          if (!isAdmin) return <Redirect to="/delivery" />;
          return (
            <AdminLayout>
              <DeletedOrders />
            </AdminLayout>
          );
        }}
      </Route>
      <Route path="/admin/settings">
        {() => {
          if (!isAdmin) return <Redirect to="/delivery" />;
          return (
            <AdminLayout>
              <Settings />
            </AdminLayout>
          );
        }}
      </Route>
      <Route path="/admin/system-settings">
        {() => {
          if (!isAdmin) return <Redirect to="/delivery" />;
          return (
            <AdminLayout>
              <SystemSettings />
            </AdminLayout>
          );
        }}
      </Route>
      <Route path="/admin/traccar-settings">
        {() => {
          if (!isAdmin) return <Redirect to="/delivery" />;
          return (
            <AdminLayout>
              <TraccarSettings />
            </AdminLayout>
          );
        }}
      </Route>
      <Route path="/admin/traccar-stats">
        {() => {
          if (!isAdmin) return <Redirect to="/delivery" />;
          return (
            <AdminLayout>
              <TraccarStats />
            </AdminLayout>
          );
        }}
      </Route>

      <Route path="/admin/monthly-distance-report">
        {() => {
          if (!isAdmin) return <Redirect to="/delivery" />;
          return (
            <AdminLayout>
              <MonthlyDistanceReport />
            </AdminLayout>
          );
        }}
      </Route>
      <Route path="/admin/advanced-tracking">
        {() => {
          if (!isAdmin) return <Redirect to="/delivery" />;
          return (
            <AdminLayout>
              <AdvancedTracking />
            </AdminLayout>
          );
        }}
      </Route>
      <Route path="/admin/traccar-dashboard">
        {() => {
          if (!isAdmin) return <Redirect to="/delivery" />;
          return (
            <AdminLayout>
              <TraccarDashboard />
            </AdminLayout>
          );
        }}
      </Route>
      <Route path="/admin/messages">
        {() => {
          if (!isAdmin) return <Redirect to="/delivery" />;
          return (
            <AdminLayout>
              <Messages />
            </AdminLayout>
          );
        }}
      </Route>
      <Route path="/admin/map">
        {() => {
          if (!isAdmin) return <Redirect to="/delivery" />;
          return (
            <AdminLayout>
              <DeliveryMap />
            </AdminLayout>
          );
        }}
      </Route>
      <Route path="/admin/live-tracking">
        {() => {
          if (!isAdmin) return <Redirect to="/delivery" />;
          return (
            <AdminLayout>
              <LiveTracking />
            </AdminLayout>
          );
        }}
      </Route>
      <Route path="/admin/users">
        {() => {
          if (!isAdmin) return <Redirect to="/delivery" />;
          return (
            <AdminLayout>
              <UserManagement />
            </AdminLayout>
          );
        }}
      </Route>
      <Route path="/admin/history">
        {() => {
          if (!isAdmin) return <Redirect to="/delivery" />;
          return <DeliveryHistory />;
        }}
      </Route>
      <Route path="/admin/delivery-dashboard">
        {() => {
          if (!isAdmin) return <Redirect to="/delivery" />;
          return (
            <AdminLayout>
              <DeliveryDashboardPage />
            </AdminLayout>
          );
        }}
      </Route>
      <Route path="/admin/delivery-speed-analytics">
        {() => {
          if (!isAdmin) return <Redirect to="/delivery" />;
          return (
            <AdminLayout>
              <DeliverySpeedAnalytics />
            </AdminLayout>
          );
        }}
      </Route>
      <Route path="/admin/delivery-person/:id">
        {() => {
          if (!isAdmin) return <Redirect to="/delivery" />;
          return (
            <AdminLayout>
              <DeliveryPersonDetailsPage />
            </AdminLayout>
          );
        }}
      </Route>
      <Route path="/admin/customers">
        {() => {
          if (!isAdmin) return <Redirect to="/delivery" />;
          return (
            <AdminLayout>
              <Customers />
            </AdminLayout>
          );
        }}
      </Route>
      <Route path="/admin/customers/:id">
        {() => {
          if (!isAdmin) return <Redirect to="/delivery" />;
          return (
            <AdminLayout>
              <CustomerDetails />
            </AdminLayout>
          );
        }}
      </Route>
      <Route path="/admin/incomplete-orders">
        {() => {
          if (!isAdmin) return <Redirect to="/delivery" />;
          return (
            <AdminLayout>
              <IncompleteOrders />
            </AdminLayout>
          );
        }}
      </Route>
      <Route path="/admin/monthly-performance">
        {() => {
          if (!isAdmin) return <Redirect to="/delivery" />;
          return (
            <AdminLayout>
              <MonthlyPerformance />
            </AdminLayout>
          );
        }}
      </Route>
      <Route path="/admin/delivery-tracking">
        {() => {
          if (!isAdmin) return <Redirect to="/delivery" />;
          return (
            <AdminLayout>
              <DeliveryTracking />
            </AdminLayout>
          );
        }}
      </Route>
      <Route path="/admin/activity-logs">
        {() => {
          if (!isAdmin) return <Redirect to="/delivery" />;
          return (
            <AdminLayout>
              <ActivityLogs />
            </AdminLayout>
          );
        }}
      </Route>
      <Route path="/admin/employee-stats">
        {() => {
          if (!isAdmin) return <Redirect to="/delivery" />;
          return (
            <AdminLayout>
              <EmployeeStats />
            </AdminLayout>
          );
        }}
      </Route>

      <Route path="/admin/about">
        {() => {
          if (!isAdmin) return <Redirect to="/delivery" />;
          return (
            <AdminLayout>
              <About />
            </AdminLayout>
          );
        }}
      </Route>

      <Route path="/admin/updates">
        {() => {
          if (!isAdmin) return <Redirect to="/delivery" />;
          return (
            <AdminLayout>
              <Updates />
            </AdminLayout>
          );
        }}
      </Route>

      <Route path="/admin/updates-management">
        {() => {
          if (!isSuperAdmin) return <Redirect to="/admin" />;
          return (
            <AdminLayout>
              <UpdatesManagement />
            </AdminLayout>
          );
        }}
      </Route>

      <Route path="/admin/announcements-management">
        {() => {
          if (!isSuperAdmin) return <Redirect to="/admin" />;
          return (
            <AdminLayout>
              <AnnouncementsManagement />
            </AdminLayout>
          );
        }}
      </Route>

      <Route path="/admin/site-settings">
        {() => {
          if (!isSuperAdmin) return <Redirect to="/admin" />;
          return (
            <AdminLayout>
              <SiteSettings />
            </AdminLayout>
          );
        }}
      </Route>
      
      <Route path="/admin/notification-settings">
        {() => {
          if (!isSuperAdmin) return <Redirect to="/admin" />;
          return (
            <AdminLayout>
              <NotificationSettingsPage />
            </AdminLayout>
          );
        }}
      </Route>
      
      <Route path="/admin/test-notifications">
        {() => {
          if (!isSuperAdmin) return <Redirect to="/admin" />;
          return (
            <AdminLayout>
              <TestNotifications />
            </AdminLayout>
          );
        }}
      </Route>

      <Route path="/admin/registered-users">
        {() => {
          if (!isSuperAdmin) return <Redirect to="/admin" />;
          return (
            <AdminLayout>
              <RegisteredUsers />
            </AdminLayout>
          );
        }}
      </Route>

      <Route path="/admin/notification-stats">
        {() => {
          if (!isSuperAdmin) return <Redirect to="/admin" />;
          return (
            <AdminLayout>
              <NotificationStats />
            </AdminLayout>
          );
        }}
      </Route>

      <Route path="/admin/deleted-branches">
        {() => {
          if (!isSuperAdmin) return <Redirect to="/admin" />;
          return (
            <AdminLayout>
              <DeletedBranches />
            </AdminLayout>
          );
        }}
      </Route>




      <Route path="/admin/:rest*">
        {() => {
          if (!isAdmin) return <Redirect to="/delivery" />;
          return (
            <AdminLayout>
              <div className="text-center py-12">
                <h2 className="text-2xl font-bold text-gray-800">قيد التطوير</h2>
                <p className="text-gray-600 mt-2">هذه الصفحة قيد الإنشاء</p>
              </div>
            </AdminLayout>
          );
        }}
      </Route>
      <Route path="/delivery">
        {() => {
          if (!isDelivery) return <Redirect to="/admin" />;
          return <Redirect to="/delivery/dashboard" />;
        }}
      </Route>
      <Route path="/delivery/dashboard">
        {() => {
          if (!isDelivery) return <Redirect to="/admin" />;
          return <DeliveryDashboard />;
        }}
      </Route>
      <Route path="/delivery/notifications">
        {() => {
          if (!isDelivery) return <Redirect to="/admin" />;
          return <DeliveryNotifications />;
        }}
      </Route>
      <Route path="/delivery/notification-settings">
        {() => {
          if (!isDelivery) return <Redirect to="/admin" />;
          return <NotificationSettings />;
        }}
      </Route>
      <Route path="/delivery/profile">
        {() => {
          if (!isDelivery) return <Redirect to="/admin" />;
          return <DeliveryProfile />;
        }}
      </Route>
      <Route path="/delivery/navigation/:orderId">
        {() => {
          if (!isDelivery) return <Redirect to="/admin" />;
          return <DeliveryNavigation />;
        }}
      </Route>
      <Route path="/">
        {() => <Redirect to={isAdmin ? "/admin" : "/delivery"} />}
      </Route>
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="light"
        switchable
      >
        <TooltipProvider>
          <Toaster />
          <Router />
          <InstallPWA />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;

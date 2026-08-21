import { useEffect } from 'react';
import { Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { useApp } from './state/store.jsx';
import { hideSplash } from './lib/splash.js';
import { PhoneChrome } from './components/Chrome.jsx';
import BottomNav from './components/BottomNav.jsx';
import { Toast } from './components/ui.jsx';
import Onboarding from './components/Onboarding.jsx';

import Landing from './screens/Landing.jsx';
import Login from './screens/Login.jsx';
import SignUp from './screens/SignUp.jsx';
import Forgot from './screens/Forgot.jsx';
import NewPassword from './screens/NewPassword.jsx';
import ChangePassword from './screens/ChangePassword.jsx';
import ChangeEmail from './screens/ChangeEmail.jsx';
import DeleteAccount from './screens/DeleteAccount.jsx';
import Join from './screens/Join.jsx';
import CreateCommunity from './screens/CreateCommunity.jsx';

import Dashboard from './screens/Dashboard.jsx';
import Announcements from './screens/Announcements.jsx';
import AnnouncementDetail from './screens/AnnouncementDetail.jsx';
import AnnouncementNew from './screens/AnnouncementNew.jsx';
import Discussions from './screens/Discussions.jsx';
import DiscussionDetail from './screens/DiscussionDetail.jsx';
import DiscussionNew from './screens/DiscussionNew.jsx';
import Issues from './screens/Issues.jsx';
import IssueDetail from './screens/IssueDetail.jsx';
import IssueNew from './screens/IssueNew.jsx';
import Polls from './screens/Polls.jsx';
import PollDetail from './screens/PollDetail.jsx';
import PollNew from './screens/PollNew.jsx';
import Search from './screens/Search.jsx';
import Notifications from './screens/Notifications.jsx';
import Settings from './screens/Settings.jsx';
import Account from './screens/Account.jsx';
import Admin from './screens/Admin.jsx';
import Moderation from './screens/Moderation.jsx';
import Members from './screens/Members.jsx';
import Neighbours from './screens/Neighbours.jsx';
import CommunitySettings from './screens/CommunitySettings.jsx';

function AppLayout() {
  const { authed, authLoading, hasCommunity, membershipResolved, data } = useApp();
  const loc = useLocation();
  if (authLoading) return null;
  if (!authed) return <Navigate to="/" replace state={{ from: loc.pathname }} />;
  if (!membershipResolved) return null; // still checking whether you already belong to a community
  if (!hasCommunity) return <Navigate to="/join" replace />;
  if (!data.community) return null; // still loading the community's data for the first time
  return (
    <>
      <div className="phone__scrollinner" key={loc.pathname.split('/')[2] || 'home'}>
        <Outlet />
      </div>
      <BottomNav />
      <Onboarding />
    </>
  );
}

export default function App() {
  const { recoveryMode, authLoading, authed, membershipResolved, hasCommunity, data } = useApp();
  const loc = useLocation();

  /*
    The waiting screen goes away when a real screen is ready to replace it,
    which is not the same as React having mounted. Outside /app that is as soon
    as the session is known; inside it, AppLayout keeps returning null until the
    membership and the community have arrived too, so we wait for those as well
    rather than uncovering a blank page.
  */
  const inApp = loc.pathname.startsWith('/app');
  const ready = !authLoading
    && (!inApp || !authed || (membershipResolved && (!hasCommunity || !!data.community)));
  useEffect(() => { if (ready) hideSplash(); }, [ready]);

  // A reset-password link signs the person in, which would otherwise drop them
  // straight into the dashboard. While the recovery session is active, the only
  // screen we show is "choose a new password".
  if (recoveryMode) {
    return (
      <PhoneChrome>
        <Toast />
        <NewPassword />
      </PhoneChrome>
    );
  }

  return (
    <PhoneChrome>
      <Toast />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/forgot" element={<Forgot />} />
        <Route path="/new-password" element={<NewPassword />} />
        <Route path="/join" element={<Join />} />
        {/* Shared invite links land here with the code already filled in. */}
        <Route path="/join/:code" element={<Join />} />
        <Route path="/create" element={<CreateCommunity />} />

        <Route path="/app" element={<AppLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="announcements" element={<Announcements />} />
          <Route path="announcements/new" element={<AnnouncementNew />} />
          <Route path="announcements/:id" element={<AnnouncementDetail />} />
          <Route path="discussions" element={<Discussions />} />
          <Route path="discussions/new" element={<DiscussionNew />} />
          <Route path="discussions/:id" element={<DiscussionDetail />} />
          <Route path="issues" element={<Issues />} />
          <Route path="issues/new" element={<IssueNew />} />
          <Route path="issues/:id" element={<IssueDetail />} />
          <Route path="polls" element={<Polls />} />
          <Route path="polls/new" element={<PollNew />} />
          <Route path="polls/:id" element={<PollDetail />} />
          <Route path="neighbours" element={<Neighbours />} />
          <Route path="search" element={<Search />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="settings" element={<Settings />} />
          <Route path="settings/account" element={<Account />} />
          <Route path="settings/password" element={<ChangePassword />} />
          <Route path="settings/email" element={<ChangeEmail />} />
          <Route path="settings/delete" element={<DeleteAccount />} />
          <Route path="admin" element={<Admin />} />
          <Route path="admin/moderation" element={<Moderation />} />
          <Route path="admin/members" element={<Members />} />
          <Route path="admin/settings" element={<CommunitySettings />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </PhoneChrome>
  );
}

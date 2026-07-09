import { Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { useApp } from './state/store.jsx';
import { PhoneChrome } from './components/Chrome.jsx';
import BottomNav from './components/BottomNav.jsx';
import { Toast } from './components/ui.jsx';

import Landing from './screens/Landing.jsx';
import Login from './screens/Login.jsx';
import SignUp from './screens/SignUp.jsx';
import Forgot from './screens/Forgot.jsx';
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
import Admin from './screens/Admin.jsx';
import Moderation from './screens/Moderation.jsx';
import Members from './screens/Members.jsx';
import CommunitySettings from './screens/CommunitySettings.jsx';

function AppLayout() {
  const { authed } = useApp();
  const loc = useLocation();
  if (!authed) return <Navigate to="/" replace state={{ from: loc.pathname }} />;
  return (
    <>
      <div className="phone__scrollinner" key={loc.pathname.split('/')[2] || 'home'}>
        <Outlet />
      </div>
      <BottomNav />
    </>
  );
}

export default function App() {
  return (
    <PhoneChrome>
      <Toast />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/forgot" element={<Forgot />} />
        <Route path="/join" element={<Join />} />
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
          <Route path="search" element={<Search />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="settings" element={<Settings />} />
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

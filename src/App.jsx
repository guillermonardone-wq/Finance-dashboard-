import { BrowserRouter, Routes, Route } from "react-router-dom";
import RootErrorBoundary from "./components/RootErrorBoundary";
import AppShell from "./components/layout/AppShell";
import Dashboard from "./pages/Dashboard";
import SignalInbox from "./pages/SignalInbox";
import ThesisList from "./pages/ThesisList";
import ThesisBuilder from "./pages/ThesisBuilder";
import ThesisDetail from "./pages/ThesisDetail";
import MarketData from "./pages/MarketData";
import Reviews from "./pages/Reviews";
import Quarantine from "./pages/Quarantine";
import ProviderHealth from "./pages/ProviderHealth";
import BotFeed from "./pages/BotFeed";

export default function App() {
  return (
    <RootErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/" element={<SignalInbox />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/bot" element={<BotFeed />} />
            <Route path="/theses" element={<ThesisList />} />
            <Route path="/thesis/new" element={<ThesisBuilder />} />
            <Route path="/thesis/:id" element={<ThesisDetail />} />
            <Route path="/market" element={<MarketData />} />
            <Route path="/reviews" element={<Reviews />} />
            <Route path="/quarantine" element={<Quarantine />} />
            <Route path="/providers" element={<ProviderHealth />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </RootErrorBoundary>
  );
}

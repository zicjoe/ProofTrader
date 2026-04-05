import { createBrowserRouter } from "react-router-dom";
import { LandingPage } from "./pages/landing-page";
import { DashboardLayout } from "./components/dashboard-layout";
import { MainDashboard } from "./pages/main-dashboard";
import { TradesPage } from "./pages/trades-page";
import { PositionsPage } from "./pages/positions-page";
import { StrategyPage } from "./pages/strategy-page";
import { RiskControlsPage } from "./pages/risk-controls-page";
import { ValidationProofsPage } from "./pages/validation-proofs-page";
import { ActivityLogsPage } from "./pages/activity-logs-page";
import { SettingsPage } from "./pages/settings-page";
import { ProfilePage } from "./pages/profile-page";
import { ApiKeysPage } from "./pages/api-keys-page";
import { PreferencesPage } from "./pages/preferences-page";

export const router = createBrowserRouter([
  { path: "/", Component: LandingPage },
  {
    path: "/app",
    Component: DashboardLayout,
    children: [
      { index: true, Component: MainDashboard },
      { path: "trades", Component: TradesPage },
      { path: "positions", Component: PositionsPage },
      { path: "strategy", Component: StrategyPage },
      { path: "risk-controls", Component: RiskControlsPage },
      { path: "validation-proofs", Component: ValidationProofsPage },
      { path: "activity", Component: ActivityLogsPage },
      { path: "settings", Component: SettingsPage },
      { path: "profile", Component: ProfilePage },
      { path: "api-keys", Component: ApiKeysPage },
      { path: "preferences", Component: PreferencesPage }
    ]
  }
]);

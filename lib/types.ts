export interface Business {
  id: string;
  name: string;
  phone: string;
  address: string;
  website: string;
  category: string;
  email: string;
  ownerName: string;
  ceoPhone: string;
  about: string;
  enrichmentStatus: "idle" | "running" | "done" | "error";
  callStatus:
    | "idle"
    | "calling"
    | "interested"
    | "not_interested"
    | "unreachable"
    | "error";
  callSid: string;
  transcript: { role: "ai" | "human"; text: string }[];
  source?: "Google" | "Exa";
}

export interface LogEntry {
  timestamp: number;
  message: string;
  type: "info" | "success" | "error";
}

export interface DashboardState {
  businesses: Business[];
  searchQuery: string;
  searchStatus: "idle" | "loading" | "done" | "error";
  searchError: string;
  activityLog: LogEntry[];
  browserViewUrl: string;
  browserViewVisible: boolean;
  autoCallingIndex: number | null;
}

export type DashboardAction =
  | { type: "SET_SEARCH_LOADING"; query: string }
  | { type: "SET_SEARCH_RESULTS"; businesses: Business[] }
  | { type: "SET_SEARCH_ERROR"; error: string }
  | { type: "DELETE_BUSINESS"; id: string }
  | { type: "UPDATE_BUSINESS"; id: string; updates: Partial<Business> }
  | { type: "ADD_LOG"; entry: LogEntry }
  | { type: "SET_BROWSER_VIEW"; url: string; visible: boolean }
  | { type: "SET_AUTO_CALLING"; index: number | null };

export function dashboardReducer(
  state: DashboardState,
  action: DashboardAction
): DashboardState {
  switch (action.type) {
    case "SET_SEARCH_LOADING":
      return {
        ...state,
        searchQuery: action.query,
        searchStatus: "loading",
        searchError: "",
      };
    case "SET_SEARCH_RESULTS":
      return {
        ...state,
        businesses: action.businesses,
        searchStatus: "done",
      };
    case "SET_SEARCH_ERROR":
      return {
        ...state,
        searchStatus: "error",
        searchError: action.error,
      };
    case "DELETE_BUSINESS":
      return {
        ...state,
        businesses: state.businesses.filter((b) => b.id !== action.id),
      };
    case "UPDATE_BUSINESS":
      return {
        ...state,
        businesses: state.businesses.map((b) =>
          b.id === action.id ? { ...b, ...action.updates } : b
        ),
      };
    case "ADD_LOG":
      return {
        ...state,
        activityLog: [...state.activityLog, action.entry],
      };
    case "SET_BROWSER_VIEW":
      return {
        ...state,
        browserViewUrl: action.url,
        browserViewVisible: action.visible,
      };
    case "SET_AUTO_CALLING":
      return {
        ...state,
        autoCallingIndex: action.index,
      };
    default:
      return state;
  }
}

export const initialDashboardState: DashboardState = {
  businesses: [],
  searchQuery: "",
  searchStatus: "idle",
  searchError: "",
  activityLog: [],
  browserViewUrl: "",
  browserViewVisible: false,
  autoCallingIndex: null,
};

import {
	createContext,
	type ReactNode,
	useContext,
	useCallback,
	useState,
	useRef,
	useEffect,
} from "react";
import { useDebouncedCallback } from "../hooks/useDebounce";

export interface SessionState {
	mapId: string | null;
	mapView: {
		center: [number, number];
		zoom: number;
	} | null;
	panelStates: {
		showLayerManager: boolean;
		showMapSelector: boolean;
		showComments: boolean;
		showLayerCreator: boolean;
		showAdminPanel: boolean;
	};
	basemap: string;
	timeRange: {
		start: Date;
		end: Date;
	};
}

interface SessionContextType {
	sessionState: SessionState;
	updateSession: (updates: Partial<SessionState>) => void;
	clearSession: () => void;
}

interface StoredSessionState {
	version: number;
	mapId: string | null;
	mapView: {
		center: [number, number];
		zoom: number;
	} | null;
	panelStates: {
		showLayerManager: boolean;
		showMapSelector: boolean;
		showComments: boolean;
		showLayerCreator: boolean;
		showAdminPanel: boolean;
	};
	basemap: string;
	timeRange: {
		start: string; // ISO string
		end: string; // ISO string
	};
	timestamp: number;
}

const STORAGE_KEY = "samsyn-session-state";
const STORAGE_VERSION = 1;

const DEFAULT_SESSION_STATE: SessionState = {
	mapId: null,
	mapView: null,
	panelStates: {
		showLayerManager: true,
		showMapSelector: false,
		showComments: false,
		showLayerCreator: false,
		showAdminPanel: false,
	},
	basemap: "osm",
	timeRange: {
		start: new Date("2024-10-01"),
		end: new Date("2025-03-31"),
	},
};

const SessionContext = createContext<SessionContextType | null>(null);

/**
 * Check if localStorage is available and functional
 */
function isLocalStorageAvailable(): boolean {
	try {
		const test = "__localStorage_test__";
		localStorage.setItem(test, test);
		localStorage.removeItem(test);
		return true;
	} catch {
		return false;
	}
}

/**
 * Validate the structure of stored session state
 */
function isValidSessionState(state: unknown): state is StoredSessionState {
	if (!state || typeof state !== "object") return false;

	const s = state as Partial<StoredSessionState>;

	return (
		typeof s.version === "number" &&
		(s.mapId === null || typeof s.mapId === "string") &&
		(s.mapView === null ||
			(typeof s.mapView === "object" &&
				Array.isArray(s.mapView.center) &&
				s.mapView.center.length === 2 &&
				typeof s.mapView.center[0] === "number" &&
				typeof s.mapView.center[1] === "number" &&
				typeof s.mapView.zoom === "number")) &&
		typeof s.panelStates === "object" &&
		s.panelStates !== null &&
		typeof s.panelStates.showLayerManager === "boolean" &&
		typeof s.panelStates.showMapSelector === "boolean" &&
		typeof s.panelStates.showComments === "boolean" &&
		typeof s.panelStates.showLayerCreator === "boolean" &&
		typeof s.panelStates.showAdminPanel === "boolean" &&
		typeof s.basemap === "string" &&
		typeof s.timeRange === "object" &&
		s.timeRange !== null &&
		typeof s.timeRange.start === "string" &&
		typeof s.timeRange.end === "string"
	);
}

/**
 * Load initial session state from localStorage
 */
function getInitialSessionState(): SessionState {
	if (!isLocalStorageAvailable()) {
		console.warn("localStorage unavailable, session persistence disabled");
		return DEFAULT_SESSION_STATE;
	}

	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (!stored) {
			return DEFAULT_SESSION_STATE;
		}

		const parsed = JSON.parse(stored);

		// Version check for future migrations
		if (parsed.version !== STORAGE_VERSION) {
			console.warn(
				`Session state version mismatch (expected ${STORAGE_VERSION}, got ${parsed.version}), using defaults`,
			);
			return DEFAULT_SESSION_STATE;
		}

		// Validate data structure
		if (!isValidSessionState(parsed)) {
			console.warn("Invalid session state structure, using defaults");
			localStorage.removeItem(STORAGE_KEY);
			return DEFAULT_SESSION_STATE;
		}

		// Parse ISO date strings back to Date objects
		return {
			mapId: parsed.mapId,
			mapView: parsed.mapView,
			panelStates: parsed.panelStates,
			basemap: parsed.basemap,
			timeRange: {
				start: new Date(parsed.timeRange.start),
				end: new Date(parsed.timeRange.end),
			},
		};
	} catch (error) {
		console.error("Failed to load session state:", error);
		// Clear corrupted data
		try {
			localStorage.removeItem(STORAGE_KEY);
		} catch {
			// Silent fail if we can't even remove it
		}
		return DEFAULT_SESSION_STATE;
	}
}

export function SessionProvider({ children }: { children: ReactNode }) {
	const [sessionState, setSessionState] = useState<SessionState>(
		getInitialSessionState,
	);
	const localStorageAvailable = useRef(isLocalStorageAvailable());

	/**
	 * Debounced save function - waits 2.5 seconds after last change
	 */
	const debouncedSave = useDebouncedCallback((state: SessionState) => {
		if (!localStorageAvailable.current) return;

		try {
			const toSave: StoredSessionState = {
				version: STORAGE_VERSION,
				mapId: state.mapId,
				mapView: state.mapView,
				panelStates: state.panelStates,
				basemap: state.basemap,
				timeRange: {
					start: state.timeRange.start.toISOString(),
					end: state.timeRange.end.toISOString(),
				},
				timestamp: Date.now(),
			};

			localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
		} catch (error) {
			// Check for quota exceeded error
			if (
				error instanceof Error &&
				(error.name === "QuotaExceededError" ||
					error.name === "NS_ERROR_DOM_QUOTA_REACHED")
			) {
				console.error("localStorage quota exceeded, clearing session storage");
				try {
					localStorage.removeItem(STORAGE_KEY);
				} catch {
					// Silent fail
				}
			} else {
				console.error("Failed to save session state:", error);
			}
			// Silent fail - don't disrupt user experience
		}
	}, 2500);

	/**
	 * Update session state with partial updates
	 */
	const updateSession = useCallback(
		(updates: Partial<SessionState>) => {
			setSessionState((prev) => {
				const next = { ...prev, ...updates };
				debouncedSave(next);
				return next;
			});
		},
		[debouncedSave],
	);

	/**
	 * Clear session state and localStorage
	 */
	const clearSession = useCallback(() => {
		setSessionState(DEFAULT_SESSION_STATE);
		if (localStorageAvailable.current) {
			try {
				localStorage.removeItem(STORAGE_KEY);
			} catch (error) {
				console.error("Failed to clear session state:", error);
			}
		}
	}, []);

	// Cleanup on unmount - flush any pending debounced saves
	useEffect(() => {
		return () => {
			// The debounce hook will handle cleanup
		};
	}, []);

	return (
		<SessionContext.Provider
			value={{ sessionState, updateSession, clearSession }}
		>
			{children}
		</SessionContext.Provider>
	);
}

export function useSession() {
	const context = useContext(SessionContext);
	if (!context) {
		throw new Error("useSession must be used within a SessionProvider");
	}
	return context;
}

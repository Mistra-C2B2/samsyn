import {
	createContext,
	type ReactNode,
	useContext,
	useEffect,
	useState,
} from "react";

export type TextSize = "small" | "medium" | "large" | "extra-large";

interface SettingsContextType {
	textSize: TextSize;
	setTextSize: (size: TextSize) => void;
	showCoordinates: boolean;
	setShowCoordinates: (show: boolean) => void;
}

const TEXT_SIZE_MAP: Record<TextSize, string> = {
	small: "14px",
	medium: "16px",
	large: "18px",
	"extra-large": "20px",
};

const TEXT_SIZE_STORAGE_KEY = "samsyn-text-size";
const SHOW_COORDINATES_STORAGE_KEY = "samsyn-show-coordinates";

const SettingsContext = createContext<SettingsContextType | null>(null);

function getInitialTextSize(): TextSize {
	const stored = localStorage.getItem(TEXT_SIZE_STORAGE_KEY);
	if (stored && stored in TEXT_SIZE_MAP) {
		return stored as TextSize;
	}
	return "medium";
}

function getInitialShowCoordinates(): boolean {
	const stored = localStorage.getItem(SHOW_COORDINATES_STORAGE_KEY);
	if (stored !== null) {
		return stored === "true";
	}
	return true; // Default to showing coordinates
}

function applyTextSize(size: TextSize) {
	document.documentElement.style.setProperty(
		"--font-size",
		TEXT_SIZE_MAP[size],
	);
}

export function SettingsProvider({ children }: { children: ReactNode }) {
	const [textSize, setTextSizeState] = useState<TextSize>(getInitialTextSize);
	const [showCoordinates, setShowCoordinatesState] = useState<boolean>(
		getInitialShowCoordinates,
	);

	useEffect(() => {
		applyTextSize(textSize);
	}, [textSize]);

	const setTextSize = (size: TextSize) => {
		setTextSizeState(size);
		localStorage.setItem(TEXT_SIZE_STORAGE_KEY, size);
		applyTextSize(size);
	};

	const setShowCoordinates = (show: boolean) => {
		setShowCoordinatesState(show);
		localStorage.setItem(SHOW_COORDINATES_STORAGE_KEY, String(show));
	};

	return (
		<SettingsContext.Provider
			value={{ textSize, setTextSize, showCoordinates, setShowCoordinates }}
		>
			{children}
		</SettingsContext.Provider>
	);
}

export function useSettings() {
	const context = useContext(SettingsContext);
	if (!context) {
		throw new Error("useSettings must be used within a SettingsProvider");
	}
	return context;
}

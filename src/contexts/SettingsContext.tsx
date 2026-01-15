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
}

const TEXT_SIZE_MAP: Record<TextSize, string> = {
	small: "14px",
	medium: "16px",
	large: "18px",
	"extra-large": "20px",
};

const STORAGE_KEY = "samsyn-text-size";

const SettingsContext = createContext<SettingsContextType | null>(null);

function getInitialTextSize(): TextSize {
	const stored = localStorage.getItem(STORAGE_KEY);
	if (stored && stored in TEXT_SIZE_MAP) {
		return stored as TextSize;
	}
	return "medium";
}

function applyTextSize(size: TextSize) {
	document.documentElement.style.setProperty(
		"--font-size",
		TEXT_SIZE_MAP[size],
	);
}

export function SettingsProvider({ children }: { children: ReactNode }) {
	const [textSize, setTextSizeState] = useState<TextSize>(getInitialTextSize);

	useEffect(() => {
		applyTextSize(textSize);
	}, [textSize]);

	const setTextSize = (size: TextSize) => {
		setTextSizeState(size);
		localStorage.setItem(STORAGE_KEY, size);
		applyTextSize(size);
	};

	return (
		<SettingsContext.Provider value={{ textSize, setTextSize }}>
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

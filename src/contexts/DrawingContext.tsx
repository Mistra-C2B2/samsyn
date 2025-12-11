import { createContext, type ReactNode, useContext } from "react";
import type { GeometryType } from "../hooks/useLayerEditor";

interface DrawingContextValue {
	drawingMode: GeometryType | "select" | "delete" | "delete-selection" | null;
	onStartDrawing?: (
		type: GeometryType,
		callback: (feature: unknown) => void,
		color?: string,
	) => void;
	onSetDrawMode?: (mode: "select" | "delete" | "delete-selection") => void;
	onAddFeaturesToMap?: (
		features: Array<{ id: string; type: GeometryType; coordinates: unknown }>,
		color?: string,
	) => string[];
}

const DrawingContext = createContext<DrawingContextValue | null>(null);

export function DrawingProvider({
	children,
	value,
}: {
	children: ReactNode;
	value: DrawingContextValue;
}) {
	return (
		<DrawingContext.Provider value={value}>{children}</DrawingContext.Provider>
	);
}

export function useDrawing() {
	const context = useContext(DrawingContext);
	if (!context) {
		throw new Error("useDrawing must be used within a DrawingProvider");
	}
	return context;
}

// Optional hook that returns null instead of throwing if not in provider
export function useDrawingOptional() {
	return useContext(DrawingContext);
}

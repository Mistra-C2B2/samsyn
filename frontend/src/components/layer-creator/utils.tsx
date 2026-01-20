import { MapPin, Milestone, Square } from "lucide-react";
import type { Feature, GeometryType } from "../../hooks/useLayerEditor";

// ============================================================================
// Helper Components
// ============================================================================

export function GeometryIcon({ type }: { type: GeometryType }) {
	switch (type) {
		case "Point":
			return <MapPin className="w-4 h-4" />;
		case "LineString":
			return <Milestone className="w-4 h-4" />;
		case "Polygon":
			return <Square className="w-4 h-4" />;
	}
}

// ============================================================================
// Helper Functions
// ============================================================================

export function getCoordinatesSummary(feature: Feature): string {
	const coords = feature.coordinates as number[] | number[][] | number[][][];
	if (!coords) return "";

	if (feature.type === "Point") {
		const [lng, lat] = coords as number[];
		if (typeof lng === "number" && typeof lat === "number") {
			return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
		}
		return "";
	}
	if (feature.type === "LineString") {
		return `${(coords as number[][]).length} points`;
	}
	if (feature.type === "Polygon") {
		const rings = coords as number[][][];
		return `${rings[0]?.length ? rings[0].length - 1 : 0} vertices`;
	}
	return "";
}

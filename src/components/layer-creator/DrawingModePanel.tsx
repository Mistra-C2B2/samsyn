import {
	Code,
	Loader2,
	MapPin,
	Milestone,
	MousePointer2,
	Square,
	Trash2,
} from "lucide-react";
import { memo } from "react";
import { useDrawing } from "../../contexts/DrawingContext";
import type { GeometryType } from "../../hooks/useLayerEditor";
import { Button } from "../ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Textarea } from "../ui/textarea";

// ============================================================================
// Types
// ============================================================================

interface DrawingModePanelProps {
	onStartDrawing: (type: GeometryType) => void;
	geoJsonInput: string;
	setGeoJsonInput: (value: string) => void;
	geoJsonError: string;
	geoJsonImporting: boolean;
	onGeoJsonImport: () => void;
}

interface DrawModeButtonProps {
	isActive: boolean;
	onClick: () => void;
	icon: React.ReactNode;
	label: string;
}

// ============================================================================
// Draw Mode Button Component
// ============================================================================

const DrawModeButton = memo(function DrawModeButton({
	isActive,
	onClick,
	icon,
	label,
}: DrawModeButtonProps) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={`p-3 rounded-lg border-2 transition-all flex flex-col items-center gap-2 ${
				isActive
					? "border-teal-600 bg-teal-50 text-teal-700"
					: "border-slate-200 hover:border-teal-400"
			}`}
		>
			{icon}
			<span className="text-xs">{label}</span>
		</button>
	);
});

// ============================================================================
// Main Component
// ============================================================================

export function DrawingModePanel({
	onStartDrawing,
	geoJsonInput,
	setGeoJsonInput,
	geoJsonError,
	geoJsonImporting,
	onGeoJsonImport,
}: DrawingModePanelProps) {
	const { drawingMode, onSetDrawMode } = useDrawing();

	return (
		<Tabs defaultValue="draw" className="w-full">
			<TabsList className="grid w-full grid-cols-2">
				<TabsTrigger value="draw">Draw on Map</TabsTrigger>
				<TabsTrigger value="geojson">
					<Code className="w-4 h-4 mr-2" />
					GeoJSON
				</TabsTrigger>
			</TabsList>

			<TabsContent value="draw" className="space-y-3 mt-3">
				{/* Drawing mode buttons */}
				<div className="grid grid-cols-3 gap-2">
					<DrawModeButton
						isActive={drawingMode === "Point"}
						onClick={() => onStartDrawing("Point")}
						icon={<MapPin className="w-5 h-5" />}
						label="Add Point"
					/>
					<DrawModeButton
						isActive={drawingMode === "LineString"}
						onClick={() => onStartDrawing("LineString")}
						icon={<Milestone className="w-5 h-5" />}
						label="Add Line"
					/>
					<DrawModeButton
						isActive={drawingMode === "Polygon"}
						onClick={() => onStartDrawing("Polygon")}
						icon={<Square className="w-5 h-5" />}
						label="Add Polygon"
					/>
				</div>

				{/* Select/Delete mode buttons */}
				<div className="grid grid-cols-2 gap-2">
					<button
						type="button"
						onClick={() => onSetDrawMode?.("select")}
						className={`p-3 rounded-lg border-2 transition-all flex flex-col items-center gap-2 ${
							drawingMode === "select"
								? "border-teal-600 bg-teal-50 text-teal-700"
								: "border-slate-200 hover:border-teal-400"
						}`}
					>
						<MousePointer2 className="w-5 h-5" />
						<span className="text-xs">Select</span>
					</button>
					<button
						type="button"
						onClick={() => onSetDrawMode?.("delete")}
						className={`p-3 rounded-lg border-2 transition-all flex flex-col items-center gap-2 ${
							drawingMode === "delete"
								? "border-red-600 bg-red-50 text-red-700"
								: "border-slate-200 hover:border-red-400"
						}`}
					>
						<Trash2 className="w-5 h-5" />
						<span className="text-xs">Delete</span>
					</button>
				</div>
			</TabsContent>

			<TabsContent value="geojson" className="space-y-3 mt-3">
				<div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-slate-700">
					<p>
						Paste a GeoJSON FeatureCollection. Each feature will be imported as
						a separate item that you can name and customize.
					</p>
				</div>
				<Textarea
					placeholder={`{\n  "type": "FeatureCollection",\n  "features": [\n    {\n      "type": "Feature",\n      "properties": {\n        "name": "Feature Name"\n      },\n      "geometry": {...}\n    }\n  ]\n}`}
					value={geoJsonInput}
					onChange={(e) => setGeoJsonInput(e.target.value)}
					rows={8}
					className="font-mono text-xs"
				/>
				{geoJsonError && (
					<div className="p-2 bg-red-50 border border-red-200 rounded text-sm text-red-600">
						{geoJsonError}
					</div>
				)}
				<Button
					onClick={onGeoJsonImport}
					variant="outline"
					className="w-full"
					disabled={!geoJsonInput.trim() || geoJsonImporting}
				>
					{geoJsonImporting ? (
						<>
							<Loader2 className="w-4 h-4 mr-2 animate-spin" />
							Importing...
						</>
					) : (
						<>
							<Code className="w-4 h-4 mr-2" />
							Import GeoJSON
						</>
					)}
				</Button>
			</TabsContent>
		</Tabs>
	);
}

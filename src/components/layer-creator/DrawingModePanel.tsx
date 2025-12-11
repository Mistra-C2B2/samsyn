import {
	Circle,
	MapPin,
	Milestone,
	MousePointer2,
	Pencil,
	RectangleHorizontal,
	Square,
	Trash,
	Trash2,
} from "lucide-react";
import { memo } from "react";
import { useDrawing } from "../../contexts/DrawingContext";
import type { GeometryType } from "../../hooks/useLayerEditor";

// ============================================================================
// Types
// ============================================================================

interface DrawingModePanelProps {
	onStartDrawing: (type: GeometryType) => void;
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
}: DrawingModePanelProps) {
	const { drawingMode, onSetDrawMode } = useDrawing();

	return (
		<div className="space-y-4 border-t border-slate-200 pt-4">
			<label className="text-sm font-medium">Drawing Tools</label>

			{/* Basic drawing mode buttons */}
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

			{/* Additional shape buttons */}
			<div className="grid grid-cols-3 gap-2">
				<DrawModeButton
					isActive={drawingMode === "Rectangle"}
					onClick={() => onStartDrawing("Rectangle")}
					icon={<RectangleHorizontal className="w-5 h-5" />}
					label="Rectangle"
				/>
				<DrawModeButton
					isActive={drawingMode === "Circle"}
					onClick={() => onStartDrawing("Circle")}
					icon={<Circle className="w-5 h-5" />}
					label="Circle"
				/>
				<DrawModeButton
					isActive={drawingMode === "Freehand"}
					onClick={() => onStartDrawing("Freehand")}
					icon={<Pencil className="w-5 h-5" />}
					label="Freehand"
				/>
			</div>

			{/* Select/Delete mode buttons */}
			<div className="grid grid-cols-3 gap-2">
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
				<button
					type="button"
					onClick={() => onSetDrawMode?.("delete-selection")}
					className="p-3 rounded-lg border-2 transition-all flex flex-col items-center gap-2 border-slate-200 hover:border-red-400 hover:bg-red-50 hover:text-red-700 active:bg-red-100"
					title="Delete selected features"
				>
					<Trash className="w-5 h-5" />
					<span className="text-xs text-center">Delete Selected</span>
				</button>
			</div>
		</div>
	);
}

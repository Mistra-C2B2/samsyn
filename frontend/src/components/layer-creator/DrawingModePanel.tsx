import {
	Circle,
	CircleDot,
	MapPin,
	Milestone,
	MousePointer2,
	Pencil,
	RectangleHorizontal,
	Square,
	Trash,
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
			className={`p-2 rounded-md border transition-all flex items-center justify-center gap-2 ${
				isActive
					? "border-teal-600 bg-teal-50 text-teal-700"
					: "border-slate-200 hover:border-teal-400 hover:bg-slate-50"
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

export function DrawingModePanel({ onStartDrawing }: DrawingModePanelProps) {
	const { drawingMode, onSetDrawMode } = useDrawing();

	return (
		<div className="space-y-3 border-t border-slate-200 pt-4">
			<div className="text-sm font-medium">Drawing Tools</div>

			{/* Points & Lines */}
			<div className="grid grid-cols-2 gap-2">
				<DrawModeButton
					isActive={drawingMode === "Point"}
					onClick={() => onStartDrawing("Point")}
					icon={<CircleDot className="w-4 h-4" />}
					label="Point"
				/>
				<DrawModeButton
					isActive={drawingMode === "Marker"}
					onClick={() => onStartDrawing("Marker")}
					icon={<MapPin className="w-4 h-4" />}
					label="Marker"
				/>
				<DrawModeButton
					isActive={drawingMode === "LineString"}
					onClick={() => onStartDrawing("LineString")}
					icon={<Milestone className="w-4 h-4" />}
					label="Line"
				/>
				<DrawModeButton
					isActive={drawingMode === "Freehand"}
					onClick={() => onStartDrawing("Freehand")}
					icon={<Pencil className="w-4 h-4" />}
					label="Freehand"
				/>
			</div>

			{/* Shapes */}
			<div className="grid grid-cols-3 gap-2">
				<DrawModeButton
					isActive={drawingMode === "Polygon"}
					onClick={() => onStartDrawing("Polygon")}
					icon={<Square className="w-4 h-4" />}
					label="Polygon"
				/>
				<DrawModeButton
					isActive={drawingMode === "Rectangle"}
					onClick={() => onStartDrawing("Rectangle")}
					icon={<RectangleHorizontal className="w-4 h-4" />}
					label="Rectangle"
				/>
				<DrawModeButton
					isActive={drawingMode === "Circle"}
					onClick={() => onStartDrawing("Circle")}
					icon={<Circle className="w-4 h-4" />}
					label="Circle"
				/>
			</div>

			{/* Select & Delete */}
			<div className="grid grid-cols-2 gap-2">
				<button
					type="button"
					onClick={() => onSetDrawMode?.("select")}
					className={`p-2 rounded-md border transition-all flex items-center justify-center gap-2 ${
						drawingMode === "select"
							? "border-teal-600 bg-teal-50 text-teal-700"
							: "border-slate-200 hover:border-teal-400 hover:bg-slate-50"
					}`}
				>
					<MousePointer2 className="w-4 h-4" />
					<span className="text-xs">Select</span>
				</button>
				<button
					type="button"
					onClick={() => onSetDrawMode?.("delete-selection")}
					className="p-2 rounded-md border transition-all flex items-center justify-center gap-2 border-slate-200 hover:border-red-400 hover:bg-red-50 hover:text-red-600"
				>
					<Trash className="w-4 h-4" />
					<span className="text-xs">Delete</span>
				</button>
			</div>
		</div>
	);
}

import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Slider } from "../ui/slider";

// ============================================================================
// Types
// ============================================================================

interface StyleSettingsPanelProps {
	layerColor: string;
	setLayerColor: (value: string) => void;
	lineWidth: number;
	setLineWidth: (value: number) => void;
	fillPolygons: boolean;
	setFillPolygons: (value: boolean) => void;
}

// ============================================================================
// Component
// ============================================================================

export function StyleSettingsPanel({
	layerColor,
	setLayerColor,
	lineWidth,
	setLineWidth,
	fillPolygons,
	setFillPolygons,
}: StyleSettingsPanelProps) {

	return (
		<div className="space-y-4 border-t border-slate-200 pt-4">
			<Label className="text-sm font-medium">Style Settings</Label>

			{/* Color Picker */}
			<div className="space-y-2">
				<Label className="text-xs text-slate-600">Layer Color</Label>
				<div className="flex items-center gap-2">
					<Input
						id="layer-color"
						type="color"
						value={layerColor}
						onChange={(e) => setLayerColor(e.target.value)}
						className="w-20 h-10 cursor-pointer"
					/>
					<Input
						type="text"
						value={layerColor}
						onChange={(e) => setLayerColor(e.target.value)}
						placeholder="#3b82f6"
						className="flex-1"
					/>
				</div>
			</div>

			{/* Line Width */}
			<div className="space-y-2">
				<Label className="text-xs text-slate-600">
					Line Width: {lineWidth}px
				</Label>
				<Slider
					value={[lineWidth]}
					onValueChange={(value) => setLineWidth(value[0])}
					min={1}
					max={10}
					step={1}
					className="w-full"
				/>
			</div>

			{/* Polygon Fill */}
			<div className="space-y-2">
				<Label className="text-xs text-slate-600">Polygon Fill</Label>
				<div className="grid grid-cols-2 gap-2">
					<button
						type="button"
						onClick={() => setFillPolygons(true)}
						className={`p-2 rounded border text-xs transition-colors ${
							fillPolygons
								? "border-teal-600 bg-teal-50"
								: "border-slate-200 hover:border-teal-400"
						}`}
					>
						Filled
					</button>
					<button
						type="button"
						onClick={() => setFillPolygons(false)}
						className={`p-2 rounded border text-xs transition-colors ${
							!fillPolygons
								? "border-teal-600 bg-teal-50"
								: "border-slate-200 hover:border-teal-400"
						}`}
					>
						Unfilled
					</button>
				</div>
			</div>

		</div>
	);
}

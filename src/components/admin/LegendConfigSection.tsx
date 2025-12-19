import { Plus, Trash2 } from "lucide-react";
import type { LegendItem } from "../../hooks/admin-layer-form";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "../ui/select";

// ============================================================================
// Types
// ============================================================================

interface LegendConfigSectionProps {
	legendType: "gradient" | "categorical";
	legendItems: LegendItem[];
	legendSource: "manual" | "wms";
	wmsLegendUrl: string | null;
	legendImageError: boolean;
	showWmsOption: boolean;
	onLegendTypeChange: (type: "gradient" | "categorical") => void;
	onLegendSourceChange: (source: "manual" | "wms") => void;
	onLegendImageError: () => void;
	onAddItem: () => void;
	onUpdateItem: (
		index: number,
		field: "label" | "color",
		value: string,
	) => void;
	onRemoveItem: (index: number) => void;
}

// ============================================================================
// Component
// ============================================================================

export function LegendConfigSection({
	legendType,
	legendItems,
	legendSource,
	wmsLegendUrl,
	legendImageError,
	showWmsOption,
	onLegendTypeChange,
	onLegendSourceChange,
	onLegendImageError,
	onAddItem,
	onUpdateItem,
	onRemoveItem,
}: LegendConfigSectionProps) {
	return (
		<div className="border-t border-slate-200 pt-4">
			<h3 className="text-sm text-slate-700 mb-3">Legend</h3>

			<div className="space-y-4">
				{/* Legend source toggle for WMS layers */}
				{showWmsOption && wmsLegendUrl && (
					<div className="space-y-2">
						<Label>Legend Source</Label>
						<div className="flex gap-4">
							<label className="flex items-center gap-2 text-sm cursor-pointer">
								<input
									type="radio"
									name="legendSource"
									checked={legendSource === "wms"}
									onChange={() => onLegendSourceChange("wms")}
									className="text-teal-600"
								/>
								Fetch from WMS
							</label>
							<label className="flex items-center gap-2 text-sm cursor-pointer">
								<input
									type="radio"
									name="legendSource"
									checked={legendSource === "manual"}
									onChange={() => onLegendSourceChange("manual")}
									className="text-teal-600"
								/>
								Define manually
							</label>
						</div>
					</div>
				)}

				{/* WMS Legend Preview */}
				{showWmsOption && legendSource === "wms" && wmsLegendUrl && (
					<div className="space-y-2">
						<Label>Legend Preview</Label>
						<div className="border border-slate-200 rounded-lg p-3 bg-slate-50">
							{legendImageError ? (
								<div className="text-sm text-amber-600">
									Could not load legend from WMS server. Try "Define manually"
									instead.
								</div>
							) : (
								<img
									src={wmsLegendUrl}
									alt="WMS Legend"
									className="max-w-full"
									onError={onLegendImageError}
								/>
							)}
						</div>
					</div>
				)}

				{/* Manual legend configuration */}
				{(!showWmsOption || legendSource === "manual") && (
					<>
						<div className="space-y-2">
							<Label htmlFor="legendType">Legend Type</Label>
							<Select
								value={legendType}
								onValueChange={(v) =>
									onLegendTypeChange(v as "gradient" | "categorical")
								}
							>
								<SelectTrigger id="legendType">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="gradient">
										Gradient (continuous)
									</SelectItem>
									<SelectItem value="categorical">
										Categorical (discrete)
									</SelectItem>
								</SelectContent>
							</Select>
						</div>

						<div className="space-y-2">
							<Label>Legend Items</Label>
							<div className="space-y-2 mt-2">
								{legendItems.map((item, index) => (
									<div
										key={`legend-item-${item.label}-${index}`}
										className="flex items-center gap-2"
									>
										<Input
											value={item.label}
											onChange={(e) =>
												onUpdateItem(index, "label", e.target.value)
											}
											placeholder="Label"
											className="flex-1"
										/>
										<Input
											type="color"
											value={item.color}
											onChange={(e) =>
												onUpdateItem(index, "color", e.target.value)
											}
											className="w-16"
										/>
										{legendItems.length > 2 && (
											<Button
												variant="ghost"
												size="sm"
												onClick={() => onRemoveItem(index)}
											>
												<Trash2 className="w-4 h-4 text-red-500" />
											</Button>
										)}
									</div>
								))}
							</div>
							<Button
								variant="outline"
								size="sm"
								onClick={onAddItem}
								className="w-full mt-2"
							>
								<Plus className="w-4 h-4 mr-2" />
								Add Item
							</Button>
						</div>
					</>
				)}
			</div>
		</div>
	);
}

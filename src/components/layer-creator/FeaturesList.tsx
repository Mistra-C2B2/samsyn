import type { Feature } from "../../hooks/useLayerEditor";
import { Button } from "../ui/button";
import { Label } from "../ui/label";
import { FeatureCard } from "./FeatureCard";

// ============================================================================
// Types
// ============================================================================

export interface FeaturesListProps {
	features: Feature[];
	selectedFeatureIds: Set<string>;
	onUpdateFeature: (
		featureId: string,
		field: keyof Feature,
		value: unknown,
	) => void;
	onRemoveFeature: (featureId: string) => void;
	onSelectFeature: (featureId: string) => void;
	onPanToFeature: (
		featureId: string,
		coordinates: unknown,
		geometryType: string,
	) => void;
	onClearAll: () => void;
}

// ============================================================================
// Component
// ============================================================================

export function FeaturesList({
	features,
	selectedFeatureIds,
	onUpdateFeature,
	onRemoveFeature,
	onSelectFeature,
	onPanToFeature,
	onClearAll,
}: FeaturesListProps) {
	// Empty state
	if (features.length === 0) {
		return (
			<div className="p-6 bg-slate-50 border border-slate-200 rounded-lg text-center">
				<p className="text-sm text-slate-600">
					Click a button above to start drawing features on the map
				</p>
			</div>
		);
	}

	return (
		<div className="space-y-3 border-t border-slate-200 pt-4">
			<div className="flex items-center justify-between">
				<Label>Features ({features.length})</Label>
				<Button
					variant="ghost"
					size="sm"
					onClick={onClearAll}
					className="text-xs text-slate-500 hover:text-red-600"
				>
					Clear All
				</Button>
			</div>
			{features.map((feature) => (
				<FeatureCard
					key={feature.id}
					feature={feature}
					onUpdate={(field, value) => onUpdateFeature(feature.id, field, value)}
					onRemove={() => onRemoveFeature(feature.id)}
					onSelect={() => {
						onSelectFeature(feature.id);
						onPanToFeature(feature.id, feature.coordinates, feature.type);
					}}
					isSelected={selectedFeatureIds.has(feature.id)}
				/>
			))}
		</div>
	);
}

import { Trash2 } from "lucide-react";
import { memo, useEffect, useState } from "react";
import { useDebouncedCallback } from "../../hooks/useDebounce";
import type { Feature } from "../../hooks/useLayerEditor";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { GeometryIcon, getCoordinatesSummary } from "./utils.tsx";

// ============================================================================
// Types
// ============================================================================

export interface FeatureCardProps {
  feature: Feature;
  onUpdate: (field: keyof Feature, value: unknown) => void;
  onRemove: () => void;
  onSelect?: () => void;
  isSelected?: boolean;
}

// ============================================================================
// Component
// ============================================================================

export const FeatureCard = memo(function FeatureCard({
  feature,
  onUpdate,
  onRemove,
  onSelect,
  isSelected,
}: FeatureCardProps) {
  // Local state for immediate UI updates
  const [localDescription, setLocalDescription] = useState(feature.description);

  // Update local state when feature prop changes
  useEffect(() => {
    setLocalDescription(feature.description);
  }, [feature.description]);

  // Debounced callback for description updates (300ms delay)
  const debouncedDescriptionUpdate = useDebouncedCallback(
    (value: string) => onUpdate("description", value),
    300
  );

  const handleDescriptionChange = (value: string) => {
    setLocalDescription(value);
    debouncedDescriptionUpdate(value);
  };

  return (
    <div
      className={`rounded-lg border transition-all flex overflow-hidden cursor-pointer hover:border-teal-300 ${
        isSelected
          ? "border-teal-600 bg-teal-50 text-teal-700"
          : "border-slate-200 hover:border-teal-400 hover:bg-slate-50"
      }`}
      onClick={onSelect}
      onKeyDown={(e) => {
        // Only handle keyboard selection if not typing in an input/textarea
        const target = e.target as HTMLElement;
        const isInput =
          target.tagName === "INPUT" || target.tagName === "TEXTAREA";
        if ((e.key === "Enter" || e.key === " ") && !isInput) {
          e.preventDefault();
          onSelect?.();
        }
      }}
      tabIndex={0}
      role="button"
      aria-pressed={isSelected}
    >
      {/* Left accent bar for selected feature */}
      {isSelected && <div className="w-2 bg-teal-500 flex-shrink-0" />}
      <div
        className={`p-3 space-y-2 flex-1 ${
          isSelected ? "bg-teal-100" : "bg-slate-50"
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GeometryIcon type={feature.type} />
            <span className="text-xs text-slate-600">{feature.type}</span>
          </div>
          <Button variant="ghost" size="sm" onClick={onRemove}>
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>

        <Input
          placeholder="Feature name (optional)"
          value={feature.name}
          onChange={(e) => onUpdate("name", e.target.value)}
        />

        <Textarea
          placeholder="Description (optional)"
          value={localDescription}
          onChange={(e) => handleDescriptionChange(e.target.value)}
          rows={2}
        />

        <div className="text-xs text-slate-500">
          {getCoordinatesSummary(feature)}
        </div>
      </div>
    </div>
  );
});

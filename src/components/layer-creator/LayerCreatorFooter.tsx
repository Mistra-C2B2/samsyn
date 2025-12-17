import { Loader2, Plus } from "lucide-react";
import { Button } from "../ui/button";

// ============================================================================
// Types
// ============================================================================

export interface LayerCreatorFooterProps {
	saveWarning: string | null;
	error: string | null;
	saving: boolean;
	canSave: boolean;
	isEditMode: boolean;
	onCancel: () => void;
	onCreate: () => void;
}

// ============================================================================
// Component
// ============================================================================

export function LayerCreatorFooter({
	saveWarning,
	error,
	saving,
	canSave,
	isEditMode,
	onCancel,
	onCreate,
}: LayerCreatorFooterProps) {
	return (
		<div className="p-4 border-t border-slate-200 space-y-3">
			{saveWarning && (
				<div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-600">
					{saveWarning}
				</div>
			)}
			{error && (
				<div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
					{error}
				</div>
			)}
			<Button
				variant="outline"
				onClick={onCancel}
				className="w-full"
				disabled={saving}
			>
				Cancel
			</Button>
			<Button onClick={onCreate} className="w-full" disabled={!canSave}>
				{saving ? (
					<>
						<Loader2 className="w-4 h-4 mr-2 animate-spin" />
						{isEditMode ? "Saving..." : "Creating..."}
					</>
				) : (
					<>
						<Plus className="w-4 h-4 mr-2" />
						{isEditMode ? "Save Changes" : "Create Layer"}
					</>
				)}
			</Button>
		</div>
	);
}

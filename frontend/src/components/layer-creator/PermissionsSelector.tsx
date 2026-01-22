import { Lock, Users } from "lucide-react";
import { Label } from "../ui/label";

// ============================================================================
// Types
// ============================================================================

interface PermissionsSelectorProps {
	editableBy: "creator-only" | "everyone";
	setEditableBy: (value: "creator-only" | "everyone") => void;
}

// ============================================================================
// Component
// ============================================================================

export function PermissionsSelector({
	editableBy,
	setEditableBy,
}: PermissionsSelectorProps) {
	return (
		<div className="space-y-3 border-t border-slate-200 pt-4">
			<Label>Who Can Edit This Layer?</Label>
			<div className="space-y-2">
				<button
					type="button"
					onClick={() => setEditableBy("creator-only")}
					className={`w-full p-3 rounded-lg border-2 transition-all text-left ${
						editableBy === "creator-only"
							? "border-teal-600 bg-teal-50"
							: "border-slate-200 hover:border-teal-400"
					}`}
				>
					<div className="flex items-start gap-3">
						<div
							className={`p-2 rounded ${
								editableBy === "creator-only" ? "bg-teal-100" : "bg-slate-100"
							}`}
						>
							<Lock className="w-4 h-4" />
						</div>
						<div className="flex-1">
							<div className="font-medium text-sm">Only Me</div>
							<p className="text-xs text-slate-600 mt-1">
								Only you can edit or delete this layer
							</p>
						</div>
					</div>
				</button>

				<button
					type="button"
					onClick={() => setEditableBy("everyone")}
					className={`w-full p-3 rounded-lg border-2 transition-all text-left ${
						editableBy === "everyone"
							? "border-teal-600 bg-teal-50"
							: "border-slate-200 hover:border-teal-400"
					}`}
				>
					<div className="flex items-start gap-3">
						<div
							className={`p-2 rounded ${
								editableBy === "everyone" ? "bg-teal-100" : "bg-slate-100"
							}`}
						>
							<Users className="w-4 h-4" />
						</div>
						<div className="flex-1">
							<div className="font-medium text-sm">Everyone</div>
							<p className="text-xs text-slate-600 mt-1">
								All users can edit this layer
							</p>
						</div>
					</div>
				</button>
			</div>
			<p className="text-xs text-slate-500">
				You can change this setting later as the layer creator
			</p>
		</div>
	);
}

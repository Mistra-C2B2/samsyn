import { AlertCircle, CheckCircle, Loader2, Save } from "lucide-react";
import { useState } from "react";
import type { WmsServer } from "@/services/wmsServerService";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";

interface WmsServerFormProps {
	editingServer: WmsServer | null;
	onSubmit: (data: {
		name: string;
		baseUrl: string;
		description?: string;
	}) => Promise<WmsServer>;
	onCancel: () => void;
}

export function WmsServerForm({
	editingServer,
	onSubmit,
	onCancel,
}: WmsServerFormProps) {
	const [name, setName] = useState(editingServer?.name || "");
	const [baseUrl, setBaseUrl] = useState(editingServer?.baseUrl || "");
	const [description, setDescription] = useState(
		editingServer?.description || "",
	);
	const [isSaving, setIsSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [validationResult, setValidationResult] = useState<{
		serviceTitle?: string;
		serviceProvider?: string;
		layerCount?: number;
	} | null>(null);

	const isEditing = !!editingServer;
	const isValid = name.trim() && (isEditing || baseUrl.trim());

	const handleSubmit = async () => {
		if (!isValid) return;

		setIsSaving(true);
		setError(null);

		try {
			const result = await onSubmit({
				name: name.trim(),
				baseUrl: baseUrl.trim(),
				description: description.trim() || undefined,
			});

			// Show validation result briefly before closing
			setValidationResult({
				serviceTitle: result.serviceTitle || undefined,
				serviceProvider: result.serviceProvider || undefined,
				layerCount: result.layerCount,
			});

			// Close after showing success
			setTimeout(() => {
				onCancel();
			}, 500);
		} catch (err) {
			setError(
				err instanceof Error
					? err.message
					: "Failed to save WMS server. Please check the URL and try again.",
			);
		} finally {
			setIsSaving(false);
		}
	};

	return (
		<div className="flex flex-col h-full">
			{/* Back Button */}
			<div className="px-4 py-3 border-b border-slate-200">
				<Button variant="outline" onClick={onCancel} size="sm">
					← Back to Servers
				</Button>
			</div>

			{/* Form Content */}
			<div className="flex-1 overflow-y-auto p-4 space-y-4">
				<h3 className="font-medium text-slate-900">
					{isEditing ? "Edit WMS Server" : "Add WMS Server"}
				</h3>

				{/* URL Field (only for new servers) */}
				{!isEditing && (
					<div className="space-y-2">
						<Label htmlFor="wms-url">WMS URL *</Label>
						<Input
							id="wms-url"
							type="url"
							value={baseUrl}
							onChange={(e) => {
								setBaseUrl(e.target.value);
								setError(null);
								setValidationResult(null);
							}}
							placeholder="https://example.com/wms"
							className="text-sm"
						/>
						<p className="text-xs text-slate-500">
							Enter the WMS service endpoint URL. Capabilities will be fetched
							automatically.
						</p>
					</div>
				)}

				{/* Name Field */}
				<div className="space-y-2">
					<Label htmlFor="server-name">Display Name *</Label>
					<Input
						id="server-name"
						type="text"
						value={name}
						onChange={(e) => setName(e.target.value)}
						placeholder="My WMS Server"
						className="text-sm"
					/>
				</div>

				{/* Description Field */}
				<div className="space-y-2">
					<Label htmlFor="server-description">Description</Label>
					<Textarea
						id="server-description"
						value={description}
						onChange={(e) => setDescription(e.target.value)}
						placeholder="Optional description..."
						className="text-sm resize-none"
						rows={3}
					/>
				</div>

				{/* Error Message */}
				{error && (
					<div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
						<AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
						<span>{error}</span>
					</div>
				)}

				{/* Validation Result */}
				{validationResult && (
					<div className="flex items-start gap-2 p-3 bg-green-50 border border-green-200 rounded text-sm text-green-700">
						<CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
						<div>
							<p className="font-medium">Server validated successfully!</p>
							{validationResult.serviceTitle && (
								<p className="text-xs mt-1">
									Service: {validationResult.serviceTitle}
								</p>
							)}
							{validationResult.layerCount !== undefined && (
								<p className="text-xs">
									{validationResult.layerCount} layers available
								</p>
							)}
						</div>
					</div>
				)}
			</div>

			{/* Submit Button */}
			<div className="p-4 border-t border-slate-200">
				<Button
					onClick={handleSubmit}
					className="w-full"
					disabled={!isValid || isSaving}
				>
					{isSaving ? (
						<>
							<Loader2 className="w-4 h-4 mr-2 animate-spin" />
							{isEditing ? "Updating..." : "Validating & Saving..."}
						</>
					) : (
						<>
							<Save className="w-4 h-4 mr-2" />
							{isEditing ? "Update Server" : "Add Server"}
						</>
					)}
				</Button>
			</div>
		</div>
	);
}

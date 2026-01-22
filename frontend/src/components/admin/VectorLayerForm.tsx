import {
	AlertCircle,
	CheckCircle2,
	ClipboardPaste,
	Eye,
	FileJson,
	Upload,
	X,
} from "lucide-react";
import { useCallback, useRef, useState } from "react";
import type { UseVectorFormReturn } from "../../hooks/admin-layer-form/useVectorForm";
import { formatBounds } from "../../utils/geojsonValidation";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Slider } from "../ui/slider";
import { Switch } from "../ui/switch";

// ============================================================================
// Types
// ============================================================================

interface VectorLayerFormProps {
	form: UseVectorFormReturn;
	onPreview?: () => void;
}

// ============================================================================
// Component
// ============================================================================

export function VectorLayerForm({ form, onPreview }: VectorLayerFormProps) {
	const fileInputRef = useRef<HTMLInputElement>(null);
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const [isDragging, setIsDragging] = useState(false);

	// Handle drag events
	const handleDragOver = useCallback((e: React.DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
		setIsDragging(true);
	}, []);

	const handleDragLeave = useCallback((e: React.DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
		setIsDragging(false);
	}, []);

	const handleDrop = useCallback(
		(e: React.DragEvent) => {
			e.preventDefault();
			e.stopPropagation();
			setIsDragging(false);

			const files = e.dataTransfer.files;
			if (files.length > 0) {
				const file = files[0];
				if (
					file.type === "application/json" ||
					file.name.endsWith(".json") ||
					file.name.endsWith(".geojson")
				) {
					form.handleFileUpload(file);
				}
			}
		},
		[form],
	);

	const handleFileSelect = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const files = e.target.files;
			if (files && files.length > 0) {
				form.handleFileUpload(files[0]);
			}
		},
		[form],
	);

	const handlePaste = useCallback(async () => {
		if (textareaRef.current) {
			// Focus the textarea
			textareaRef.current.focus();

			try {
				// Try the modern clipboard API first (works if permission already granted)
				const text = await navigator.clipboard.readText();
				form.setRawJson(text);
				form.setInputMode("paste");
				setTimeout(() => form.validate(), 0);
			} catch {
				// Fallback: trigger paste event programmatically
				// This requires the user to actually paste (Ctrl/Cmd+V)
				try {
					document.execCommand("paste");
				} catch {
					// If both fail, the textarea is focused so user can paste manually
					// The onPaste handler will auto-validate
				}
			}
		}
	}, [form]);

	const handleTextChange = useCallback(
		(e: React.ChangeEvent<HTMLTextAreaElement>) => {
			form.setRawJson(e.target.value);
		},
		[form],
	);

	const handleTextBlur = useCallback(() => {
		if (form.rawJson.trim()) {
			form.validate();
		}
	}, [form]);

	const handleTextareaPaste = useCallback(() => {
		// Auto-validate after the paste completes
		// Let the browser handle the paste naturally via onChange
		// Then validate after the state updates
		setTimeout(() => form.validate(), 100);
	}, [form]);

	return (
		<div className="space-y-4">
			{/* Input Mode Tabs */}
			<div className="flex rounded-lg border border-slate-200 p-1 bg-slate-50">
				<button
					type="button"
					onClick={() => form.setInputMode("paste")}
					className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
						form.inputMode === "paste"
							? "bg-white text-slate-900 shadow-sm"
							: "text-slate-600 hover:text-slate-900"
					}`}
				>
					<ClipboardPaste className="w-4 h-4" />
					Paste JSON
				</button>
				<button
					type="button"
					onClick={() => form.setInputMode("upload")}
					className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
						form.inputMode === "upload"
							? "bg-white text-slate-900 shadow-sm"
							: "text-slate-600 hover:text-slate-900"
					}`}
				>
					<Upload className="w-4 h-4" />
					Upload File
				</button>
			</div>

			{/* Paste Mode */}
			{form.inputMode === "paste" && (
				<div className="space-y-2">
					<div className="flex items-center justify-between">
						<Label className="text-xs text-slate-600">GeoJSON Data</Label>
						<Button
							type="button"
							variant="ghost"
							size="sm"
							onClick={handlePaste}
							className="h-7 text-xs"
						>
							<ClipboardPaste className="w-3 h-3 mr-1" />
							Paste from Clipboard
						</Button>
					</div>
					<textarea
						ref={textareaRef}
						value={form.rawJson}
						onChange={handleTextChange}
						onBlur={handleTextBlur}
						onPaste={handleTextareaPaste}
						placeholder={`{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": { "type": "Point", "coordinates": [0, 0] },
      "properties": {}
    }
  ]
}`}
						className="w-full h-48 p-3 text-sm font-mono bg-slate-50 border border-slate-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
						spellCheck={false}
					/>
					<div className="flex items-center gap-2">
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={() => form.validate()}
							disabled={!form.rawJson.trim()}
							className="text-xs"
						>
							Validate
						</Button>
						{form.rawJson.trim() && (
							<Button
								type="button"
								variant="ghost"
								size="sm"
								onClick={() => {
									form.setRawJson("");
									form.validate();
								}}
								className="text-xs text-slate-500"
							>
								Clear
							</Button>
						)}
					</div>
				</div>
			)}

			{/* Upload Mode */}
			{form.inputMode === "upload" && (
				<div className="space-y-2">
					<Label className="text-xs text-slate-600">GeoJSON File</Label>

					{!form.fileName ? (
						<div
							onDragOver={handleDragOver}
							onDragLeave={handleDragLeave}
							onDrop={handleDrop}
							onClick={() => fileInputRef.current?.click()}
							className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
								isDragging
									? "border-teal-400 bg-teal-50"
									: "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
							}`}
						>
							<FileJson
								className={`w-10 h-10 mx-auto mb-3 ${isDragging ? "text-teal-500" : "text-slate-300"}`}
							/>
							<p className="text-sm text-slate-600 mb-1">
								Drag & drop a .geojson or .json file
							</p>
							<p className="text-xs text-slate-400">or click to browse</p>
							<input
								ref={fileInputRef}
								type="file"
								accept=".json,.geojson,application/json"
								onChange={handleFileSelect}
								className="hidden"
							/>
						</div>
					) : (
						<div className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg">
							<FileJson className="w-8 h-8 text-blue-500 flex-shrink-0" />
							<div className="flex-1 min-w-0">
								<p className="text-sm font-medium text-slate-900 truncate">
									{form.fileName}
								</p>
								<p className="text-xs text-slate-500">
									{form.validation?.valid
										? `${form.validation.featureCount} features`
										: "Processing..."}
								</p>
							</div>
							<Button
								type="button"
								variant="ghost"
								size="sm"
								onClick={form.clearFile}
								className="flex-shrink-0"
							>
								<X className="w-4 h-4" />
							</Button>
						</div>
					)}
				</div>
			)}

			{/* Validation Result */}
			{form.validation && (
				<div
					className={`rounded-lg border p-3 ${
						form.validation.valid
							? "bg-green-50 border-green-200"
							: "bg-red-50 border-red-200"
					}`}
				>
					<div className="flex items-start gap-2">
						{form.validation.valid ? (
							<CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
						) : (
							<AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
						)}
						<div className="flex-1 min-w-0">
							{form.validation.valid ? (
								<>
									<p className="text-sm font-medium text-green-800">
										Valid GeoJSON
									</p>
									<div className="mt-2 space-y-1 text-xs text-green-700">
										<p>{form.validation.featureCount} features</p>
										{form.validation.geometryTypes &&
											form.validation.geometryTypes.length > 0 && (
												<p>
													Geometry: {form.validation.geometryTypes.join(", ")}
												</p>
											)}
										{form.validation.bounds && (
											<p>Bounds: {formatBounds(form.validation.bounds)}</p>
										)}
									</div>
									{onPreview && (
										<Button
											type="button"
											variant="outline"
											size="sm"
											onClick={onPreview}
											className="mt-3 text-xs bg-white"
										>
											<Eye className="w-3 h-3 mr-1" />
											Preview on Map
										</Button>
									)}
								</>
							) : (
								<>
									<p className="text-sm font-medium text-red-800">
										Invalid GeoJSON
									</p>
									<p className="mt-1 text-xs text-red-700">
										{form.validation.error}
									</p>
									{form.validation.errorLine && (
										<p className="text-xs text-red-600 mt-1">
											Line {form.validation.errorLine}
										</p>
									)}
								</>
							)}
						</div>
					</div>
				</div>
			)}

			{/* Styling Section */}
			{form.validation?.valid && (
				<div className="space-y-4 pt-2">
					<div className="flex items-center gap-2 text-xs font-medium text-slate-700">
						<div className="h-px flex-1 bg-slate-200" />
						<span>Styling</span>
						<div className="h-px flex-1 bg-slate-200" />
					</div>

					{/* Color Picker */}
					<div className="space-y-2">
						<Label className="text-xs text-slate-600">Color</Label>
						<div className="flex items-center gap-3">
							<div className="relative">
								<input
									type="color"
									value={form.styling.color}
									onChange={(e) => form.updateColor(e.target.value)}
									className="w-10 h-10 rounded-lg border border-slate-200 cursor-pointer p-1"
								/>
							</div>
							<Input
								value={form.styling.color}
								onChange={(e) => form.updateColor(e.target.value)}
								className="flex-1 font-mono text-sm"
								placeholder="#3388ff"
							/>
						</div>
					</div>

					{/* Line Width Slider */}
					<div className="space-y-2">
						<div className="flex items-center justify-between">
							<Label className="text-xs text-slate-600">Line Width</Label>
							<span className="text-xs text-slate-500">
								{form.styling.lineWidth}px
							</span>
						</div>
						<Slider
							value={[form.styling.lineWidth]}
							onValueChange={([value]) => form.updateLineWidth(value)}
							min={1}
							max={10}
							step={1}
							className="py-2"
						/>
					</div>

					{/* Fill Polygons Toggle */}
					<div className="flex items-center justify-between">
						<Label className="text-xs text-slate-600">Fill Polygons</Label>
						<Switch
							checked={form.styling.fillPolygons}
							onCheckedChange={form.updateFillPolygons}
						/>
					</div>
				</div>
			)}
		</div>
	);
}

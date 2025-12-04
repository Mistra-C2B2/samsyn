import {
	ArrowRight,
	Check,
	Globe,
	Layers,
	Lock,
	Mail,
	Map,
	MapPin,
	Plus,
	Users,
	X,
} from "lucide-react";
import { useEffect, useState } from "react";
import type { UserMap } from "../App";
import { Button } from "./ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "./ui/select";
import { Separator } from "./ui/separator";
import { Textarea } from "./ui/textarea";

interface MapCreationWizardProps {
	isOpen: boolean;
	onClose: () => void;
	onCreate: (
		name: string,
		description: string,
		permissions: MapPermissions,
	) => Promise<void>;
	onOpenLayerManager: () => void;
	editMode?: boolean;
	existingMap?: UserMap;
}

export interface MapPermissions {
	editAccess: "private" | "collaborators" | "public";
	collaborators: string[]; // Array of email addresses
	visibility: "private" | "public"; // Who can view the map
}

type Step = "create" | "success";

export function MapCreationWizard({
	isOpen,
	onClose,
	onCreate,
	onOpenLayerManager,
	editMode,
	existingMap,
}: MapCreationWizardProps) {
	const [step, setStep] = useState<Step>("create");
	const [mapName, setMapName] = useState("");
	const [mapDescription, setMapDescription] = useState("");
	const [editAccess, setEditAccess] = useState<
		"private" | "collaborators" | "public"
	>("private");
	const [collaborators, setCollaborators] = useState<string[]>([]);
	const [newCollaboratorEmail, setNewCollaboratorEmail] = useState("");
	const [visibility, setVisibility] = useState<"private" | "public">("private");

	// Check if user can manage collaborators (only owner)
	const canManageCollaborators =
		!editMode || existingMap?.user_role === "owner";

	// Update state when existingMap changes (when entering edit mode)
	useEffect(() => {
		if (editMode && existingMap) {
			setMapName(existingMap.name);
			setMapDescription(existingMap.description);
			setEditAccess(existingMap.permissions?.editAccess || "private");
			setCollaborators(existingMap.permissions?.collaborators || []);
			setVisibility(existingMap.permissions?.visibility || "private");
		} else {
			// Reset to defaults when not in edit mode
			setMapName("");
			setMapDescription("");
			setEditAccess("private");
			setCollaborators([]);
			setVisibility("private");
		}
	}, [editMode, existingMap, isOpen]);

	const [emailError, setEmailError] = useState<string | null>(null);
	const [formError, setFormError] = useState<string | null>(null);

	const handleAddCollaborator = () => {
		const email = newCollaboratorEmail.trim().toLowerCase();
		setEmailError(null);

		if (!email) {
			setEmailError("Please enter an email address");
			return;
		}

		if (!email.includes("@") || !email.includes(".")) {
			setEmailError("Please enter a valid email address");
			return;
		}

		if (collaborators.includes(email)) {
			setEmailError("This collaborator has already been added");
			return;
		}

		setCollaborators([...collaborators, email]);
		setNewCollaboratorEmail("");
	};

	const handleRemoveCollaborator = (email: string) => {
		setCollaborators(collaborators.filter((c) => c !== email));
	};

	const handleCreate = async () => {
		if (mapName.trim()) {
			setFormError(null);
			const permissions: MapPermissions = {
				editAccess,
				collaborators: editAccess === "collaborators" ? collaborators : [],
				visibility,
			};

			try {
				console.log("🔄 MapCreationWizard: Calling onCreate...");
				await onCreate(mapName, mapDescription, permissions);
				console.log("✅ MapCreationWizard: onCreate succeeded");
				// Only show success if the API call succeeded
				if (!editMode) {
					setStep("success");
				} else {
					handleClose();
				}
			} catch (error: any) {
				// Display error in the form instead of relying on toast
				console.error("❌ MapCreationWizard: Caught error:", error);
				const errorMessage =
					error?.message || "An error occurred while saving the map";
				console.log("📝 Setting formError to:", errorMessage);
				setFormError(errorMessage);
			}
		}
	};

	const handleClose = () => {
		setStep("create");
		setMapName("");
		setMapDescription("");
		setEditAccess("private");
		setCollaborators([]);
		setNewCollaboratorEmail("");
		setEmailError(null);
		setFormError(null);
		setVisibility("private");
		onClose();
	};

	const handleAddLayers = () => {
		handleClose();
		onOpenLayerManager();
	};

	return (
		<Dialog open={isOpen} onOpenChange={handleClose}>
			<DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
				{step === "create" ? (
					<>
						<DialogHeader>
							<div className="flex items-center gap-3 mb-2">
								<div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center bg-[rgba(255,255,255,0.1)]">
									<Map className="w-6 h-6" />
								</div>
								<div>
									<DialogTitle>
										{editMode ? "Edit Map" : "Create a New Map"}
									</DialogTitle>
									<DialogDescription>
										{editMode
											? "Update your map settings and permissions"
											: "Give your map a name and configure permissions"}
									</DialogDescription>
								</div>
							</div>
						</DialogHeader>

						<div className="space-y-4 py-4">
							<div className="space-y-2">
								<Label htmlFor="map-name">Map Name *</Label>
								<Input
									id="map-name"
									placeholder="e.g., Baltic Sea Fishing Activity"
									value={mapName}
									onChange={(e) => setMapName(e.target.value)}
									autoFocus
								/>
							</div>

							<div className="space-y-2">
								<Label htmlFor="map-description">Description</Label>
								<Textarea
									id="map-description"
									placeholder="Describe the purpose of this map and what information it will contain..."
									value={mapDescription}
									onChange={(e) => setMapDescription(e.target.value)}
									rows={3}
									className="resize-none"
								/>
							</div>

							{!canManageCollaborators && (
								<div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mt-4">
									<div className="flex items-center gap-2">
										<Lock className="w-4 h-4 text-amber-800" />
										<p className="text-sm text-amber-800 font-medium">
											You don't have permission to change map settings
										</p>
									</div>
									<p className="text-xs text-amber-700 mt-2">
										Only the map owner can modify permissions and collaborators.
									</p>
								</div>
							)}

							<Separator />

							{canManageCollaborators && (
								<div className="space-y-3 bg-slate-50 rounded-lg p-4 border border-slate-200">
									<div className="flex items-center gap-2">
										<Users className="w-4 h-4 text-teal-600" />
										<Label className="text-sm text-slate-900 mb-0">
											Edit Permissions
										</Label>
									</div>
									<p className="text-xs text-slate-600">
										Control who can modify or delete this map
									</p>

									<Select
										value={editAccess}
										onValueChange={(value) =>
											setEditAccess(
												value as "private" | "collaborators" | "public",
											)
										}
									>
										<SelectTrigger className="w-full bg-white">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="private">
												<div className="flex items-center gap-2">
													<Lock className="w-4 h-4" />
													<div className="flex flex-col">
														<div className="text-left">Private</div>
														<div className="text-xs text-slate-500 text-left">
															Only you can edit
														</div>
													</div>
												</div>
											</SelectItem>
											<SelectItem value="collaborators">
												<div className="flex items-center gap-2">
													<Users className="w-4 h-4" />
													<div className="flex flex-col">
														<div className="text-left">Collaborators</div>
														<div className="text-xs text-slate-500 text-left">
															Specific people can edit
														</div>
													</div>
												</div>
											</SelectItem>
											<SelectItem value="public">
												<div className="flex items-center gap-2">
													<Globe className="w-4 h-4" />
													<div className="flex flex-col">
														<div className="text-left">Public</div>
														<div className="text-xs text-slate-500 text-left">
															Anyone can edit
														</div>
													</div>
												</div>
											</SelectItem>
										</SelectContent>
									</Select>

									{editAccess === "collaborators" && (
										<div className="space-y-2 pt-2">
											<Label
												htmlFor="collaborator-email"
												className="text-xs text-slate-700"
											>
												Add Collaborators by Email
											</Label>
											<div className="flex gap-2">
												<Input
													id="collaborator-email"
													type="email"
													placeholder="colleague@example.com"
													value={newCollaboratorEmail}
													onChange={(e) => {
														setNewCollaboratorEmail(e.target.value);
														if (emailError) setEmailError(null);
													}}
													onKeyDown={(e) => {
														if (e.key === "Enter") {
															e.preventDefault();
															handleAddCollaborator();
														}
													}}
													className={`flex-1 bg-white ${emailError ? "border-red-500" : ""}`}
												/>
												<Button
													type="button"
													variant="outline"
													size="sm"
													onClick={handleAddCollaborator}
													disabled={!newCollaboratorEmail.trim()}
												>
													<Plus className="w-4 h-4" />
												</Button>
											</div>
											{emailError && (
												<p className="text-xs text-red-600 mt-1">
													{emailError}
												</p>
											)}

											{collaborators.length > 0 && (
												<div className="space-y-1 mt-2">
													{collaborators.map((email) => (
														<div
															key={email}
															className="flex items-center justify-between bg-white border border-slate-200 rounded px-3 py-2"
														>
															<div className="flex items-center gap-2">
																<Mail className="w-4 h-4 text-slate-400" />
																<span className="text-sm text-slate-700">
																	{email}
																</span>
															</div>
															<Button
																type="button"
																variant="ghost"
																size="sm"
																onClick={() => handleRemoveCollaborator(email)}
																className="h-6 w-6 p-0 hover:bg-red-50 hover:text-red-600"
															>
																<X className="w-4 h-4" />
															</Button>
														</div>
													))}
												</div>
											)}

											{collaborators.length === 0 && (
												<p className="text-xs text-slate-500 italic">
													No collaborators added yet
												</p>
											)}
										</div>
									)}

									{editAccess === "public" && (
										<div className="bg-amber-50 border border-amber-200 rounded p-3 mt-2">
											<p className="text-xs text-amber-800">
												⚠️ Anyone with access to this map will be able to modify
												or delete it.
											</p>
										</div>
									)}
								</div>
							)}

							{canManageCollaborators && <Separator />}

							{canManageCollaborators && (
								<div className="space-y-3 bg-slate-50 rounded-lg p-4 border border-slate-200">
									<div className="flex items-center gap-2">
										<Globe className="w-4 h-4 text-teal-600" />
										<Label className="text-sm text-slate-900 mb-0">
											View Permissions
										</Label>
									</div>
									<p className="text-xs text-slate-600">
										Control who can view this map
									</p>

									<Select
										value={visibility}
										onValueChange={(value) =>
											setVisibility(value as "private" | "public")
										}
									>
										<SelectTrigger className="w-full bg-white">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="private">
												<div className="flex items-center gap-2">
													<Lock className="w-4 h-4" />
													<div className="flex flex-col">
														<div className="text-left">You & Collaborators</div>
														<div className="text-xs text-slate-500 text-left">
															Only you and your collaborators can view
														</div>
													</div>
												</div>
											</SelectItem>
											<SelectItem value="public">
												<div className="flex items-center gap-2">
													<Globe className="w-4 h-4" />
													<div className="flex flex-col">
														<div className="text-left">Public</div>
														<div className="text-xs text-slate-500 text-left">
															Everyone can view
														</div>
													</div>
												</div>
											</SelectItem>
										</SelectContent>
									</Select>

									{visibility === "public" && (
										<div className="bg-blue-50 border border-blue-200 rounded p-3 mt-2">
											<p className="text-xs text-blue-800">
												ℹ️ This map will be visible to everyone.
											</p>
										</div>
									)}
								</div>
							)}
						</div>

						{formError && (
							<div className="bg-red-50 border border-red-200 rounded-lg p-4 mt-4">
								<p className="text-sm text-red-800">{formError}</p>
							</div>
						)}

						<DialogFooter>
							<Button variant="outline" onClick={handleClose}>
								Cancel
							</Button>
							<Button onClick={handleCreate} disabled={!mapName.trim()}>
								{editMode ? "Save Changes" : "Create Map"}
								<ArrowRight className="w-4 h-4 ml-2" />
							</Button>
						</DialogFooter>
					</>
				) : (
					<>
						<DialogHeader>
							<div className="flex flex-col items-center gap-4 mb-2">
								<div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
									<Check className="w-8 h-8 text-green-600" />
								</div>
								<div className="text-center">
									<DialogTitle className="text-2xl mb-2">
										Map Created Successfully!
									</DialogTitle>
									<DialogDescription className="text-base">
										Your map "{mapName}" has been created
									</DialogDescription>
								</div>
							</div>
						</DialogHeader>

						<div className="bg-slate-50 rounded-lg p-6 my-4 border border-slate-200">
							<div className="flex items-start gap-4">
								<div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center flex-shrink-0">
									<Layers className="w-5 h-5 text-white" />
								</div>
								<div className="flex-1">
									<h3 className="text-slate-900 mb-1">Next Step: Add Layers</h3>
									<p className="text-sm text-slate-600">
										Your map is empty right now. Add data layers to visualize
										information like fish stocks, fishing zones, or protected
										areas.
									</p>
								</div>
							</div>
						</div>

						<DialogFooter className="flex-col sm:flex-row gap-2">
							<Button
								variant="outline"
								onClick={handleClose}
								className="sm:flex-1"
							>
								I'll Do It Later
							</Button>
							<Button onClick={handleAddLayers} className="sm:flex-1">
								<Layers className="w-4 h-4 mr-2" />
								Add Layers Now
							</Button>
						</DialogFooter>
					</>
				)}
			</DialogContent>
		</Dialog>
	);
}

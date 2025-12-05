import { toast } from "sonner@2.0.3";
import { useUser } from "@clerk/clerk-react";
import {
	Download,
	Globe,
	Info,
	Moon,
	Settings2,
	Shield,
	Trash2,
	Type,
} from "lucide-react";
import { useState } from "react";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "./ui/alert-dialog";
import { Button } from "./ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
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
import { Switch } from "./ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";

interface SettingsDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	isClerkConfigured?: boolean;
}

// Inner component that uses Clerk hooks
function SettingsDialogContent({
	open,
	onOpenChange,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const { user } = useUser();
	const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
	const [deleteConfirmText, setDeleteConfirmText] = useState("");

	// Preferences state
	const [language, setLanguage] = useState("en");
	const [textSize, setTextSize] = useState("medium");
	const [darkMode, setDarkMode] = useState(false);

	const handleExportData = () => {
		// Mock data export
		const userData = {
			profile: {
				email: user?.emailAddresses[0]?.emailAddress || "",
				name: user?.fullName || "",
				joinedAt: user?.createdAt || "",
			},
			maps: [],
			layers: [],
			comments: [],
		};

		const dataStr = JSON.stringify(userData, null, 2);
		const dataBlob = new Blob([dataStr], { type: "application/json" });
		const url = URL.createObjectURL(dataBlob);
		const link = document.createElement("a");
		link.href = url;
		link.download = `samsyn-data-export-${new Date().toISOString().split("T")[0]}.json`;
		link.click();
		URL.revokeObjectURL(url);

		toast.success("Data exported successfully!");
	};

	const handleDeleteData = () => {
		if (deleteConfirmText !== "DELETE") {
			toast.error("Please type DELETE to confirm");
			return;
		}

		// Mock data deletion - in production, this would call your backend API
		// to delete user's personal data while preserving shared/public resources

		toast.success(
			"Your data deletion request has been submitted. You will be signed out.",
		);

		// Close dialogs and sign out user
		setShowDeleteConfirm(false);
		setDeleteConfirmText("");
		onOpenChange(false);

		// In production, you would sign out the user after successful deletion
		// signOut();
	};

	return (
		<>
			<Dialog open={open} onOpenChange={onOpenChange}>
				<DialogContent className="max-w-2xl">
					<DialogHeader>
						<DialogTitle>Settings</DialogTitle>
						<DialogDescription>
							Manage your account and preferences
						</DialogDescription>
					</DialogHeader>

					<Tabs defaultValue="account" className="w-full">
						<TabsList className="grid w-full grid-cols-3">
							<TabsTrigger value="account">My Account</TabsTrigger>
							<TabsTrigger value="preferences">Preferences</TabsTrigger>
							<TabsTrigger value="about">About</TabsTrigger>
						</TabsList>

						{/* My Account Tab */}
						<TabsContent value="account" className="space-y-4 mt-4">
							{/* Account Section */}
							<div className="space-y-3">
								<h3 className="text-sm text-slate-900 flex items-center gap-2">
									<Shield className="w-4 h-4 text-teal-600" />
									Account Information
								</h3>
								{user ? (
									<div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2">
										<div>
											<p className="text-xs text-slate-500">Email</p>
											<p className="text-sm text-slate-900">
												{user.emailAddresses[0]?.emailAddress}
											</p>
										</div>
										{user.fullName && (
											<div>
												<p className="text-xs text-slate-500">Name</p>
												<p className="text-sm text-slate-900">
													{user.fullName}
												</p>
											</div>
										)}
										<div>
											<p className="text-xs text-slate-500">Member since</p>
											<p className="text-sm text-slate-900">
												{user.createdAt
													? new Date(user.createdAt).toLocaleDateString()
													: "N/A"}
											</p>
										</div>
									</div>
								) : (
									<p className="text-sm text-slate-500">Not signed in</p>
								)}
							</div>

							<Separator />

							{/* Data Management Section */}
							<div className="space-y-3">
								<h3 className="text-sm text-slate-900 flex items-center gap-2">
									<Info className="w-4 h-4 text-teal-600" />
									Data Management
								</h3>

								<div className="space-y-2">
									<Button
										variant="outline"
										size="sm"
										onClick={handleExportData}
										className="w-full justify-start hover:border-teal-400 hover:bg-white"
										disabled={!user}
									>
										<Download className="w-4 h-4" />
										Export My Data
									</Button>

									<Button
										variant="outline"
										size="sm"
										onClick={() => setShowDeleteConfirm(true)}
										className="w-full justify-start text-red-600 hover:text-red-700 hover:border-red-400 hover:bg-red-50"
										disabled={!user}
									>
										<Trash2 className="w-4 h-4" />
										Delete My Data
									</Button>
								</div>

								<p className="text-xs text-slate-500">
									Export includes your personal maps, layers, and comments.
									Deleting your data will remove all personal information while
									preserving shared resources that other users depend on.
								</p>
							</div>
						</TabsContent>

						{/* Preferences Tab */}
						<TabsContent value="preferences" className="space-y-4 mt-4">
							{/* Language Settings */}
							<div className="space-y-3">
								<h3 className="text-sm text-slate-900 flex items-center gap-2">
									<Globe className="w-4 h-4 text-teal-600" />
									Language
								</h3>
								<div className="space-y-2">
									<Label htmlFor="language" className="text-xs text-slate-500">
										Interface Language
									</Label>
									<Select
										value={language}
										onValueChange={(value) => {
											setLanguage(value);
											toast.success("Language preference updated");
										}}
									>
										<SelectTrigger id="language">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="en">English</SelectItem>
											<SelectItem value="sv">Svenska (Swedish)</SelectItem>
											<SelectItem value="fi">Suomi (Finnish)</SelectItem>
											<SelectItem value="de">Deutsch (German)</SelectItem>
											<SelectItem value="es">Español (Spanish)</SelectItem>
											<SelectItem value="fr">Français (French)</SelectItem>
										</SelectContent>
									</Select>
								</div>
							</div>

							<Separator />

							{/* Text Size Settings */}
							<div className="space-y-3">
								<h3 className="text-sm text-slate-900 flex items-center gap-2">
									<Type className="w-4 h-4 text-teal-600" />
									Text Size
								</h3>
								<div className="space-y-2">
									<Label htmlFor="textSize" className="text-xs text-slate-500">
										Interface Text Size
									</Label>
									<Select
										value={textSize}
										onValueChange={(value) => {
											setTextSize(value);
											toast.success("Text size preference updated");
										}}
									>
										<SelectTrigger id="textSize">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="small">Small</SelectItem>
											<SelectItem value="medium">Medium (Default)</SelectItem>
											<SelectItem value="large">Large</SelectItem>
											<SelectItem value="extra-large">Extra Large</SelectItem>
										</SelectContent>
									</Select>
									<p className="text-xs text-slate-500">
										Changes the size of text throughout the application
									</p>
								</div>
							</div>

							<Separator />

							{/* Dark Mode Settings */}
							<div className="space-y-3">
								<h3 className="text-sm text-slate-900 flex items-center gap-2">
									<Moon className="w-4 h-4 text-teal-600" />
									Appearance
								</h3>
								<div className="flex items-center justify-between">
									<div className="space-y-0.5">
										<Label
											htmlFor="darkMode"
											className="text-sm text-slate-900"
										>
											Dark Mode
										</Label>
										<p className="text-xs text-slate-500">
											Use dark theme for the interface
										</p>
									</div>
									<Switch
										id="darkMode"
										checked={darkMode}
										onCheckedChange={(checked) => {
											setDarkMode(checked);
											toast.success(
												`Dark mode ${checked ? "enabled" : "disabled"}`,
											);
										}}
									/>
								</div>
							</div>

							<Separator />

							{/* Map Preferences */}
							<div className="space-y-3">
								<h3 className="text-sm text-slate-900 flex items-center gap-2">
									<Settings2 className="w-4 h-4 text-teal-600" />
									Map Preferences
								</h3>
								<div className="space-y-3">
									<div className="flex items-center justify-between">
										<div className="space-y-0.5">
											<Label className="text-sm text-slate-900">
												Show Coordinates
											</Label>
											<p className="text-xs text-slate-500">
												Display coordinates on mouse hover
											</p>
										</div>
										<Switch defaultChecked />
									</div>
									<div className="flex items-center justify-between">
										<div className="space-y-0.5">
											<Label className="text-sm text-slate-900">
												Enable Animations
											</Label>
											<p className="text-xs text-slate-500">
												Smooth transitions and animations
											</p>
										</div>
										<Switch defaultChecked />
									</div>
								</div>
							</div>
						</TabsContent>

						{/* About Tab */}
						<TabsContent value="about" className="space-y-4 mt-4">
							<div className="space-y-4">
								<div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
									<div>
										<h3 className="text-sm text-slate-900">SamSyn</h3>
										<p className="text-xs text-slate-500">
											Marine Spatial Planning & Stakeholder Engagement Platform
										</p>
									</div>
									<Separator />
									<div>
										<p className="text-xs text-slate-500">Version</p>
										<p className="text-sm text-slate-900">1.0.0</p>
									</div>
									<div>
										<p className="text-xs text-slate-500">Last Updated</p>
										<p className="text-sm text-slate-900">November 2025</p>
									</div>
								</div>

								<Separator />

								<div className="space-y-2">
									<h3 className="text-sm text-slate-900">Legal</h3>
									<div className="flex gap-2">
										<Button
											variant="link"
											size="sm"
											className="h-auto p-0 text-xs text-teal-600 hover:text-teal-700"
											onClick={() => window.open("/privacy", "_blank")}
										>
											Privacy Policy
										</Button>
										<span className="text-xs text-slate-300">•</span>
										<Button
											variant="link"
											size="sm"
											className="h-auto p-0 text-xs text-teal-600 hover:text-teal-700"
											onClick={() => window.open("/terms", "_blank")}
										>
											Terms of Service
										</Button>
									</div>
								</div>

								<Separator />

								<div className="space-y-2">
									<h3 className="text-sm text-slate-900">Support</h3>
									<p className="text-xs text-slate-500">
										For technical support or questions, please contact us at{" "}
										<a
											href="mailto:support@samsyn.app"
											className="text-teal-600 hover:text-teal-700"
										>
											support@samsyn.app
										</a>
									</p>
								</div>
							</div>
						</TabsContent>
					</Tabs>
				</DialogContent>
			</Dialog>

			{/* Delete Confirmation Dialog */}
			<AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete Your Data</AlertDialogTitle>
						<AlertDialogDescription className="space-y-3">
							<p>This action will permanently delete the following:</p>
							<ul className="list-disc list-inside space-y-1 text-sm">
								<li>Your personal identification information</li>
								<li>All custom maps you've created</li>
								<li>All custom layers you've created</li>
								<li>All comments you've posted</li>
							</ul>
							<p className="text-red-600">
								This action cannot be undone. Shared resources that other users
								depend on will be preserved in an anonymized state.
							</p>
							<div className="pt-2">
								<label
									htmlFor="deleteConfirm"
									className="text-sm text-slate-700 block mb-2"
								>
									Type <span className="font-semibold">DELETE</span> to confirm:
								</label>
								<Input
									id="deleteConfirm"
									value={deleteConfirmText}
									onChange={(e) => setDeleteConfirmText(e.target.value)}
									placeholder="DELETE"
									className="uppercase"
								/>
							</div>
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel onClick={() => setDeleteConfirmText("")}>
							Cancel
						</AlertDialogCancel>
						<AlertDialogAction
							onClick={handleDeleteData}
							className="bg-red-600 hover:bg-red-700"
							disabled={deleteConfirmText !== "DELETE"}
						>
							Delete My Data
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}

export function SettingsDialog({
	open,
	onOpenChange,
	isClerkConfigured = false,
}: SettingsDialogProps) {
	// Fallback state when Clerk is not configured - must be declared at top level
	const [language, setLanguage] = useState("en");
	const [textSize, setTextSize] = useState("medium");
	const [darkMode, setDarkMode] = useState(false);

	// Only use Clerk hook if Clerk is configured
	if (isClerkConfigured) {
		return <SettingsDialogContent open={open} onOpenChange={onOpenChange} />;
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-2xl">
				<DialogHeader>
					<DialogTitle>Settings</DialogTitle>
					<DialogDescription>
						Manage your account and preferences
					</DialogDescription>
				</DialogHeader>

				<Tabs defaultValue="account" className="w-full">
					<TabsList className="grid w-full grid-cols-3">
						<TabsTrigger value="account">My Account</TabsTrigger>
						<TabsTrigger value="preferences">Preferences</TabsTrigger>
						<TabsTrigger value="about">About</TabsTrigger>
					</TabsList>

					{/* My Account Tab */}
					<TabsContent value="account" className="space-y-4 mt-4">
						{/* Account Section */}
						<div className="space-y-3">
							<h3 className="text-sm text-slate-900 flex items-center gap-2">
								<Shield className="w-4 h-4 text-teal-600" />
								Account Information
							</h3>
							<p className="text-sm text-slate-500">
								Please sign in to view account settings
							</p>
						</div>

						<Separator />

						{/* Data Management Section */}
						<div className="space-y-3">
							<h3 className="text-sm text-slate-900 flex items-center gap-2">
								<Info className="w-4 h-4 text-teal-600" />
								Data Management
							</h3>

							<div className="space-y-2">
								<Button
									variant="outline"
									size="sm"
									className="w-full justify-start hover:border-teal-400 hover:bg-white"
									disabled={true}
								>
									<Download className="w-4 h-4" />
									Export My Data
								</Button>

								<Button
									variant="outline"
									size="sm"
									className="w-full justify-start text-red-600 hover:text-red-700 hover:border-red-400 hover:bg-red-50"
									disabled={true}
								>
									<Trash2 className="w-4 h-4" />
									Delete My Data
								</Button>
							</div>

							<p className="text-xs text-slate-500">
								Sign in to export or delete your data.
							</p>
						</div>
					</TabsContent>

					{/* Preferences Tab */}
					<TabsContent value="preferences" className="space-y-4 mt-4">
						{/* Language Settings */}
						<div className="space-y-3">
							<h3 className="text-sm text-slate-900 flex items-center gap-2">
								<Globe className="w-4 h-4 text-teal-600" />
								Language
							</h3>
							<div className="space-y-2">
								<Label htmlFor="language" className="text-xs text-slate-500">
									Interface Language
								</Label>
								<Select
									value={language}
									onValueChange={(value) => {
										setLanguage(value);
										toast.success("Language preference updated");
									}}
								>
									<SelectTrigger id="language">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="en">English</SelectItem>
										<SelectItem value="sv">Svenska (Swedish)</SelectItem>
										<SelectItem value="fi">Suomi (Finnish)</SelectItem>
										<SelectItem value="de">Deutsch (German)</SelectItem>
										<SelectItem value="es">Español (Spanish)</SelectItem>
										<SelectItem value="fr">Français (French)</SelectItem>
									</SelectContent>
								</Select>
							</div>
						</div>

						<Separator />

						{/* Text Size Settings */}
						<div className="space-y-3">
							<h3 className="text-sm text-slate-900 flex items-center gap-2">
								<Type className="w-4 h-4 text-teal-600" />
								Text Size
							</h3>
							<div className="space-y-2">
								<Label htmlFor="textSize" className="text-xs text-slate-500">
									Interface Text Size
								</Label>
								<Select
									value={textSize}
									onValueChange={(value) => {
										setTextSize(value);
										toast.success("Text size preference updated");
									}}
								>
									<SelectTrigger id="textSize">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="small">Small</SelectItem>
										<SelectItem value="medium">Medium (Default)</SelectItem>
										<SelectItem value="large">Large</SelectItem>
										<SelectItem value="extra-large">Extra Large</SelectItem>
									</SelectContent>
								</Select>
								<p className="text-xs text-slate-500">
									Changes the size of text throughout the application
								</p>
							</div>
						</div>

						<Separator />

						{/* Dark Mode Settings */}
						<div className="space-y-3">
							<h3 className="text-sm text-slate-900 flex items-center gap-2">
								<Moon className="w-4 h-4 text-teal-600" />
								Appearance
							</h3>
							<div className="flex items-center justify-between">
								<div className="space-y-0.5">
									<Label htmlFor="darkMode" className="text-sm text-slate-900">
										Dark Mode
									</Label>
									<p className="text-xs text-slate-500">
										Use dark theme for the interface
									</p>
								</div>
								<Switch
									id="darkMode"
									checked={darkMode}
									onCheckedChange={(checked) => {
										setDarkMode(checked);
										toast.success(
											`Dark mode ${checked ? "enabled" : "disabled"}`,
										);
									}}
								/>
							</div>
						</div>

						<Separator />

						{/* Map Preferences */}
						<div className="space-y-3">
							<h3 className="text-sm text-slate-900 flex items-center gap-2">
								<Settings2 className="w-4 h-4 text-teal-600" />
								Map Preferences
							</h3>
							<div className="space-y-3">
								<div className="flex items-center justify-between">
									<div className="space-y-0.5">
										<Label className="text-sm text-slate-900">
											Show Coordinates
										</Label>
										<p className="text-xs text-slate-500">
											Display coordinates on mouse hover
										</p>
									</div>
									<Switch defaultChecked />
								</div>
								<div className="flex items-center justify-between">
									<div className="space-y-0.5">
										<Label className="text-sm text-slate-900">
											Enable Animations
										</Label>
										<p className="text-xs text-slate-500">
											Smooth transitions and animations
										</p>
									</div>
									<Switch defaultChecked />
								</div>
							</div>
						</div>
					</TabsContent>

					{/* About Tab */}
					<TabsContent value="about" className="space-y-4 mt-4">
						<div className="space-y-4">
							<div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
								<div>
									<h3 className="text-sm text-slate-900">SamSyn</h3>
									<p className="text-xs text-slate-500">
										Marine Spatial Planning & Stakeholder Engagement Platform
									</p>
								</div>
								<Separator />
								<div>
									<p className="text-xs text-slate-500">Version</p>
									<p className="text-sm text-slate-900">1.0.0</p>
								</div>
								<div>
									<p className="text-xs text-slate-500">Last Updated</p>
									<p className="text-sm text-slate-900">November 2025</p>
								</div>
							</div>

							<Separator />

							<div className="space-y-2">
								<h3 className="text-sm text-slate-900">Legal</h3>
								<div className="flex gap-2">
									<Button
										variant="link"
										size="sm"
										className="h-auto p-0 text-xs text-teal-600 hover:text-teal-700"
										onClick={() => window.open("/privacy", "_blank")}
									>
										Privacy Policy
									</Button>
									<span className="text-xs text-slate-300">•</span>
									<Button
										variant="link"
										size="sm"
										className="h-auto p-0 text-xs text-teal-600 hover:text-teal-700"
										onClick={() => window.open("/terms", "_blank")}
									>
										Terms of Service
									</Button>
								</div>
							</div>

							<Separator />

							<div className="space-y-2">
								<h3 className="text-sm text-slate-900">Support</h3>
								<p className="text-xs text-slate-500">
									For technical support or questions, please contact us at{" "}
									<a
										href="mailto:support@samsyn.app"
										className="text-teal-600 hover:text-teal-700"
									>
										support@samsyn.app
									</a>
								</p>
							</div>
						</div>
					</TabsContent>
				</Tabs>
			</DialogContent>
		</Dialog>
	);
}

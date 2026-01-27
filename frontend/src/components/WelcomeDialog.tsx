import { Info } from "lucide-react";
import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogTitle,
} from "./ui/dialog";
import { Label } from "./ui/label";

interface WelcomeDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function WelcomeDialog({ open, onOpenChange }: WelcomeDialogProps) {
	const [dontShowAgain, setDontShowAgain] = useState(false);

	const handleGetStarted = () => {
		if (dontShowAgain) {
			try {
				localStorage.setItem("samsyn-welcome-shown", "true");
			} catch (error) {
				console.error("Failed to save welcome state:", error);
			}
		}
		onOpenChange(false);
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				className="max-w-lg"
				onPointerDownOutside={(e: Event) => e.preventDefault()}
			>
				<DialogTitle className="text-slate-900 text-xl font-semibold">
					<span className="text-teal-600" style={{ fontWeight: 700 }}>
						SAMSYN
					</span>
				</DialogTitle>
				<DialogDescription className="text-base text-slate-600">
					Marine spatial planning and stakeholder engagement platform
				</DialogDescription>

				<div className="space-y-4 pt-2">
					{/* Prototype Notice Alert */}
					<Alert className="border-slate-200 bg-slate-50">
						<Info className="h-4 w-4 text-teal-600" />
						<AlertTitle className="text-base font-medium text-slate-900">
							Prototype Notice
						</AlertTitle>
						<AlertDescription className="text-base text-slate-600 leading-relaxed">
							This is a prototype version. You may encounter bugs or unexpected
							behavior. We welcome your feedback to help improve the platform.
						</AlertDescription>
					</Alert>

					{/* Do not show again checkbox */}
					<div className="flex items-center gap-3 pt-2">
						<Checkbox
							id="dontShowAgain"
							checked={dontShowAgain}
							onCheckedChange={(checked: boolean) =>
								setDontShowAgain(checked === true)
							}
						/>
						<Label
							htmlFor="dontShowAgain"
							className="text-base text-slate-500 cursor-pointer font-normal ml-1"
						>
							Do not show this message again
						</Label>
					</div>

					{/* Get Started Button */}
					<div className="flex justify-end pt-2">
						<Button onClick={handleGetStarted}>Get Started</Button>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}

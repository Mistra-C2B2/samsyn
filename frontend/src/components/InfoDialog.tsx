import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "./ui/dialog";

interface InfoDialogSection {
	key?: string;
	title?: string;
	content?: React.ReactNode;
	render?: () => React.ReactNode;
	className?: string;
	breakWords?: boolean;
}

interface InfoDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	title: string;
	subtitle?: string;
	sections: (InfoDialogSection | undefined)[];
	maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl";
	enableScrolling?: boolean;
	maxHeight?: string;
}

const maxWidthClasses = {
	sm: "max-w-sm",
	md: "max-w-md",
	lg: "max-w-lg",
	xl: "max-w-xl",
	"2xl": "max-w-2xl",
};

export function InfoDialog({
	open,
	onOpenChange,
	title,
	subtitle,
	sections,
	maxWidth = "md",
	enableScrolling = false,
	maxHeight,
}: InfoDialogProps) {
	const validSections = sections.filter(Boolean) as InfoDialogSection[];

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className={maxWidthClasses[maxWidth]}>
				<DialogHeader>
					<DialogTitle className="break-words">{title}</DialogTitle>
					{subtitle && (
						<DialogDescription className="break-words">
							{subtitle}
						</DialogDescription>
					)}
				</DialogHeader>
				<div
					className={`space-y-4 py-4 ${enableScrolling ? "overflow-y-auto" : ""}`}
					style={maxHeight ? { maxHeight } : undefined}
				>
					{validSections.map((section, index) => {
						const shouldBreakWords = section.breakWords !== false;
						const key = section.key || section.title || `section-${index}`;

						return (
							<div key={key} className={section.className || ""}>
								{section.title && (
									<h4 className="text-sm text-slate-700 mb-1">
										{section.title}
									</h4>
								)}
								{section.render ? (
									section.render()
								) : (
									<div
										className={`text-sm text-slate-600 ${shouldBreakWords ? "break-words" : ""}`}
									>
										{section.content}
									</div>
								)}
							</div>
						);
					})}
				</div>
			</DialogContent>
		</Dialog>
	);
}

import { Crown, Eye, Pencil } from "lucide-react";
import { Badge } from "./ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

interface RoleBadgeProps {
	role?: string | null;
}

const roleConfig = {
	owner: {
		label: "Owner",
		icon: Crown,
		className: "bg-teal-100 text-teal-700 border-teal-200 hover:bg-teal-200",
		description: "You own this map and have full control over it",
	},
	editor: {
		label: "Editor",
		icon: Pencil,
		className: "bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200",
		description: "You can edit this map and its layers",
	},
	viewer: {
		label: "Viewer",
		icon: Eye,
		className: "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200",
		description: "You can view this map but cannot edit it",
	},
};

export function RoleBadge({ role }: RoleBadgeProps) {
	// Don't render anything if there's no role
	if (!role || !(role in roleConfig)) {
		return null;
	}

	const config = roleConfig[role as keyof typeof roleConfig];
	const Icon = config.icon;

	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<Badge variant="outline" className={config.className}>
					<Icon className="w-3 h-3" />
					{config.label}
				</Badge>
			</TooltipTrigger>
			<TooltipContent>
				<p>{config.description}</p>
			</TooltipContent>
		</Tooltip>
	);
}

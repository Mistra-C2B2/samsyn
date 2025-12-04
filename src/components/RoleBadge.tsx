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
		className: "bg-teal-500 text-white border-teal-500 hover:bg-teal-600",
		description: "You own this map and have full control over it",
	},
	editor: {
		label: "Editor",
		icon: Pencil,
		className: "bg-blue-500 text-white border-blue-500 hover:bg-blue-600",
		description: "You can edit this map and its layers",
	},
	viewer: {
		label: "Viewer",
		icon: Eye,
		className: "bg-slate-400 text-white border-slate-400 hover:bg-slate-500",
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
				<Badge className={config.className}>
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

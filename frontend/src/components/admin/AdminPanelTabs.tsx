import { cn } from "../ui/utils";

export type AdminTab = "wms-servers" | "library-layers" | "community-layers";

interface AdminPanelTabsProps {
	activeTab: AdminTab;
	onTabChange: (tab: AdminTab) => void;
}

export function AdminPanelTabs({
	activeTab,
	onTabChange,
}: AdminPanelTabsProps) {
	return (
		<div className="flex border-b border-slate-200">
			<button
				type="button"
				onClick={() => onTabChange("wms-servers")}
				className={cn(
					"flex-1 px-3 py-2 text-xs font-medium transition-colors",
					activeTab === "wms-servers"
						? "text-teal-700 border-b-2 border-teal-600 bg-teal-50/50"
						: "text-slate-600 hover:text-slate-900 hover:bg-slate-50",
				)}
			>
				WMS Servers
			</button>
			<button
				type="button"
				onClick={() => onTabChange("library-layers")}
				className={cn(
					"flex-1 px-3 py-2 text-xs font-medium transition-colors",
					activeTab === "library-layers"
						? "text-teal-700 border-b-2 border-teal-600 bg-teal-50/50"
						: "text-slate-600 hover:text-slate-900 hover:bg-slate-50",
				)}
			>
				Library Layers
			</button>
			<button
				type="button"
				onClick={() => onTabChange("community-layers")}
				className={cn(
					"flex-1 px-3 py-2 text-xs font-medium transition-colors",
					activeTab === "community-layers"
						? "text-teal-700 border-b-2 border-teal-600 bg-teal-50/50"
						: "text-slate-600 hover:text-slate-900 hover:bg-slate-50",
				)}
			>
				Community Layers
			</button>
		</div>
	);
}

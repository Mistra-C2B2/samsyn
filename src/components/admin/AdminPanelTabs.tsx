import { cn } from "../ui/utils";

interface AdminPanelTabsProps {
	activeTab: "wms-servers" | "layers";
	onTabChange: (tab: "wms-servers" | "layers") => void;
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
					"flex-1 px-4 py-2 text-sm font-medium transition-colors",
					activeTab === "wms-servers"
						? "text-teal-700 border-b-2 border-teal-600 bg-teal-50/50"
						: "text-slate-600 hover:text-slate-900 hover:bg-slate-50",
				)}
			>
				WMS Servers
			</button>
			<button
				type="button"
				onClick={() => onTabChange("layers")}
				className={cn(
					"flex-1 px-4 py-2 text-sm font-medium transition-colors",
					activeTab === "layers"
						? "text-teal-700 border-b-2 border-teal-600 bg-teal-50/50"
						: "text-slate-600 hover:text-slate-900 hover:bg-slate-50",
				)}
			>
				Layers
			</button>
		</div>
	);
}

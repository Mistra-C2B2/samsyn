import {
	ExternalLink,
	Layers,
	Loader2,
	Pencil,
	RefreshCw,
	Trash2,
} from "lucide-react";
import type { WmsServer } from "@/services/wmsServerService";
import { Button } from "../ui/button";

interface WmsServerListProps {
	servers: WmsServer[];
	serverToDelete: WmsServer | null;
	refreshingServerId: string | null;
	onBrowseLayers: (server: WmsServer) => void;
	onEdit: (server: WmsServer) => void;
	onRefresh: (server: WmsServer) => void;
	onDeleteRequest: (server: WmsServer) => void;
	onDeleteConfirm: () => void;
	onDeleteCancel: () => void;
}

export function WmsServerList({
	servers,
	serverToDelete,
	refreshingServerId,
	onBrowseLayers,
	onEdit,
	onRefresh,
	onDeleteRequest,
	onDeleteConfirm,
	onDeleteCancel,
}: WmsServerListProps) {
	if (servers.length === 0) {
		return (
			<div className="flex-1 flex items-center justify-center p-8">
				<p className="text-slate-500 text-sm text-center">
					No WMS servers saved yet.
					<br />
					Add a server to get started.
				</p>
			</div>
		);
	}

	return (
		<div className="flex-1 overflow-y-auto">
			{servers.map((server) => (
				<div
					key={server.id}
					className="border-b border-slate-200 p-4 hover:bg-slate-50"
				>
					{/* Server Info */}
					<div className="flex items-start justify-between mb-2">
						<div className="flex-1 min-w-0">
							<h3 className="font-medium text-slate-900 truncate">
								{server.name}
							</h3>
							<p
								className="text-xs text-slate-500 truncate"
								title={server.baseUrl}
							>
								{server.baseUrl}
							</p>
						</div>
					</div>

					{/* Server Metadata */}
					<div className="flex items-center gap-3 text-xs text-slate-600 mb-3">
						<span className="flex items-center gap-1">
							<Layers className="w-3 h-3" />
							{server.layerCount} layers
						</span>
						{server.version && (
							<span className="text-slate-400">v{server.version}</span>
						)}
						{server.serviceProvider && (
							<span
								className="truncate text-slate-400"
								title={server.serviceProvider}
							>
								{server.serviceProvider}
							</span>
						)}
					</div>

					{/* Delete Confirmation */}
					{serverToDelete?.id === server.id ? (
						<div className="flex items-center gap-2 p-2 bg-red-50 rounded border border-red-200">
							<span className="text-xs text-red-700 flex-1">
								Delete this server?
							</span>
							<Button
								size="sm"
								variant="destructive"
								onClick={onDeleteConfirm}
								className="h-6 px-2 text-xs"
							>
								Delete
							</Button>
							<Button
								size="sm"
								variant="outline"
								onClick={onDeleteCancel}
								className="h-6 px-2 text-xs"
							>
								Cancel
							</Button>
						</div>
					) : (
						<div className="flex items-center gap-2">
							<Button
								size="sm"
								variant="default"
								onClick={() => onBrowseLayers(server)}
								className="h-7 text-xs"
							>
								<ExternalLink className="w-3 h-3 mr-1" />
								Browse Layers
							</Button>
							<Button
								size="sm"
								variant="outline"
								onClick={() => onRefresh(server)}
								disabled={refreshingServerId === server.id}
								className="h-7 px-2"
								title="Refresh capabilities"
							>
								{refreshingServerId === server.id ? (
									<Loader2 className="w-3 h-3 animate-spin" />
								) : (
									<RefreshCw className="w-3 h-3" />
								)}
							</Button>
							<Button
								size="sm"
								variant="outline"
								onClick={() => onEdit(server)}
								className="h-7 px-2"
								title="Edit server"
							>
								<Pencil className="w-3 h-3" />
							</Button>
							<Button
								size="sm"
								variant="outline"
								onClick={() => onDeleteRequest(server)}
								className="h-7 px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
								title="Delete server"
							>
								<Trash2 className="w-3 h-3" />
							</Button>
						</div>
					)}
				</div>
			))}
		</div>
	);
}

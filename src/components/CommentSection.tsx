import { useUser } from "@clerk/clerk-react";
import {
	Check,
	CheckCircle,
	Loader2,
	Pencil,
	Send,
	Trash2,
	X,
} from "lucide-react";
import { useState } from "react";
import type { Layer } from "../App";
import type { CommentResponse } from "../types/api";
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
import { Avatar, AvatarFallback } from "./ui/avatar";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "./ui/select";
import { Textarea } from "./ui/textarea";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "./ui/tooltip";

interface CommentSectionProps {
	mapId: string;
	mapName: string;
	layers: Layer[];
	initialLayerId?: string | null;
	comments: CommentResponse[];
	loading?: boolean;
	error?: string | null;
	mapUserRole?: string | null; // "owner", "editor", "viewer", or null
	onAddComment: (comment: {
		content: string;
		map_id?: string;
		layer_id?: string;
		parent_id?: string;
	}) => void;
	onEditComment?: (commentId: string, content: string) => void;
	onDeleteComment?: (commentId: string) => void;
	onResolveComment?: (commentId: string, isResolved: boolean) => void;
	onClose: () => void;
}

interface CommentItemProps {
	comment: CommentResponse & { replies?: CommentResponse[] };
	onReply: (commentId: string) => void;
	onEdit?: (commentId: string, content: string) => void;
	onDelete?: (commentId: string) => void;
	onResolve?: (commentId: string, isResolved: boolean) => void;
	currentUserId?: string | null;
	canResolve?: boolean; // Only map owners can resolve comments
	depth?: number;
}

function CommentItem({
	comment,
	onReply,
	onEdit,
	onDelete,
	onResolve,
	currentUserId,
	canResolve = false,
	depth = 0,
}: CommentItemProps) {
	const [collapsed, setCollapsed] = useState(false);
	const [isEditing, setIsEditing] = useState(false);
	const [editContent, setEditContent] = useState(comment.content);
	const [showDeleteDialog, setShowDeleteDialog] = useState(false);

	const formatTimestamp = (dateString: string) => {
		const date = new Date(dateString);
		const now = new Date();
		const diff = now.getTime() - date.getTime();
		const hours = Math.floor(diff / (1000 * 60 * 60));
		const days = Math.floor(diff / (1000 * 60 * 60 * 24));

		if (days > 0) return `${days}d ago`;
		if (hours > 0) return `${hours}h ago`;
		return "Just now";
	};

	// Check if this comment has nested replies in the tree we built
	const hasReplies = comment.replies && comment.replies.length > 0;
	const authorName = comment.author_name || "Unknown User";
	const isOwner = currentUserId && comment.author_id === currentUserId;

	// Generate initials from author name
	const getInitials = (name: string) => {
		return name
			.split(" ")
			.map((n) => n[0])
			.join("")
			.toUpperCase()
			.slice(0, 2);
	};

	const handleSaveEdit = () => {
		if (editContent.trim() && onEdit) {
			onEdit(comment.id, editContent.trim());
			setIsEditing(false);
		}
	};

	const handleCancelEdit = () => {
		setEditContent(comment.content);
		setIsEditing(false);
	};

	const handleDelete = () => {
		if (onDelete) {
			onDelete(comment.id);
			setShowDeleteDialog(false);
		}
	};

	const handleResolve = () => {
		if (onResolve) {
			onResolve(comment.id, !comment.is_resolved);
		}
	};

	return (
		<div className="space-y-2">
			<div
				className={`flex items-start gap-3 ${comment.is_resolved ? "opacity-60" : ""}`}
			>
				{hasReplies && (
					<button
						type="button"
						onClick={() => setCollapsed(!collapsed)}
						className="p-0 h-auto hover:bg-transparent flex-shrink-0 mt-1 text-slate-400 hover:text-slate-600"
					>
						{collapsed ? "▶" : "▼"}
					</button>
				)}
				{!hasReplies && depth > 0 && <div className="w-4" />}
				<Avatar className="w-8 h-8 flex-shrink-0">
					<AvatarFallback className="bg-slate-200 text-slate-600 text-xs">
						{getInitials(authorName)}
					</AvatarFallback>
				</Avatar>
				<div className="flex-1 min-w-0">
					<div className="flex items-center gap-2 flex-wrap">
						<span className="text-sm text-slate-900">{authorName}</span>
						<span className="text-xs text-slate-400">
							{formatTimestamp(comment.created_at)}
						</span>
						{comment.is_resolved && (
							<Badge
								variant="outline"
								className="text-[10px] px-1.5 py-0 h-4 bg-green-50 text-green-700 border-green-200"
							>
								<CheckCircle className="w-2.5 h-2.5 mr-0.5" />
								Resolved
							</Badge>
						)}
					</div>

					{isEditing ? (
						<div className="mt-2 space-y-2">
							<Textarea
								value={editContent}
								onChange={(e) => setEditContent(e.target.value)}
								rows={2}
								className="text-sm"
							/>
							<div className="flex gap-2">
								<Button size="sm" onClick={handleSaveEdit}>
									<Check className="w-3 h-3 mr-1" />
									Save
								</Button>
								<Button size="sm" variant="ghost" onClick={handleCancelEdit}>
									Cancel
								</Button>
							</div>
						</div>
					) : (
						<p
							className={`text-sm text-slate-600 mt-1 ${comment.is_resolved ? "line-through" : ""}`}
						>
							{comment.content}
						</p>
					)}

					{!isEditing && (
						<div className="flex items-center gap-1 mt-1">
							<Button
								variant="ghost"
								size="sm"
								onClick={() => onReply(comment.id)}
								className="h-auto p-1 text-xs text-slate-500 hover:text-teal-600"
							>
								Reply {comment.reply_count > 0 && `(${comment.reply_count})`}
							</Button>

							{/* Only show resolve button for top-level comments and only for map owners */}
							{onResolve && !comment.parent_id && canResolve && (
								<TooltipProvider>
									<Tooltip>
										<TooltipTrigger asChild>
											<span className="inline-block">
												<Button
													variant="ghost"
													size="sm"
													onClick={handleResolve}
													className={`h-auto p-1 text-xs ${
														comment.is_resolved
															? "text-green-600 hover:text-green-700"
															: "text-slate-500 hover:text-green-600"
													}`}
												>
													<CheckCircle className="w-3 h-3" />
												</Button>
											</span>
										</TooltipTrigger>
										<TooltipContent>
											<p>
												{comment.is_resolved
													? "Mark as unresolved"
													: "Mark as resolved"}
											</p>
										</TooltipContent>
									</Tooltip>
								</TooltipProvider>
							)}

							{isOwner && onEdit && (
								<TooltipProvider>
									<Tooltip>
										<TooltipTrigger asChild>
											<span className="inline-block">
												<Button
													variant="ghost"
													size="sm"
													onClick={() => setIsEditing(true)}
													className="h-auto p-1 text-xs text-slate-500 hover:text-blue-600"
												>
													<Pencil className="w-3 h-3" />
												</Button>
											</span>
										</TooltipTrigger>
										<TooltipContent>
											<p>Edit comment</p>
										</TooltipContent>
									</Tooltip>
								</TooltipProvider>
							)}

							{isOwner && onDelete && (
								<TooltipProvider>
									<Tooltip>
										<TooltipTrigger asChild>
											<span className="inline-block">
												<Button
													variant="ghost"
													size="sm"
													onClick={() => setShowDeleteDialog(true)}
													className="h-auto p-1 text-xs text-slate-500 hover:text-red-600"
												>
													<Trash2 className="w-3 h-3" />
												</Button>
											</span>
										</TooltipTrigger>
										<TooltipContent>
											<p>Delete comment</p>
										</TooltipContent>
									</Tooltip>
								</TooltipProvider>
							)}
						</div>
					)}
				</div>
			</div>

			{/* Delete confirmation dialog */}
			<AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete comment?</AlertDialogTitle>
						<AlertDialogDescription>
							This will permanently delete this comment
							{hasReplies ? " and all its replies" : ""}. This action cannot be
							undone.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							onClick={handleDelete}
							className="bg-red-600 hover:bg-red-700"
						>
							Delete
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			{/* Nested replies */}
			{hasReplies && !collapsed && (
				<div className="ml-8 pl-4 border-l-2 border-slate-200 space-y-3">
					{comment.replies?.map((reply) => (
						<CommentItem
							key={reply.id}
							comment={reply}
							onReply={onReply}
							onEdit={onEdit}
							onDelete={onDelete}
							onResolve={onResolve}
							currentUserId={currentUserId}
							canResolve={canResolve}
							depth={depth + 1}
						/>
					))}
				</div>
			)}
		</div>
	);
}

export function CommentSection({
	mapId,
	mapName,
	layers,
	initialLayerId,
	comments,
	loading,
	error,
	mapUserRole,
	onAddComment,
	onEditComment,
	onDeleteComment,
	onResolveComment,
	onClose,
}: CommentSectionProps) {
	const [newComment, setNewComment] = useState("");
	const [commentTarget, setCommentTarget] = useState<string>(
		initialLayerId || mapId,
	);
	const [replyingTo, setReplyingTo] = useState<string | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const { isSignedIn, user } = useUser();

	// Get current user's internal ID from Clerk user metadata or ID
	// Note: This assumes the backend stores Clerk user ID as author_id
	// If the backend uses a different user ID system, this will need adjustment
	const currentUserId = user?.id || null;

	// Only map owners can resolve comments
	const canResolve = mapUserRole === "owner";

	// Loading state
	if (loading) {
		return (
			<div className="absolute right-0 top-0 bottom-0 w-96 bg-white border-l border-slate-200 flex flex-col shadow-lg z-40">
				<div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
					<h2 className="text-slate-900">Comments</h2>
					<Button variant="ghost" size="sm" onClick={onClose}>
						<X />
					</Button>
				</div>
				<div className="flex-1 flex items-center justify-center">
					<Loader2 className="w-6 h-6 animate-spin text-gray-400" />
					<span className="ml-2 text-gray-600">Loading comments...</span>
				</div>
			</div>
		);
	}

	// Error state
	if (error) {
		return (
			<div className="absolute right-0 top-0 bottom-0 w-96 bg-white border-l border-slate-200 flex flex-col shadow-lg z-40">
				<div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
					<h2 className="text-slate-900">Comments</h2>
					<Button variant="ghost" size="sm" onClick={onClose}>
						<X />
					</Button>
				</div>
				<div className="flex-1 flex items-center justify-center p-4">
					<div className="text-center">
						<p className="text-red-600 mb-2">Error loading comments</p>
						<p className="text-sm text-gray-600">{error}</p>
					</div>
				</div>
			</div>
		);
	}

	// Simple inline SVG icons to match lucide-react style
	const MapIcon = () => (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width="16"
			height="16"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			className="flex-shrink-0"
			aria-hidden="true"
		>
			<polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
			<line x1="9" y1="3" x2="9" y2="18" />
			<line x1="15" y1="6" x2="15" y2="21" />
		</svg>
	);

	const LayersIcon = () => (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width="16"
			height="16"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			className="flex-shrink-0"
			aria-hidden="true"
		>
			<polygon points="12 2 2 7 12 12 22 7 12 2" />
			<polyline points="2 17 12 22 22 17" />
			<polyline points="2 12 12 17 22 12" />
		</svg>
	);

	// Build nested comment tree from flat list using parent_id
	const buildCommentTree = (
		comments: CommentResponse[],
	): (CommentResponse & { replies?: CommentResponse[] })[] => {
		const commentMap = new Map<
			string,
			CommentResponse & { replies?: CommentResponse[] }
		>();
		const rootComments: (CommentResponse & { replies?: CommentResponse[] })[] =
			[];

		// First pass: create a map of all comments with empty replies arrays
		comments.forEach((comment) => {
			commentMap.set(comment.id, { ...comment, replies: [] });
		});

		// Second pass: organize into tree structure
		comments.forEach((comment) => {
			const commentWithReplies = commentMap.get(comment.id);
			if (!commentWithReplies) return;

			if (comment.parent_id) {
				const parent = commentMap.get(comment.parent_id);
				if (parent?.replies) {
					parent.replies.push(commentWithReplies);
				} else {
					// If parent not found, treat as root comment
					rootComments.push(commentWithReplies);
				}
			} else {
				rootComments.push(commentWithReplies);
			}
		});

		return rootComments;
	};

	// Filter comments based on selected target using backend field names
	const filteredComments = comments.filter((comment) => {
		if (commentTarget === mapId) {
			// Show comments on the map (map_id matches and layer_id is null)
			return comment.map_id === mapId && comment.layer_id === null;
		} else {
			// Show comments on specific layer
			return comment.layer_id === commentTarget;
		}
	});
	const commentTree = buildCommentTree(filteredComments);

	// Get comment count for a specific target (including replies)
	const getCommentCount = (targetId: string) => {
		if (targetId === mapId) {
			return comments.filter((c) => c.map_id === mapId && c.layer_id === null)
				.length;
		} else {
			return comments.filter((c) => c.layer_id === targetId).length;
		}
	};

	const handleSubmit = () => {
		if (newComment.trim()) {
			setIsSubmitting(true);
			onAddComment({
				content: newComment,
				map_id: commentTarget === mapId ? mapId : undefined,
				layer_id: commentTarget === mapId ? undefined : commentTarget,
				parent_id: replyingTo || undefined,
			});
			setNewComment("");
			setReplyingTo(null);
			setIsSubmitting(false);
		}
	};

	const currentTargetName =
		commentTarget === mapId
			? mapName
			: layers.find((l) => l.id === commentTarget)?.name || "Unknown";

	// Get the comment being replied to
	const replyingToComment = replyingTo
		? comments.find((c) => c.id === replyingTo)
		: null;
	const replyingToAuthor = replyingToComment?.author_name || "Unknown User";

	return (
		<div className="absolute right-0 top-0 bottom-0 w-96 bg-white border-l border-slate-200 flex flex-col shadow-lg z-40">
			<div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
				<h2 className="text-slate-900">Comments</h2>
				<Button variant="ghost" size="sm" onClick={onClose}>
					<X />
				</Button>
			</div>

			{/* Context Selector */}
			<div className="px-4 py-3 border-b border-slate-200 space-y-2">
				<label htmlFor="commentTarget" className="text-xs text-slate-600">
					Commenting on:
				</label>
				<Select onValueChange={setCommentTarget} value={commentTarget}>
					<SelectTrigger id="commentTarget" className="w-full">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value={mapId}>
							<div className="flex items-center gap-2">
								<MapIcon />
								<span>{mapName}</span>
								{getCommentCount(mapId) > 0 && (
									<span className="ml-auto text-xs text-slate-500">
										({getCommentCount(mapId)})
									</span>
								)}
							</div>
						</SelectItem>
						{layers.map((layer) => (
							<SelectItem key={layer.id} value={layer.id}>
								<div className="flex items-center gap-2">
									<LayersIcon />
									<span>{layer.name}</span>
									{getCommentCount(layer.id) > 0 && (
										<span className="ml-auto text-xs text-slate-500">
											({getCommentCount(layer.id)})
										</span>
									)}
								</div>
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>

			<div className="flex-1 overflow-y-auto p-4 space-y-4">
				{commentTree.map((comment) => (
					<CommentItem
						key={comment.id}
						comment={comment}
						onReply={setReplyingTo}
						onEdit={onEditComment}
						onDelete={onDeleteComment}
						onResolve={onResolveComment}
						currentUserId={currentUserId}
						canResolve={canResolve}
					/>
				))}

				{filteredComments.length === 0 && (
					<p className="text-slate-500 text-sm text-center py-8">
						No comments on "{currentTargetName}" yet. Be the first to comment!
					</p>
				)}
			</div>

			<div className="p-4 border-t border-slate-200 space-y-2">
				{replyingToComment && (
					<div className="p-2 bg-slate-50 border border-slate-200 rounded text-xs">
						<div className="flex items-center justify-between mb-1">
							<span className="text-slate-500">
								Replying to{" "}
								<span className="font-medium text-slate-700">
									{replyingToAuthor}
								</span>
							</span>
							<Button
								variant="ghost"
								size="sm"
								onClick={() => setReplyingTo(null)}
								className="h-auto p-0 text-slate-400 hover:text-slate-600"
							>
								✕
							</Button>
						</div>
						<p className="text-slate-600 line-clamp-2">
							{replyingToComment.content}
						</p>
					</div>
				)}
				<Textarea
					placeholder={
						replyingToComment ? "Write your reply..." : "Add a comment..."
					}
					value={newComment}
					onChange={(e) => setNewComment(e.target.value)}
					rows={3}
					onKeyDown={(e) => {
						if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
							handleSubmit();
						}
					}}
					disabled={!isSignedIn}
				/>
				<TooltipProvider>
					<Tooltip>
						<TooltipTrigger asChild>
							<span className="w-full inline-block">
								<Button
									onClick={handleSubmit}
									className="w-full"
									disabled={!newComment.trim() || isSubmitting || !isSignedIn}
								>
									{isSubmitting ? (
										<>
											<Loader2 className="w-4 h-4 animate-spin" />
											Posting...
										</>
									) : (
										<>
											<Send className="w-4 h-4" />
											{replyingToComment ? "Post Reply" : "Post Comment"}
										</>
									)}
								</Button>
							</span>
						</TooltipTrigger>
						{!isSignedIn && (
							<TooltipContent>
								<p>Please sign in to comment.</p>
							</TooltipContent>
						)}
					</Tooltip>
				</TooltipProvider>
			</div>
		</div>
	);
}

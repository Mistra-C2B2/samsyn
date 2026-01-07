import { Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "./ui/select";

interface CategorySelectorProps {
	value: string;
	onChange: (value: string) => void;
	existingCategories: string[];
	label?: string;
	required?: boolean;
}

export function CategorySelector({
	value,
	onChange,
	existingCategories,
	label = "Category",
	required = false,
}: CategorySelectorProps) {
	const [isAddingNew, setIsAddingNew] = useState(false);
	const [newCategory, setNewCategory] = useState("");

	const handleAddNewCategory = () => {
		if (newCategory.trim()) {
			onChange(newCategory.trim());
			setNewCategory("");
			setIsAddingNew(false);
		}
	};

	const handleSelectChange = (selectedValue: string) => {
		if (selectedValue === "__add_new__") {
			setIsAddingNew(true);
		} else {
			onChange(selectedValue);
		}
	};

	if (isAddingNew) {
		return (
			<div className="space-y-2">
				<Label htmlFor="newCategory">{label} (New)</Label>
				<div className="flex gap-2">
					<Input
						id="newCategory"
						value={newCategory}
						onChange={(e) => setNewCategory(e.target.value)}
						placeholder="Enter new category"
						onKeyDown={(e) => {
							if (e.key === "Enter") {
								handleAddNewCategory();
							} else if (e.key === "Escape") {
								setIsAddingNew(false);
								setNewCategory("");
							}
						}}
						autoFocus
					/>
					<Button
						variant="outline"
						size="sm"
						onClick={handleAddNewCategory}
						disabled={!newCategory.trim()}
					>
						Add
					</Button>
					<Button
						variant="ghost"
						size="sm"
						onClick={() => {
							setIsAddingNew(false);
							setNewCategory("");
						}}
					>
						Cancel
					</Button>
				</div>
			</div>
		);
	}

	// Include current value if it's not in existingCategories (newly added category)
	const allCategories =
		value && !existingCategories.includes(value)
			? [value, ...existingCategories]
			: existingCategories;

	return (
		<div className="space-y-2">
			<Label htmlFor="category">{label}</Label>
			<Select
				value={
					value && value !== "__none__" ? value : required ? "" : "__none__"
				}
				onValueChange={handleSelectChange}
			>
				<SelectTrigger id="category">
					<SelectValue
						placeholder={
							required ? "Select or add category" : "Select or add category"
						}
					/>
				</SelectTrigger>
				<SelectContent>
					{!required && (
						<SelectItem value="__none__">
							<span className="text-slate-400">No category</span>
						</SelectItem>
					)}
					{allCategories.length > 0 &&
						allCategories.map((cat) => (
							<SelectItem key={cat} value={cat}>
								{cat}
							</SelectItem>
						))}
					<SelectItem value="__add_new__">
						<div className="flex items-center gap-2 text-teal-600">
							<Plus className="w-3 h-3" />
							<span>Add new category</span>
						</div>
					</SelectItem>
				</SelectContent>
			</Select>
		</div>
	);
}

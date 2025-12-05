import { RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Slider } from "./ui/slider";

type TimeScale = "days" | "months" | "years";

interface TimeSliderProps {
	startDate: Date;
	endDate: Date;
	currentRange: [Date, Date];
	onRangeChange: (range: [Date, Date]) => void;
}

export function TimeSlider({
	startDate,
	endDate,
	currentRange,
	onRangeChange,
}: TimeSliderProps) {
	const [sliderValues, setSliderValues] = useState([0, 100]);
	const [scale, setScale] = useState<TimeScale>("months");
	const [customStartDate, setCustomStartDate] = useState(startDate);
	const [customEndDate, setCustomEndDate] = useState(endDate);

	// Use custom dates if set, otherwise use props
	const effectiveStartDate = customStartDate;
	const effectiveEndDate = customEndDate;

	const totalDuration =
		effectiveEndDate.getTime() - effectiveStartDate.getTime();

	useEffect(() => {
		const startPosition =
			currentRange[0].getTime() - effectiveStartDate.getTime();
		const endPosition =
			currentRange[1].getTime() - effectiveStartDate.getTime();
		const newStartValue = (startPosition / totalDuration) * 100;
		const newEndValue = (endPosition / totalDuration) * 100;
		setSliderValues([
			Math.max(0, Math.min(100, newStartValue)),
			Math.max(0, Math.min(100, newEndValue)),
		]);
	}, [currentRange, effectiveStartDate, totalDuration]);

	const handleSliderChange = (values: number[]) => {
		setSliderValues(values);
		const startPosition = (values[0] / 100) * totalDuration;
		const endPosition = (values[1] / 100) * totalDuration;
		let newStartTime = new Date(effectiveStartDate.getTime() + startPosition);
		let newEndTime = new Date(effectiveStartDate.getTime() + endPosition);

		// Snap to scale
		if (scale === "months") {
			newStartTime = new Date(
				newStartTime.getFullYear(),
				newStartTime.getMonth(),
				1,
			);
			newEndTime = new Date(
				newEndTime.getFullYear(),
				newEndTime.getMonth() + 1,
				0,
			); // Last day of month
		} else if (scale === "years") {
			newStartTime = new Date(newStartTime.getFullYear(), 0, 1);
			newEndTime = new Date(newEndTime.getFullYear(), 11, 31);
		}

		onRangeChange([newStartTime, newEndTime]);
	};

	const formatDate = (date: Date) => {
		if (scale === "years") {
			return date.getFullYear().toString();
		} else if (scale === "months") {
			return date.toLocaleDateString("en-US", {
				year: "numeric",
				month: "short",
			});
		} else {
			return date.toLocaleDateString("en-US", {
				year: "numeric",
				month: "short",
				day: "numeric",
			});
		}
	};

	const formatDateInput = (date: Date) => {
		return date.toISOString().split("T")[0];
	};

	const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const newDate = new Date(e.target.value);
		if (!Number.isNaN(newDate.getTime()) && newDate < customEndDate) {
			setCustomStartDate(newDate);
			// Adjust current range if it's outside new bounds
			if (currentRange[0] < newDate) {
				onRangeChange([newDate, currentRange[1]]);
			}
		}
	};

	const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const newDate = new Date(e.target.value);
		if (!Number.isNaN(newDate.getTime()) && newDate > customStartDate) {
			setCustomEndDate(newDate);
			// Adjust current range if it's outside new bounds
			if (currentRange[1] > newDate) {
				onRangeChange([currentRange[0], newDate]);
			}
		}
	};

	const resetToFullRange = () => {
		setCustomStartDate(startDate);
		setCustomEndDate(endDate);
	};

	const hasCustomRange =
		customStartDate.getTime() !== startDate.getTime() ||
		customEndDate.getTime() !== endDate.getTime();

	return (
		<div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-white rounded-lg shadow-lg border border-slate-200 p-3 w-[560px] z-10">
			<div className="flex flex-col gap-2.5">
				{/* Top Row: Range inputs and Scale buttons */}
				<div className="flex items-center gap-2">
					<div className="flex items-center gap-1.5 bg-slate-50 rounded px-2 py-1 border border-slate-200">
						<Input
							type="date"
							value={formatDateInput(customStartDate)}
							onChange={handleStartDateChange}
							className="h-5 text-[11px] px-1.5 border-0 bg-transparent w-[100px] focus-visible:ring-0"
							min={formatDateInput(startDate)}
							max={formatDateInput(customEndDate)}
						/>
						<span className="text-xs text-slate-400">→</span>
						<Input
							type="date"
							value={formatDateInput(customEndDate)}
							onChange={handleEndDateChange}
							className="h-5 text-[11px] px-1.5 border-0 bg-transparent w-[100px] focus-visible:ring-0"
							min={formatDateInput(customStartDate)}
							max={formatDateInput(endDate)}
						/>
					</div>

					{hasCustomRange && (
						<Button
							variant="ghost"
							size="sm"
							onClick={resetToFullRange}
							className="h-6 w-6 p-0 hover:bg-slate-100"
							title="Reset to full range"
						>
							<RotateCcw className="w-3.5 h-3.5 text-slate-500" />
						</Button>
					)}

					<div className="flex-1" />

					<div className="flex gap-1">
						<Button
							variant={scale === "days" ? "default" : "outline"}
							size="sm"
							onClick={() => setScale("days")}
							className={
								scale === "days"
									? "bg-teal-50 hover:bg-teal-100 text-teal-700 border-teal-600"
									: "hover:border-teal-400 hover:bg-white hover:text-slate-900"
							}
						>
							Days
						</Button>
						<Button
							variant={scale === "months" ? "default" : "outline"}
							size="sm"
							onClick={() => setScale("months")}
							className={
								scale === "months"
									? "bg-teal-50 hover:bg-teal-100 text-teal-700 border-teal-600"
									: "hover:border-teal-400 hover:bg-white hover:text-slate-900"
							}
						>
							Months
						</Button>
						<Button
							variant={scale === "years" ? "default" : "outline"}
							size="sm"
							onClick={() => setScale("years")}
							className={
								scale === "years"
									? "bg-teal-50 hover:bg-teal-100 text-teal-700 border-teal-600"
									: "hover:border-teal-400 hover:bg-white hover:text-slate-900"
							}
						>
							Years
						</Button>
					</div>
				</div>

				{/* Slider */}
				<div className="flex-1">
					<Slider
						value={sliderValues}
						onValueChange={handleSliderChange}
						max={100}
						step={scale === "days" ? 0.1 : scale === "months" ? 1 : 5}
						className="w-full [&_[data-slot=slider-track]]:h-2 [&_[data-slot=slider-thumb]]:size-3"
					/>
					<div className="flex justify-between mt-1.5 text-[10px] text-slate-500">
						<span>{formatDate(effectiveStartDate)}</span>
						<div className="flex gap-1.5 bg-teal-50 px-2 py-0.5 rounded">
							<span className="font-medium text-teal-700">
								{formatDate(currentRange[0])}
							</span>
							<span className="text-teal-400">→</span>
							<span className="font-medium text-teal-700">
								{formatDate(currentRange[1])}
							</span>
						</div>
						<span>{formatDate(effectiveEndDate)}</span>
					</div>
				</div>
			</div>
		</div>
	);
}

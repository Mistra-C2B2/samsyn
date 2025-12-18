import { RotateCcw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "./ui/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "./ui/select";
import { Slider } from "./ui/slider";

type TimeScale = "months" | "years";

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

	// Generate available years dynamically from layer data
	const availableYears = useMemo(() => {
		const minYear = startDate.getFullYear();
		const maxYear = Math.max(endDate.getFullYear(), new Date().getFullYear());
		return Array.from(
			{ length: maxYear - minYear + 1 },
			(_, i) => minYear + i,
		);
	}, [startDate, endDate]);

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

	// Calculate months between two dates
	const getMonthsDiff = (start: Date, end: Date) => {
		return (
			(end.getFullYear() - start.getFullYear()) * 12 +
			(end.getMonth() - start.getMonth())
		);
	};

	// Enforce 12-month limit when switching to months scale
	useEffect(() => {
		if (scale === "months") {
			const monthsDiff = getMonthsDiff(currentRange[0], currentRange[1]);
			if (monthsDiff > 11) {
				// Cap the range at 12 months, keeping the end date
				const newStartTime = new Date(
					currentRange[1].getFullYear(),
					currentRange[1].getMonth() - 11,
					1,
				);
				onRangeChange([newStartTime, currentRange[1]]);
			}
		}
	}, [scale]); // Only run when scale changes

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

			// Enforce 12-month maximum for months scale
			const monthsDiff = getMonthsDiff(newStartTime, newEndTime);
			if (monthsDiff > 11) {
				// Max 12 months (0-11 = 12 months)
				// Keep the end fixed and move start forward
				newStartTime = new Date(
					newEndTime.getFullYear(),
					newEndTime.getMonth() - 11,
					1,
				);
			}
		} else if (scale === "years") {
			newStartTime = new Date(newStartTime.getFullYear(), 0, 1);
			newEndTime = new Date(newEndTime.getFullYear(), 11, 31);
		}

		onRangeChange([newStartTime, newEndTime]);
	};

	const formatDate = (date: Date) => {
		if (scale === "years") {
			return date.getFullYear().toString();
		}
		// months scale
		return date.toLocaleDateString("en-US", {
			year: "numeric",
			month: "short",
		});
	};

	const handleStartYearChange = (year: string) => {
		const newDate = new Date(Number(year), 0, 1); // Jan 1 of selected year
		if (newDate < customEndDate) {
			setCustomStartDate(newDate);
			// Adjust current range if it's outside new bounds
			if (currentRange[0] < newDate) {
				onRangeChange([newDate, currentRange[1]]);
			}
		}
	};

	const handleEndYearChange = (year: string) => {
		const newDate = new Date(Number(year), 11, 31); // Dec 31 of selected year
		if (newDate > customStartDate) {
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
					<div className="flex items-center gap-1.5">
						<Select
							value={customStartDate.getFullYear().toString()}
							onValueChange={handleStartYearChange}
						>
							<SelectTrigger className="h-7 w-[75px] text-xs">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{availableYears.filter(
									(y) => y <= customEndDate.getFullYear(),
								).map((year) => (
									<SelectItem key={year} value={year.toString()}>
										{year}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						<span className="text-xs text-slate-400">→</span>
						<Select
							value={customEndDate.getFullYear().toString()}
							onValueChange={handleEndYearChange}
						>
							<SelectTrigger className="h-7 w-[75px] text-xs">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{availableYears.filter(
									(y) => y >= customStartDate.getFullYear(),
								).map((year) => (
									<SelectItem key={year} value={year.toString()}>
										{year}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
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
						step={scale === "months" ? 1 : 5}
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

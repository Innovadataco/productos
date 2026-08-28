"use client";

import { useState, useId, cloneElement, isValidElement } from "react";

interface TooltipProps {
    content: string;
    children: React.ReactElement;
    position?: "top" | "bottom" | "left" | "right";
}

const positionClasses: Record<string, string> = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left: "right-full top-1/2 -translate-y-1/2 mr-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-2",
};

export function Tooltip({ content, children, position = "bottom" }: TooltipProps) {
    const [visible, setVisible] = useState(false);
    const tooltipId = useId();

    const child = isValidElement(children) ? children : <span>{children}</span>;

    return (
        <span className="relative inline-flex">
            {cloneElement(child, {
                "aria-describedby": tooltipId,
                onMouseEnter: () => setVisible(true),
                onMouseLeave: () => setVisible(false),
                onFocus: () => setVisible(true),
                onBlur: () => setVisible(false),
            } as Record<string, unknown>)}
            {visible && (
                <span
                    id={tooltipId}
                    role="tooltip"
                    className={`absolute z-50 whitespace-nowrap rounded-lg bg-slate-900 px-2 py-1 text-xs font-medium text-white shadow-lg dark:bg-slate-100 dark:text-slate-900 ${positionClasses[position]}`}
                >
                    {content}
                </span>
            )}
        </span>
    );
}

export default Tooltip;

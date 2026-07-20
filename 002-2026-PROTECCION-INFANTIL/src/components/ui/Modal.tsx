"use client";

import { useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { Button } from "./Button";

export interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    children: React.ReactNode;
    size?: "sm" | "md" | "lg" | "xl";
    showCloseButton?: boolean;
    initialFocusRef?: React.RefObject<HTMLElement | null>;
}

const sizeClasses: Record<string, string> = {
    sm: "max-w-sm",
    md: "max-w-lg",
    lg: "max-w-3xl",
    xl: "max-w-5xl",
};

function getFocusableElements(container: HTMLElement): HTMLElement[] {
    const selector = [
        "a[href]",
        "button:not([disabled])",
        "input:not([disabled])",
        "select:not([disabled])",
        "textarea:not([disabled])",
        '[tabindex]:not([tabindex="-1"])',
        "[contenteditable]",
    ].join(", ");
    return Array.from(container.querySelectorAll(selector)).filter(
        (el): el is HTMLElement => {
            if (el instanceof HTMLElement) {
                const style = window.getComputedStyle(el);
                return style.display !== "none" && style.visibility !== "hidden";
            }
            return false;
        }
    );
}

export function Modal({
    isOpen,
    onClose,
    title,
    children,
    size = "lg",
    showCloseButton = true,
    initialFocusRef,
}: ModalProps) {
    const overlayRef = useRef<HTMLDivElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    const previousFocusRef = useRef<HTMLElement | null>(null);
    const focusReturnOnCloseRef = useRef(true);

    const handleClose = useCallback(() => {
        focusReturnOnCloseRef.current = true;
        onClose();
    }, [onClose]);

    useEffect(() => {
        if (isOpen) {
            previousFocusRef.current = document.activeElement as HTMLElement;
            focusReturnOnCloseRef.current = true;
        }
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;

        const focusTarget = initialFocusRef?.current || panelRef.current;
        if (focusTarget) {
            const timer = setTimeout(() => {
                if (initialFocusRef?.current) {
                    initialFocusRef.current.focus();
                } else if (panelRef.current) {
                    const focusable = getFocusableElements(panelRef.current);
                    if (focusable.length > 0) {
                        focusable[0].focus();
                    } else {
                        panelRef.current.focus();
                    }
                }
            }, 0);
            return () => clearTimeout(timer);
        }
    }, [isOpen, initialFocusRef]);

    useEffect(() => {
        if (!isOpen) return;

        function handleKeyDown(e: KeyboardEvent) {
            if (e.key === "Escape") {
                e.preventDefault();
                handleClose();
                return;
            }
            if (e.key !== "Tab" || !panelRef.current) return;

            const focusable = getFocusableElements(panelRef.current);
            if (focusable.length === 0) {
                e.preventDefault();
                panelRef.current.focus();
                return;
            }

            const currentIndex = focusable.findIndex((el) => el === document.activeElement);
            let nextIndex: number;
            if (e.shiftKey) {
                nextIndex = currentIndex <= 0 ? focusable.length - 1 : currentIndex - 1;
            } else {
                nextIndex = currentIndex === -1 || currentIndex === focusable.length - 1 ? 0 : currentIndex + 1;
            }
            e.preventDefault();
            focusable[nextIndex].focus();
        }

        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, handleClose]);

    useEffect(() => {
        if (!isOpen) {
            if (previousFocusRef.current && focusReturnOnCloseRef.current) {
                const timer = setTimeout(() => previousFocusRef.current?.focus(), 0);
                return () => clearTimeout(timer);
            }
            return;
        }

        function handleFocus(e: FocusEvent) {
            if (!panelRef.current || !overlayRef.current) return;
            const target = e.target as Node;
            if (!overlayRef.current.contains(target)) {
                e.preventDefault();
                e.stopImmediatePropagation();
                const focusable = getFocusableElements(panelRef.current);
                if (focusable.length > 0) {
                    if (e.relatedTarget && focusable.includes(e.relatedTarget as HTMLElement)) {
                        const index = focusable.indexOf(e.relatedTarget as HTMLElement);
                        const next = focusable[(index + 1) % focusable.length];
                        next.focus();
                    } else {
                        focusable[0].focus();
                    }
                } else if (panelRef.current) {
                    panelRef.current.focus();
                }
            }
        }

        document.addEventListener("focusin", handleFocus, true);
        return () => document.removeEventListener("focusin", handleFocus, true);
    }, [isOpen]);

    const handleOverlayClick = useCallback(
        (e: React.MouseEvent<HTMLDivElement>) => {
            if (e.target === overlayRef.current) {
                handleClose();
            }
        },
        [handleClose]
    );

    if (!isOpen) return null;

    const modal = (
        <div
            ref={overlayRef}
            onClick={handleOverlayClick}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            role="presentation"
            aria-hidden="false"
        >
            <div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={title ? "modal-title" : undefined}
                tabIndex={-1}
                className={`max-h-[90vh] w-full ${sizeClasses[size]} overflow-y-auto rounded-2xl glass-strong p-6 shadow-xl focus:outline-none`}
            >
                {showCloseButton && (
                    <div className="flex items-center justify-between gap-4">
                        {title ? (
                            <h2 id="modal-title" className="text-xl font-semibold text-body">
                                {title}
                            </h2>
                        ) : (
                            <div />
                        )}
                        <Button onClick={handleClose} variant="secondary" aria-label="Cerrar">
                            Cerrar
                        </Button>
                    </div>
                )}
                {title && !showCloseButton && (
                    <h2 id="modal-title" className="text-xl font-semibold text-body">
                        {title}
                    </h2>
                )}
                <div className={showCloseButton ? "mt-4" : ""}>{children}</div>
            </div>
        </div>
    );

    if (typeof document !== "undefined") {
        return createPortal(modal, document.body);
    }

    return modal;
}

export default Modal;

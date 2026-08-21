"use client";

import { Modal } from "@/components/ui/Modal";

type LogContextoModalProps = {
    isOpen: boolean;
    onClose: () => void;
    contextoJson: unknown;
};

export function LogContextoModal({ isOpen, onClose, contextoJson }: LogContextoModalProps) {
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Contexto del log" size="lg">
            <div className="rounded-xl bg-slate-900 p-4">
                <pre className="max-h-[60vh] overflow-auto text-xs text-slate-100 font-mono">
                    {JSON.stringify(contextoJson, null, 2)}
                </pre>
            </div>
        </Modal>
    );
}

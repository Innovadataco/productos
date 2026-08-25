"use client";

import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

interface InvitacionEnviadaModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function InvitacionEnviadaModal({ isOpen, onClose }: InvitacionEnviadaModalProps) {
    const router = useRouter();

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Invitación enviada" size="md" showCloseButton={false}>
            <div className="space-y-6">
                <p className="text-body">
                    ✓ Invitación enviada · el rector recibió email para activar su cuenta
                </p>
                <div className="flex justify-end">
                    <Button onClick={() => router.push("/dashboard/admin/colegios")}>
                        Volver al listado
                    </Button>
                </div>
            </div>
        </Modal>
    );
}

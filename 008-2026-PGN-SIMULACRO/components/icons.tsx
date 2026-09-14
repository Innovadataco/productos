import {
  BookOpen,
  Building2,
  Calculator,
  ClipboardList,
  FileEdit,
  FileText,
  FolderOpen,
  Gavel,
  Globe,
  Headphones,
  Landmark,
  Map,
  MessageSquare,
  Monitor,
  Scale,
  Search,
  Settings,
  ShieldAlert,
  Shuffle,
  LucideIcon,
} from 'lucide-react';

const iconMap: Record<string, LucideIcon> = {
  BookOpen,
  Building2,
  Calculator,
  ClipboardList,
  FileEdit,
  FileText,
  FolderOpen,
  Gavel,
  Globe,
  Headphones,
  Landmark,
  Map,
  MessageSquare,
  Monitor,
  Scale,
  Search,
  Settings,
  ShieldAlert,
  Shuffle,
};

export function getIcon(nombre: string): LucideIcon {
  return iconMap[nombre] || BookOpen;
}

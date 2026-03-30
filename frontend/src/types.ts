import {
  ArrowUpRight,
  Award,
  Bell,
  Book,
  BookOpen,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  Download,
  Edit3,
  ExternalLink,
  Eye,
  EyeOff,
  Flame,
  Globe,
  Heart,
  History,
  Home,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Moon,
  Newspaper,
  PauseCircle,
  Rocket,
  Rss,
  Search,
  Sparkles,
  Send,
  Settings,
  Share2,
  Star,
  Sun,
  Trash2,
  TrendingUp,
  Trophy,
  User,
  X,
  XCircle,
} from 'lucide-react';

export const Icons = {
  ArrowUpRight,
  Award,
  Bell,
  Book,
  BookOpen,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  Download,
  Edit3,
  ExternalLink,
  Eye,
  EyeOff,
  Flame,
  Globe,
  Heart,
  History,
  Home,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Moon,
  Newspaper,
  PauseCircle,
  Rocket,
  Rss,
  Search,
  Sparkles,
  Send,
  Settings,
  Share2,
  Star,
  Sun,
  Trash2,
  TrendingUp,
  Trophy,
  User,
  X,
  XCircle,
};

export interface BookType {
  id: string;
  title: string;
  author: string;
  cover: string;
  category: string;
  rating: number;
  progress?: number;
  pages?: number;
  description?: string;
  status?: 'Want to Read' | 'Currently Reading' | 'Completed' | 'Downloading' | 'Paused';
  reviews?: number;
  timeLeft?: string;
  size?: string;
  downloadProgress?: number;
  speed?: string;
}

import { Home, Search, PlusSquare, MessageCircle, User, Users, UsersRound, Wallet } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavItem {
  to: string;
  icon: LucideIcon;
  label: string;
}

/** Phone tab bar. Six is the practical ceiling before targets get too narrow. */
export const tabBarNav: NavItem[] = [
  { to: "/", icon: Home, label: "Feed" },
  { to: "/discover", icon: Search, label: "Discover" },
  { to: "/near-me", icon: Users, label: "Near Me" },
  { to: "/create", icon: PlusSquare, label: "Create" },
  { to: "/messages", icon: MessageCircle, label: "Messages" },
  { to: "/profile", icon: User, label: "Profile" },
];

/** Desktop rail has room for everything, so Groups and Wallet stop being
 *  reachable only by typing the URL. */
export const railNav: NavItem[] = [
  { to: "/", icon: Home, label: "Feed" },
  { to: "/discover", icon: Search, label: "Discover" },
  { to: "/near-me", icon: Users, label: "Near Me" },
  { to: "/create", icon: PlusSquare, label: "Create" },
  { to: "/messages", icon: MessageCircle, label: "Messages" },
  { to: "/groups", icon: UsersRound, label: "Groups" },
  { to: "/wallet", icon: Wallet, label: "Wallet" },
  { to: "/profile", icon: User, label: "Profile" },
];

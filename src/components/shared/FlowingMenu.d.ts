import type { CSSProperties, JSX, MouseEvent } from "react";

export interface FlowingMenuItem {
  text: string;
  link?: string;
  image?: string;
  marquee?: string;
  meta?: string;
  index?: string;
  ariaLabel?: string;
  target?: string;
  rel?: string;
}

export interface FlowingMenuProps {
  items?: FlowingMenuItem[];
  speed?: number;
  direction?: "left" | "right" | "alternate";
  followCursor?: number;
  duration?: number;
  stretch?: number;
  magnet?: number;
  bandInset?: number;
  bandRadius?: number;
  carryContent?: boolean;
  textColor?: string;
  bgColor?: string;
  marqueeBgColor?: string;
  marqueeTextColor?: string;
  borderColor?: string;
  dividers?: boolean;
  dimInactive?: boolean;
  align?: "center" | "left";
  showIndex?: boolean;
  showArrow?: boolean;
  imageShape?: "pill" | "rounded" | "circle";
  intro?: boolean;
  activeIndex?: number;
  onItemClick?: (item: FlowingMenuItem, index: number, event: MouseEvent) => void;
  onReady?: () => void;
  ariaLabel?: string;
  className?: string;
  style?: CSSProperties;
}

export default function FlowingMenu(props: FlowingMenuProps): JSX.Element;

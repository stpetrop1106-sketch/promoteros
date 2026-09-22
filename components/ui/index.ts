export { Button, buttonClassName } from "./Button";
export type { ButtonProps, ButtonVariant, ButtonSize } from "./Button";

export { Card } from "./Card";
export type { CardProps, CardElevation } from "./Card";

export {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeaderCell,
  TableCell,
} from "./Table";
export type { TableProps, TableHeaderCellProps } from "./Table";

export { TextField, SelectField, TextArea } from "./Field";
export type {
  TextFieldProps,
  SelectFieldProps,
  SelectOption,
  TextAreaProps,
} from "./Field";

export { Badge } from "./Badge";
export type { BadgeProps, BadgeVariant, BadgeSize } from "./Badge";

export { PageHeader } from "./PageHeader";
export type { PageHeaderProps, PageHeaderSize } from "./PageHeader";

export { EmptyState } from "./EmptyState";
export type { EmptyStateProps } from "./EmptyState";

export { ScoreBar } from "./ScoreBar";
export type { ScoreBarProps, ScoreBarSize } from "./ScoreBar";

export { Markdown } from "./Markdown";
export type { MarkdownProps } from "./Markdown";

/* --- Added in P34. Nothing above this line changed shape. --- */

export { Icon, ICON_NAMES } from "./Icon";
export type { IconProps, IconName } from "./Icon";

export { Avatar, initialsFor } from "./Avatar";
export type { AvatarProps, AvatarSize } from "./Avatar";

export { StatTile, StatStrip } from "./StatTile";
export type { StatTileProps, StatTileTone, StatStripProps } from "./StatTile";

export { Skeleton, SkeletonText } from "./Skeleton";
export type { SkeletonProps, SkeletonVariant, SkeletonTextProps } from "./Skeleton";

/* --- Added in P35. Nothing above this line changed shape. --- */

export { LinkButton } from "./LinkButton";
export type { LinkButtonProps } from "./LinkButton";

export { Section, SectionHeading, Detail, DetailList } from "./Section";
export type {
  SectionProps,
  SectionHeadingProps,
  DetailProps,
  DetailListProps,
} from "./Section";

/* --- Added in P36. Nothing above this line changed shape. --- */

export { CopyButton, WhatsAppButton } from "./CopyButton";

/* --- Added in P42a. Nothing above this line changed shape: these are the two
       optional prop types `StatTile` grew (the pastel corner chip and the
       delta's direction), exported so a screen can name them. --- */

export type { StatTileChip, StatTileDelta } from "./StatTile";

/* --- Added in F1 (A2 finding 11). Purely additive: the two-step confirmation the
       product had already written by hand twice, so the four `window.confirm` sites
       can share one implementation. Nothing above this line changed shape. --- */

export { ConfirmButton } from "./ConfirmButton";
export type { ConfirmButtonProps } from "./ConfirmButton";

/* --- Added in F2 (A3-16). Purely additive: the `?lang=` toggle the four promoter
       pages needed so the complete English dictionary is reachable at all.
       Nothing above this line changed shape. --- */

export { PromoterLanguageToggle } from "./PromoterLanguageToggle";
export type { PromoterLanguageToggleProps } from "./PromoterLanguageToggle";

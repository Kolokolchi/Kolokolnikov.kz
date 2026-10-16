CREATE TABLE `portfolio_admins` (
	`role` text PRIMARY KEY NOT NULL,
	`subject` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `demo_files` (
	`version` text NOT NULL,
	`path` text NOT NULL,
	`size` integer NOT NULL,
	`hash` text NOT NULL,
	PRIMARY KEY(`version`, `path`),
	FOREIGN KEY (`version`) REFERENCES `demo_versions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `demo_projects` (
	`slug` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`active_version` text,
	`hidden` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `demo_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`project` text NOT NULL,
	`label` text NOT NULL,
	`status` text DEFAULT 'uploading' NOT NULL,
	`visible` integer DEFAULT 0 NOT NULL,
	`source` text NOT NULL,
	`manifest_hash` text NOT NULL,
	`file_count` integer NOT NULL,
	`total_bytes` integer NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`project`) REFERENCES `demo_projects`(`slug`) ON UPDATE no action ON DELETE no action
);

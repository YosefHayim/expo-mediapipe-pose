import { useEffect, useRef, useState } from "react";
import {
	ArrowRightIcon,
	CloseIcon,
	GithubIcon,
	LogoMark,
	MenuIcon,
} from "@/landing/icons/icons";
import { openPlayground } from "@/landing/open-playground";
import { ThemeToggle } from "@/landing/theme/theme-toggle";
import { repository } from "@/playground/site";
import "./site-nav.css";

const navLinks = [
	{ label: "Features", href: "#features" },
	{ label: "Playground", href: "#playground" },
	{ label: "Browser vs native", href: "#browser-vs-native" },
	{ label: "Agents", href: "#agents" },
	{ label: "FAQ", href: "#faq" },
];

const sheetId = "site-nav-sheet";

export const SiteNav = () => {
	const [isScrolled, setIsScrolled] = useState(false);
	const [isOpen, setIsOpen] = useState(false);
	const menuButtonRef = useRef<HTMLButtonElement>(null);
	const sheetRef = useRef<HTMLDivElement>(null);
	const wasOpenRef = useRef(false);

	useEffect(() => {
		const handleScroll = () => setIsScrolled(window.scrollY > 24);
		handleScroll();
		window.addEventListener("scroll", handleScroll, { passive: true });
		return () => window.removeEventListener("scroll", handleScroll);
	}, []);

	useEffect(() => {
		if (!isOpen) return;
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") setIsOpen(false);
		};
		const previousOverflow = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		window.addEventListener("keydown", handleKeyDown);
		return () => {
			document.body.style.overflow = previousOverflow;
			window.removeEventListener("keydown", handleKeyDown);
		};
	}, [isOpen]);

	useEffect(() => {
		const wide = window.matchMedia("(min-width: 1024px)");
		const handleChange = () => {
			if (wide.matches) setIsOpen(false);
		};
		wide.addEventListener("change", handleChange);
		return () => wide.removeEventListener("change", handleChange);
	}, []);

	useEffect(() => {
		if (isOpen) {
			sheetRef.current?.querySelector<HTMLElement>("a, button")?.focus();
		} else if (wasOpenRef.current) {
			menuButtonRef.current?.focus();
		}
		wasOpenRef.current = isOpen;
	}, [isOpen]);

	const handleMenuClick = () => setIsOpen((open) => !open);
	const handleLinkClick = () => setIsOpen(false);
	const handleTryClick = () => {
		setIsOpen(false);
		openPlayground();
	};

	return (
		<header
			className={`site-nav ground-night${isScrolled || isOpen ? " is-scrolled" : ""}`}
		>
			<div className="container site-nav-bar">
				<a
					className="site-nav-brand"
					href="#top"
					aria-label="expo-mediapipe-pose, top of page"
				>
					<LogoMark />
					<span className="site-nav-brand-name">expo-mediapipe-pose</span>
				</a>
				<nav className="site-nav-links" aria-label="Sections">
					{navLinks.map((link) => (
						<a key={link.href} href={link.href}>
							{link.label}
						</a>
					))}
				</nav>
				<div className="site-nav-actions">
					<ThemeToggle />
					<a
						className="site-nav-github"
						href={repository}
						target="_blank"
						rel="noreferrer"
						aria-label="expo-mediapipe-pose on GitHub"
					>
						<GithubIcon />
					</a>
					<button
						type="button"
						className="button-primary site-nav-try"
						onClick={handleTryClick}
					>
						Try it live
						<ArrowRightIcon size={18} />
					</button>
					<button
						ref={menuButtonRef}
						type="button"
						className="site-nav-menu-button"
						aria-label={isOpen ? "Close menu" : "Open menu"}
						aria-expanded={isOpen}
						aria-controls={sheetId}
						onClick={handleMenuClick}
					>
						{isOpen ? <CloseIcon /> : <MenuIcon />}
					</button>
				</div>
			</div>
			<div
				id={sheetId}
				ref={sheetRef}
				className="site-nav-sheet"
				hidden={!isOpen}
			>
				<div className="container site-nav-sheet-inner">
					<nav aria-label="Sections">
						{navLinks.map((link) => (
							<a key={link.href} href={link.href} onClick={handleLinkClick}>
								{link.label}
							</a>
						))}
					</nav>
					<button
						type="button"
						className="button-primary"
						onClick={handleTryClick}
					>
						Try it live
						<ArrowRightIcon size={18} />
					</button>
				</div>
			</div>
		</header>
	);
};

import { ArrowRightIcon } from "@/landing/icons/icons";
import { openPlayground } from "@/landing/open-playground";
import { HeroInstallBox } from "./hero-install-box";
import { HeroTickRule } from "./hero-tick-rule";
import { HeroVideoStage } from "./hero-video-stage";
import "./hero.css";

export const Hero = () => {
	const handleTryClick = () => openPlayground();

	return (
		<section
			id="top"
			className="hero ground-night"
			aria-labelledby="hero-title"
		>
			<div className="container hero-inner">
				<div className="hero-group-one">
					<h1 id="hero-title">Track every joint, live in Expo.</h1>
					<HeroTickRule />
					<p className="lead hero-lead">
						On-device pose detection for Expo and React Native, powered by
						MediaPipe. Camera, photo and video inference with custom skeletons
						and your own feedback rules. Frames stay on the device.
					</p>
				</div>

				<div className="hero-group-two">
					<button
						type="button"
						className="button-primary"
						onClick={handleTryClick}
					>
						Try it live
						<ArrowRightIcon size={18} />
					</button>
					<HeroInstallBox />
				</div>
			</div>

			<HeroVideoStage />
		</section>
	);
};

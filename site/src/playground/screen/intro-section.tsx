export const IntroSection = () => {
	return (
		<>
			<section className="intro">
				<div>
					<p className="eyebrow">EXPO MEDIAPIPE POSE · INTERACTIVE LAB</p>
					<h1>
						Your movement.
						<br />
						<span>Your configuration.</span>
					</h1>
					<p className="intro-copy">
						See what pose detection can do for your idea. Try a sample, make it
						yours, then take the code into Expo.
					</p>
				</div>
				<div className="intro-note">
					<span className="tiny-dot" /> Runs in your browser
					<p>
						Your camera and files stay on your device.
						<br />
						No account. No upload. Just try it.
					</p>
					<a href="#integration">Ready to build? Get the code ↓</a>
				</div>
			</section>
			<ol className="journey">
				<li>
					<span>01</span> Choose your input
				</li>
				<li>
					<span>02</span> Make it yours
				</li>
				<li>
					<span>03</span> Take it to Expo
				</li>
			</ol>
		</>
	);
};

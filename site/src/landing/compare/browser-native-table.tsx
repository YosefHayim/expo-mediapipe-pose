import { CompareRowView } from "@/landing/compare/compare-row";
import { COMPARE_ROWS } from "@/landing/compare/compare-rows";
import { Reveal } from "@/landing/motion/reveal";
import { Section } from "@/landing/section/section";
import "./browser-native-table.css";

export const BrowserNativeTable = () => (
	<Section
		id="browser-vs-native"
		ground="night"
		title="What the browser shows, what the native module does."
		intro="The playground helps you pick a skeleton and rules. The native module runs them on a phone. Treat the browser as a preview, not a benchmark."
	>
		<Reveal>
			<table className="compare-table">
				<caption className="visually-hidden">
					Browser playground compared with the native module, feature by feature
				</caption>
				<thead>
					<tr>
						<th scope="col">Feature</th>
						<th scope="col">Browser playground</th>
						<th scope="col">Native on iOS and Android</th>
					</tr>
				</thead>
				<tbody>
					{COMPARE_ROWS.map((row) => (
						<CompareRowView key={row.id} row={row} />
					))}
				</tbody>
			</table>
		</Reveal>
	</Section>
);

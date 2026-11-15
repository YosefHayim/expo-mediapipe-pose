import type { CompareRow } from "@/landing/compare/compare-rows";
import { StatusMark } from "@/landing/compare/status-mark";

type CompareRowViewProps = {
	row: CompareRow;
};

/** One feature across both columns. Under 640px each cell names its column. */
export const CompareRowView = ({ row }: CompareRowViewProps) => (
	<tr>
		<th scope="row" className="compare-feature">
			{row.feature}
		</th>
		<td>
			<span className="compare-cell-label" aria-hidden="true">
				Browser playground
			</span>
			<span className="compare-cell-body">
				<StatusMark kind={row.browser.status} />
				<span>{row.browser.text}</span>
			</span>
		</td>
		<td>
			<span className="compare-cell-label" aria-hidden="true">
				Native on iOS and Android
			</span>
			<span className="compare-cell-body">
				<StatusMark kind={row.native.status} />
				<span>{row.native.text}</span>
			</span>
		</td>
	</tr>
);

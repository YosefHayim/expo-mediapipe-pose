import * as React from "react";
import { ScrollView, Text } from "react-native";
import { runNativeChecks } from "./runNativeChecks";

export function NativeChecks() {
	const [report, setReport] = React.useState("Running native fixture checks…");
	React.useEffect(() => {
		let mounted = true;
		runNativeChecks()
			.then((result) => {
				if (mounted) setReport(result);
			})
			.catch((error) => {
				if (mounted) setReport(String(error));
			});
		return () => {
			mounted = false;
		};
	}, []);
	return (
		<ScrollView
			style={{ padding: 32, paddingTop: 80, backgroundColor: "white" }}
		>
			<Text selectable>{report}</Text>
		</ScrollView>
	);
}

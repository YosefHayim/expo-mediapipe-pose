import * as React from "react";
import { ScrollView, Text } from "react-native";
import { runNativeChecks } from "./run-native-checks";

export const NativeChecks = () => {
	const [report, setReport] = React.useState("Running native fixture checks…");
	React.useEffect(() => {
		let mounted = true;
		runNativeChecks()
			.then((report) => {
				if (mounted) setReport(report);
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
};

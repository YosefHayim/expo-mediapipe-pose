import * as React from "react";
import { ScrollView, StyleSheet, Text } from "react-native";
import { runNativeChecks } from "./run-native-checks";

export const NativeChecks = () => {
	const [report, setReport] = React.useState("Running native fixture checks…");
	React.useEffect(() => {
		let isMounted = true;
		const showChecksReport = async () => {
			try {
				const checksReport = await runNativeChecks();
				if (isMounted) setReport(checksReport);
			} catch (error) {
				if (isMounted) setReport(String(error));
			}
		};
		void showChecksReport();
		return () => {
			isMounted = false;
		};
	}, []);
	return (
		<ScrollView style={styles.screen}>
			<Text selectable>{report}</Text>
		</ScrollView>
	);
};

const styles = StyleSheet.create({
	screen: { padding: 32, paddingTop: 80, backgroundColor: "white" },
});

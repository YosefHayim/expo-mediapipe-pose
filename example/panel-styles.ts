import { StyleSheet } from "react-native";

export const panelStyles = StyleSheet.create({
	panel: {
		flex: 1,
		gap: 12,
	},
	fillArea: {
		flex: 1,
	},
	label: {
		color: "white",
	},
	errorLabel: {
		color: "#fca5a5",
	},
	input: {
		color: "white",
		borderColor: "#64748b",
		borderWidth: 1,
		padding: 12,
	},
});
